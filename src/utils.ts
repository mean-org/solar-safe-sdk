import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
  TransactionInstruction
} from '@solana/web3.js';
import { AnchorProvider, BorshInstructionCoder, Idl, Program, SplToken, SplTokenCoder } from '@project-serum/anchor';
import {
  InstructionAccount,
  InstructionParameter,
  MultisigInfo,
  MultisigInstruction,
  MultisigParticipant,
  MultisigTransaction,
  MultisigTransactionDetail,
  MultisigTransactionFees,
  MultisigTransactionStatus,
  MultisigTransactionSummary,
  MULTISIG_ACTIONS,
  MultisigTransactionActivityItem,
  MultisigTransactionInstructionInfo,
  InstructionDataInfo,
  InstructionAccountInfo,
  OperationType
} from './types';
import { IdlMultisig } from '.';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { MeanSplTokenInstructionCoder } from './spl-token-coder/instruction';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { MeanSystemInstructionCoder } from './system-program-coder/instruction';

/**
 * Gets the multisig actions fees.
 *
 * @param {Program<Idl>} program - Multisig program instance
 * @param {MULTISIG_ACTIONS} action - Multisig action to get the fees for.
 * @returns {Promise<MultisigTransactionFees>} Returns a MultisigTransactionFees object.
 */
export const getFees = async (
  program: Program<IdlMultisig>,
  action: MULTISIG_ACTIONS
): Promise<MultisigTransactionFees> => {
  let txFees: MultisigTransactionFees = {
    networkFee: 0.0,
    rentExempt: 0.0,
    multisigFee: 0.02
  };

  switch (action) {
    case MULTISIG_ACTIONS.createMultisig: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt = await program.provider.connection.getMinimumBalanceForRentExemption(
        program.account.multisigV2.size
      );
      break;
    }
    case MULTISIG_ACTIONS.createTransaction: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt = await program.provider.connection.getMinimumBalanceForRentExemption(1500);
      break;
    }
    case MULTISIG_ACTIONS.cancelTransaction: {
      txFees.networkFee = 0.000005;
      txFees.rentExempt = 0.0;
      break;
    }
    default: {
      break;
    }
  }

  txFees.rentExempt = txFees.rentExempt / LAMPORTS_PER_SOL;

  return txFees;
};

/**
 * Gets the multisig trasaction status.
 *
 * @param {any} multisig - Multisig account where the transaction belongs.
 * @param {any} info - Transaction account to get the status.
 * @param {any} detail - Transaction Detail account of the multisig.
 * @returns {MultisigTransactionStatus} Returns the status of the multisig transaction proposal.
 */
export const getTransactionStatus = (multisig: any, info: any, detail: any): MultisigTransactionStatus => {
  try {
    if (!multisig) {
      throw Error("Invalid parameter: 'multisig'");
    }

    const executed = info.account.executedOn && info.account.executedOn.toNumber() > 0;

    if (executed) {
      return MultisigTransactionStatus.Executed;
    }

    const expirationDate =
      !executed && detail && detail.expirationDate > 0 ? new Date(detail.expirationDate.toNumber() * 1_000) : undefined;

    if (expirationDate && expirationDate.getTime() < Date.now()) {
      return MultisigTransactionStatus.Expired;
    }

    if (multisig.ownerSetSeqno !== info.account.ownerSetSeqno) {
      return MultisigTransactionStatus.Voided;
    }

    let approvals = info.account.signers.filter((s: number) => s === 1).length;

    if (multisig.threshold == approvals) {
      return MultisigTransactionStatus.Passed;
    }

    let filteredOwners = multisig.owners.filter((o: any) => !o.address.equals(PublicKey.default));

    let rejections = info.account.signers.filter((s: number) => s === 2).length;
    let max_aprovals = filteredOwners.filter((o: any) => o !== null).length - rejections;

    if (max_aprovals < multisig.threshold) {
      return MultisigTransactionStatus.Failed;
    }

    return MultisigTransactionStatus.Active;
  } catch (err) {
    throw Error(`Multisig Transaction Status: ${err}`);
  }
};

/**
 * Parses the multisig version 1 account.
 *
 * @param {PublicKey} programId - The id of the multisig program.
 * @param {any} info - Transaction account to get the status.
 * @returns {Promise<MultisigInfo | null>} Returns the parsed multisig account version 1.
 */
export const parseMultisigV1Account = async (programId: PublicKey, info: any): Promise<MultisigInfo | null> => {
  try {
    const [multisigSigner] = await PublicKey.findProgramAddress([info.publicKey.toBuffer()], programId);

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(info.account.label.length, info.account.label).filter(function (elem, index) {
      return elem !== 0;
    });

    for (let i = 0; i < info.account.owners.length; i++) {
      owners.push({
        address: info.account.owners[i].toBase58(),
        name:
          info.account.ownersNames?.length && info.account.ownersNames[i].length > 0
            ? new TextDecoder().decode(
                Buffer.from(Uint8Array.of(...info.account.ownersNames[i].filter((b: any) => b !== 0)))
              )
            : ''
      } as MultisigParticipant);
    }

    const multisig = {
      id: info.publicKey,
      version: info.account.version,
      label: new TextDecoder().decode(labelBuffer),
      authority: multisigSigner,
      nounce: info.account.nonce,
      ownerSetSeqno: info.account.ownerSetSeqno,
      threshold: info.account.threshold.toNumber(),
      pendingTxsAmount: info.account.pendingTxs.toNumber(),
      createdOnUtc: new Date(info.account.createdOn.toNumber() * 1000),
      owners: owners
    } as MultisigInfo;

    return multisig;
  } catch (err: any) {
    console.error(`Parse Multisig Account: ${err}`);
    return null;
  }
};

/**
 * Parses the multisig version 2 account.
 *
 * @param {PublicKey} programId - The id of the multisig program.
 * @param {any} info - Transaction account to get the status.
 * @returns {Promise<MultisigInfo | null>} Returns the parsed multisig account version 2.
 */
export const parseMultisigV2Account = async (programId: PublicKey, info: any): Promise<MultisigInfo | null> => {
  try {
    const [multisigSigner] = await PublicKey.findProgramAddress([info.publicKey.toBuffer()], programId);

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(info.account.label.length, info.account.label).filter(function (elem, index) {
      return elem !== 0;
    });

    let filteredOwners = info.account.owners.filter((o: any) => !o.address.equals(PublicKey.default));

    for (const element of filteredOwners) {
      owners.push({
        address: element.address.toBase58(),
        name:
          element.name.length > 0
            ? new TextDecoder().decode(Buffer.from(Uint8Array.of(...element.name.filter((b: any) => b !== 0))))
            : ''
      } as MultisigParticipant);
    }

    const multisig = {
      id: info.publicKey,
      version: info.account.version,
      label: new TextDecoder().decode(labelBuffer),
      authority: multisigSigner,
      nounce: info.account.nonce,
      ownerSetSeqno: info.account.ownerSetSeqno,
      threshold: info.account.threshold.toNumber(),
      pendingTxsAmount: info.account.pendingTxs.toNumber(),
      createdOnUtc: new Date(info.account.createdOn.toNumber() * 1000),
      owners: owners,
      balance: 0
    } as MultisigInfo;

    return multisig;
  } catch (err: any) {
    console.error(`Parse Multisig Account: ${err}`);
    return null;
  }
};

/**
 * Parses the multisig transaction account.
 *
 * @param {any} multisig - Multisig account where the transaction belongs.
 * @param {PublicKey} owner - The owner of the multisig account where the transaction belongs.
 * @param {any} txInfo - Transaction account to parse.
 * @param {any} txDetailInfo - Transaction detail account to parse.
 * @returns {MultisigTransaction} Returns the parsed multisig transaction account.
 */
export const parseMultisigTransaction = (
  multisig: any,
  owner: PublicKey,
  txInfo: any,
  txDetailInfo: any
): MultisigTransaction => {
  try {
    let ownerIndex = multisig.owners.findIndex((o: any) => o.address.toBase58() === owner.toBase58());

    const signers: (boolean | null)[] = [];
    const allSigners = txInfo.account.signers.slice(
      0,
      multisig.owners.filter((o: any) => !o.address.equals(PublicKey.default)).length
    );

    for (const s of allSigners) {
      signers.push(s === 0 ? null : s === 1 ? true : false);
    }

    return Object.assign({}, {
      id: txInfo.publicKey,
      multisig: txInfo.account.multisig,
      programId: txInfo.account.programId,
      signers: signers,
      ownerSetSeqno: txInfo.account.ownerSetSeqno,
      createdOn: new Date(txInfo.account.createdOn.toNumber() * 1000),
      executedOn:
        txInfo.account.executedOn && txInfo.account.executedOn > 0
          ? new Date(txInfo.account.executedOn.toNumber() * 1000)
          : undefined,
      status: getTransactionStatus(multisig, txInfo, txDetailInfo) as number,
      operation: txInfo.account.operation,
      accounts: txInfo.account.accounts,
      didSigned: signers[ownerIndex],
      proposer: txInfo.account.proposer,
      pdaTimestamp: txInfo.account.pdaTimestamp ? txInfo.account.pdaTimestamp.toNumber() : undefined,
      pdaBump: txInfo.account.pdaBump,
      data: txInfo.account.data,
      details: parseMultisigTransactionDetail(txDetailInfo)
    } as MultisigTransaction);
  } catch (err) {
    throw Error(`Multisig Transaction Error: ${err}`);
  }
};

/**
 * Parses the multisig transaction activity item.
 *
 * @param {any} coder - BorchSerializerCoder
 * @param {any[]} owners - The owners of the Multisig account of the proposal
 * @param {ParsedTransactionWithMeta} parsedTx - Pased transaction meta
 * @returns {MultisigTransactionActivityItem} Returns a MultisigTransactionActivityItem object
 */
export const parseMultisigTransactionActivity = (
  coder: any,
  owners: any[],
  parsedTx: ParsedTransactionWithMeta
): MultisigTransactionActivityItem | null => {
  let item: any = null;

  if (parsedTx.transaction.message.instructions.length === 0) {
    return item;
  }

  const ix =
    parsedTx.transaction.message.instructions.length === 1
      ? (parsedTx.transaction.message.instructions[0] as PartiallyDecodedInstruction)
      : parsedTx.transaction.message.instructions.length === 2
      ? (parsedTx.transaction.message.instructions[1] as PartiallyDecodedInstruction)
      : null;

  if (!ix) {
    return null;
  }

  const decodedIx = coder.decode(ix.data, 'base58');

  if (!decodedIx) {
    return null;
  }

  const action =
    decodedIx.name === 'createTransaction'
      ? 'created'
      : decodedIx.name === 'approve'
      ? 'approved'
      : decodedIx.name === 'executeTransaction'
      ? 'executed'
      : decodedIx.name === 'executeTransactionPda'
      ? 'executed'
      : decodedIx.name === 'executeTransactionWithReplacements'
      ? 'executed'
      : decodedIx.name === 'cancelTransaction'
      ? 'deleted'
      : 'rejected';

  const ownerInfo = owners.filter((o: any) => ix.accounts.some(a => a.equals(o.address)))[0];

  item = {
    index: 0,
    address: parsedTx.transaction.signatures[0],
    action: action,
    createdOn: new Date((parsedTx.blockTime as number) * 1_000),
    owner: !ownerInfo
      ? null
      : {
          address: ownerInfo.address.toBase58(),
          name: new TextDecoder('utf8')
            .decode(Buffer.from(Uint8Array.of(...ownerInfo.name.filter((i: number) => i !== 0))))
            .trim()
        }
  } as MultisigTransactionActivityItem;

  return item;
};

/**
 * Parses the multisig transaction detail account.
 *
 * @param {any} txDetailInfo - Transaction detail account to parse.
 * @returns {MultisigTransactionDetail} Returns the parsed multisig transaction detail account.
 */
export const parseMultisigTransactionDetail = (txDetailInfo: any): MultisigTransactionDetail => {
  try {
    const txDetail = {
      title: txDetailInfo?.title
        ? new TextDecoder('utf8').decode(
            Buffer.from(Uint8Array.of(...txDetailInfo.title.filter((b: number) => b !== 0)))
          )
        : '',
      description: txDetailInfo?.description
        ? new TextDecoder('utf8').decode(
            Buffer.from(Uint8Array.of(...txDetailInfo.description.filter((b: number) => b !== 0)))
          )
        : '',
      expirationDate:
        txDetailInfo?.expirationDate > 0 ? new Date(txDetailInfo.expirationDate.toNumber() * 1_000) : undefined
    } as MultisigTransactionDetail;

    return txDetail;
  } catch (err) {
    throw Error(`Multisig Transaction Error: ${err}`);
  }
};

/**
 * Gets the multisig transaction account summary
 *
 * @param {MultisigTransaction} transaction - The multisig transaction to get the summary.
 * @returns {MultisigTransactionSummary | undefined} Returns the multisig transaction summary.
 */
export const getMultisigTransactionSummary = (
  transaction: MultisigTransaction
): MultisigTransactionSummary | undefined => {
  try {
    let expDate =
      transaction.details && transaction.details.expirationDate
        ? transaction.details.expirationDate.getTime().toString().length > 13
          ? new Date(parseInt((transaction.details.expirationDate.getTime() / 1_000).toString())).toString()
          : transaction.details.expirationDate.toString()
        : '';

    let txSummary = {
      address: transaction.id.toBase58(),
      operation: transaction.operation.toString(),
      proposer: transaction.proposer ? transaction.proposer.toBase58() : '',
      title: transaction.details ? transaction.details.title : '',
      description: transaction.details ? transaction.details.description : '',
      createdOn: transaction.createdOn.toString(),
      executedOn: transaction.executedOn ? transaction.executedOn.toString() : '',
      expirationDate: expDate,
      approvals: transaction.signers.filter(s => s === true).length,
      multisig: transaction.multisig.toBase58(),
      status: transaction.status.toString(),
      didSigned: transaction.didSigned,
      instruction: parseMultisigTransactionInstruction(transaction)
    } as MultisigTransactionSummary;

    return txSummary;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return undefined;
  }
};

const parseMultisigTransactionInstruction = (transaction: MultisigTransaction): MultisigInstruction | null => {
  try {
    let ixAccInfos: InstructionAccount[] = [];
    let accIndex = 0;

    for (let acc of transaction.accounts) {
      ixAccInfos.push({
        index: accIndex,
        label: '',
        address: acc.pubkey.toBase58()
      } as InstructionAccount);

      accIndex++;
    }

    // let ixDataInfos: InstructionDataInfo[] = [];
    let bufferStr = Buffer.from(transaction.data).toString('hex');
    let bufferStrArray: string[] = [];

    for (let i = 0; i < bufferStr.length; i += 2) {
      bufferStrArray.push(bufferStr.substring(i, i + 2));
    }

    let ixInfo = {
      programId: transaction.programId.toBase58(),
      accounts: ixAccInfos,
      data: [
        {
          index: 0,
          name: '',
          value: bufferStrArray.join(' ')
        } as InstructionParameter
      ]
    } as MultisigInstruction;

    return ixInfo;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return null;
  }
};

export const createAnchorProgram = (
  connection: Connection,
  programId: PublicKey,
  programIdl: Idl,
  commitment: Commitment = 'confirmed'
): Program<any> => {
  const opts = {
    skipPreflight: false,
    commitment: commitment || 'confirmed',
    preflightCommitment: commitment || 'confirmed',
    maxRetries: 3
  };

  const readOnlyWallet = Keypair.generate();
  const anchorWallet = {
    publicKey: new PublicKey(readOnlyWallet.publicKey),
    signAllTransactions: async (txs: any) => txs,
    signTransaction: async (tx: any) => tx
  };

  const provider = new AnchorProvider(connection, anchorWallet, opts);

  if (programId.equals(TOKEN_PROGRAM_ID)) {
    const coder = (): SplTokenCoder => {
      return new SplTokenCoder(programIdl);
    };

    return new Program<SplToken>(programIdl as SplToken, programId, provider, coder());
  }

  return new Program(programIdl, programId, provider);
};

/**
 * Parses a multisig transaction proposal
 *
 * @public
 * @param {MultisigTransaction} transaction - The multisig transaction proposal data
 * @param {PublicKey} multisigProgramId - The id of the multisig program.
 * @param {Program<any>} program - Anchor program involved in multisig transaction.
 * @returns {MultisigTransactionInstructionInfo | null} Returns a transaction for executing the transaction proposal.
 */
export const parseMultisigProposalIx = (
  transaction: MultisigTransaction,
  multisigProgramId: PublicKey,
  program?: Program<any> | undefined
): MultisigTransactionInstructionInfo | null => {
  try {
    const ix = new TransactionInstruction({
      programId: transaction.programId,
      keys: transaction.accounts,
      data: transaction.data
    });

    if (!program) {
      return getMultisigInstructionSummary(ix);
    }

    const ixName = getIxNameFromMultisigTransaction(transaction, program.idl);
    console.log('ixName', ixName);

    if (!ixName) {
      return getMultisigInstructionSummary(ix);
    }

    const coder = program.programId.equals(TOKEN_PROGRAM_ID)
      ? new MeanSplTokenInstructionCoder(program.idl)
      : new BorshInstructionCoder(program.idl);

    const dataEncoded = bs58.encode(ix.data);
    const dataDecoded = coder.decode(dataEncoded, 'base58');

    if (!dataDecoded) {
      return getMultisigInstructionSummary(ix);
    }

    const ixData = dataDecoded.data as any;

    const formattedData = coder.format(
      {
        name: dataDecoded.name,
        data: !program.programId.equals(multisigProgramId)
          ? ixData
          : {
              label: ixData['label'],
              threshold: ixData['threshold'],
              owners: []
            }
      },
      ix.keys
    );

    if (!formattedData) {
      return getMultisigInstructionSummary(ix);
    }

    if (program.programId.equals(multisigProgramId)) {
      for (const arg of formattedData.args) {
        if (arg.name === 'owners') {
          arg.data = ixData['owners'].map((o: any) => {
            return {
              label: o.name,
              type: 'string',
              data: o.address.toBase58()
            };
          });
        }
      }
    }

    const ixAccInfos: InstructionAccountInfo[] = [];
    let accIndex = 0;

    for (const acc of ix.keys) {
      ixAccInfos.push({
        index: accIndex,
        label: formattedData.accounts[accIndex].name,
        value: acc.pubkey.toBase58()
      } as InstructionAccountInfo);

      accIndex++;
    }

    const dataInfos: InstructionDataInfo[] = [];
    let dataIndex = 0;

    for (const dataItem of formattedData.args) {
      dataInfos.push({
        label: `${dataItem.name[0].toUpperCase()}${dataItem.name.substring(1)}`,
        value: dataItem.data,
        index: dataIndex
      } as InstructionDataInfo);
      dataIndex++;
    }

    const nameArray = (program?.idl.name as string).split('_');
    const ixInfo = {
      programId: ix.programId.toBase58(),
      programName: nameArray.map(i => `${i[0].toUpperCase()}${i.substring(1)}`).join(' '),
      accounts: ixAccInfos,
      data: dataInfos
    } as MultisigTransactionInstructionInfo;

    return ixInfo;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return null;
  }
};

export const parseMultisigSystemProposalIx = (
  transaction: MultisigTransaction
): MultisigTransactionInstructionInfo | null => {
  try {
    const ix = new TransactionInstruction({
      programId: transaction.programId,
      keys: transaction.accounts,
      data: transaction.data
    });

    const ixName = getIxNameFromMultisigTransaction(transaction);

    if (!ixName) {
      return getMultisigInstructionSummary(ix);
    }

    const coder = new MeanSystemInstructionCoder();

    const dataDecoded = coder.decode(ix.data);

    if (!dataDecoded) {
      return getMultisigInstructionSummary(ix);
    }

    const ixData = dataDecoded.data as any;

    const formattedData = coder.format(
      {
        name: dataDecoded.name,
        data: ixData
      },
      ix.keys
    );

    if (!formattedData) {
      return getMultisigInstructionSummary(ix);
    }

    const ixAccInfos: InstructionAccountInfo[] = [];
    let accIndex = 0;

    for (const acc of ix.keys) {
      ixAccInfos.push({
        index: accIndex,
        label: formattedData.accounts[accIndex].name,
        value: acc.pubkey.toBase58()
      } as InstructionAccountInfo);

      accIndex++;
    }

    const dataInfos: InstructionDataInfo[] = [];
    let dataIndex = 0;

    for (const dataItem of formattedData.args) {
      dataInfos.push({
        label: `${dataItem.name[0].toUpperCase()}${dataItem.name.substring(1)}`,
        value: dataItem.data,
        index: dataIndex
      } as InstructionDataInfo);
      dataIndex++;
    }

    const ixInfo = {
      programId: ix.programId.toBase58(),
      programName: 'System Program',
      accounts: ixAccInfos,
      data: dataInfos
    } as MultisigTransactionInstructionInfo;

    return ixInfo;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return null;
  }
};

export const getIxNameFromMultisigTransaction = (transaction: MultisigTransaction, programIdl?: Idl) => {
  let ix: any;

  if (!programIdl) {
    switch (transaction.operation) {
      case OperationType.Transfer:
      case OperationType.TransferTokens:
        ix = 'transfer';
        break;
      default:
        ix = undefined;
    }
    return ix;
  }

  switch (transaction.operation) {
    // System Program
    case OperationType.Transfer:
      ix = 'transfer';
      break;
    // MEan Multisig
    case OperationType.EditMultisig:
      ix = programIdl.instructions.find(ix => ix.name === 'editMultisig');
      break;
    // SPL Token
    case OperationType.TransferTokens:
      ix = programIdl.instructions.find(ix => ix.name === 'transfer');
      break;
    case OperationType.SetAssetAuthority:
      ix = programIdl.instructions.find(ix => ix.name === 'setAuthority');
      break;
    case OperationType.CloseTokenAccount:
    case OperationType.DeleteAsset:
      ix = programIdl.instructions.find(ix => ix.name === 'closeAccount');
      break;
    // MSP
    case OperationType.TreasuryCreate:
      ix = programIdl.instructions.find(ix => ix.name === 'createTreasury');
      break;
    case OperationType.TreasuryStreamCreate:
      ix = programIdl.instructions.find(ix => ix.name === 'createStream');
      break;
    case OperationType.TreasuryRefreshBalance:
      ix = programIdl.instructions.find(ix => ix.name === 'refreshTreasuryData');
      break;
    case OperationType.TreasuryAddFunds:
      ix = programIdl.instructions.find(ix => ix.name === 'addFunds');
      break;
    case OperationType.TreasuryClose:
      ix = programIdl.instructions.find(ix => ix.name === 'closeTreasury');
      break;
    case OperationType.TreasuryWithdraw:
      ix = programIdl.instructions.find(ix => ix.name === 'treasuryWithdraw');
      break;
    case OperationType.StreamCreate:
      ix = programIdl.instructions.find(ix => ix.name === 'createStream');
      break;
    case OperationType.StreamAddFunds:
      ix = programIdl.instructions.find(ix => ix.name === 'allocate');
      break;
    case OperationType.StreamPause:
      ix = programIdl.instructions.find(ix => ix.name === 'pauseStream');
      break;
    case OperationType.StreamResume:
      ix = programIdl.instructions.find(ix => ix.name === 'resumeStream');
      break;
    case OperationType.StreamClose:
      ix = programIdl.instructions.find(ix => ix.name === 'closeStream');
      break;
    case OperationType.StreamWithdraw:
      ix = programIdl.instructions.find(ix => ix.name === 'withdraw');
      break;
    case OperationType.StreamTransferBeneficiary:
      ix = programIdl.instructions.find(ix => ix.name === 'transferStream');
      break;
    // CREDIX
    case OperationType.CredixDepositFunds:
      ix = programIdl.instructions.find(ix => ix.name === 'depositFunds');
      break;
    case OperationType.CredixWithdrawFunds:
    case OperationType.CredixRedeemFundsForWithdrawRequest:
      ix = programIdl.instructions.find(ix => ix.name === 'withdrawFunds' || ix.name === 'createWithdrawRequest');
      break;
    case OperationType.CredixDepositTranche:
      ix = programIdl.instructions.find(ix => ix.name === 'depositTranche');
      break;
    case OperationType.CredixWithdrawTranche:
      ix = programIdl.instructions.find(ix => ix.name === 'withdrawTranche');
      break;
    default:
      ix = undefined;
  }

  if (typeof ix === 'string') {
    return ix.length ? ix : '';
  }

  return ix ? ix.name : '';
};

export const getMultisigInstructionSummary = (
  instruction: TransactionInstruction
): MultisigTransactionInstructionInfo | null => {
  try {
    const ixAccInfos: InstructionAccountInfo[] = [];
    let accIndex = 0;

    for (const acc of instruction.keys) {
      ixAccInfos.push({
        index: accIndex,
        label: '',
        value: acc.pubkey.toBase58()
      } as InstructionAccountInfo);

      accIndex++;
    }

    const bufferStr = Buffer.from(instruction.data).toString('hex');
    const bufferStrArray: string[] = [];

    for (let i = 0; i < bufferStr.length; i += 2) {
      bufferStrArray.push(bufferStr.substring(i, i + 2));
    }

    const ixInfo = {
      programId: instruction.programId.toBase58(),
      accounts: ixAccInfos,
      data: [
        {
          label: '',
          value: bufferStrArray.join(' ')
        } as InstructionDataInfo
      ]
    } as MultisigTransactionInstructionInfo;

    return ixInfo;
  } catch (err: any) {
    console.error(`Multisig Instruction Summary: ${err}`);
    return null;
  }
};

export const sentenceCase = (field: string): string => {
  const result = field.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};
