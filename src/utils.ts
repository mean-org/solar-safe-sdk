import {
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from '@solana/web3.js';
import { Idl, Program } from '@project-serum/anchor';
import {
  InstructionAccountArchived,
  InstructionParameterArchived,
  MultisigInfo,
  MultisigInstructionArchived,
  MultisigParticipant,
  MultisigTransactionArchived,
  MultisigTransactionDetail,
  MultisigTransactionFees,
  MultisigTransactionStatus,
  MultisigTransactionSummaryArchived,
  MULTISIG_ACTIONS,
} from './types';
import { MultisigTransactionActivityItem } from './types';

/**
 * Gets the multisig actions fees.
 *
 * @param {Program<Idl>} program - Multisig program instance
 * @param {MULTISIG_ACTIONS} action - Multisig action to get the fees for.
 * @returns {Promise<MultisigTransactionFees>} Returns a MultisigTransactionFees object.
 */
export const getFees = async (
  program: Program<Idl>,
  action: MULTISIG_ACTIONS,
): Promise<MultisigTransactionFees> => {
  let txFees: MultisigTransactionFees = {
    networkFee: 0.0,
    rentExempt: 0.0,
    multisigFee: 0.02,
  };

  switch (action) {
    case MULTISIG_ACTIONS.createMultisig: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          program.account.multisigV2.size,
        );
      break;
    }
    case MULTISIG_ACTIONS.createTransaction: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          1500,
        );
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
export const getTransactionStatus = (
  multisig: any,
  info: any,
  detail: any,
): MultisigTransactionStatus => {
  if (!multisig) {
    throw Error("Invalid parameter: 'multisig'");
  }

  const lastKnownStatus: number =
    info.lastKnownProposalStatus as MultisigTransactionStatus;

  const isTransactionExpired = () => {
    const expirationDate =
      detail && detail.expirationDate > 0
        ? new Date(detail.expirationDate.toNumber() * 1_000)
        : undefined;
    return expirationDate && expirationDate.getTime() < Date.now();
  };

  const isTransactionVoided = () => {
    return multisig.ownerSetSeqno !== info.account.ownerSetSeqno;
  };

  switch (lastKnownStatus) {
    case MultisigTransactionStatus.Executed:
      return lastKnownStatus;
    case MultisigTransactionStatus.Active:
    case MultisigTransactionStatus.Failed:
      if (isTransactionVoided()) return MultisigTransactionStatus.Voided;
      if (isTransactionExpired()) return MultisigTransactionStatus.Expired;
      return lastKnownStatus;
    case MultisigTransactionStatus.Passed:
      if (isTransactionVoided()) return MultisigTransactionStatus.Voided;
      if (isTransactionExpired()) return MultisigTransactionStatus.Expired;
      if (multisig.coolOffPeriodInSeconds > 0)
        return MultisigTransactionStatus.Queued;
    case MultisigTransactionStatus.Unknown:
    default:
      // to support older multisigs
      const executed =
        info.account.executedOn && info.account.executedOn.toNumber() > 0;
      if (executed) return MultisigTransactionStatus.Executed;
      if (isTransactionExpired()) return MultisigTransactionStatus.Expired;
      if (isTransactionVoided()) return MultisigTransactionStatus.Voided;

      let approvals = info.account.signers.filter(
        (s: number) => s === 1,
      ).length;

      if (multisig.threshold <= approvals) {
        return MultisigTransactionStatus.Passed;
      }

      let filteredOwners = multisig.owners.filter(
        (o: any) => !o.address.equals(PublicKey.default),
      );

      let rejections = info.account.signers.filter(
        (s: number) => s === 2,
      ).length;
      let max_aprovals =
        filteredOwners.filter((o: any) => o !== null).length - rejections;

      if (max_aprovals < multisig.threshold) {
        return MultisigTransactionStatus.Failed;
      }
      return MultisigTransactionStatus.Active;
  }
};

/**
 * Parses the multisig version 1 account.
 *
 * @param {PublicKey} programId - The id of the multisig program.
 * @param {any} info - Transaction account to get the status.
 * @returns {Promise<MultisigInfo | null>} Returns the parsed multisig account version 1.
 */
export const parseMultisigV1Account = async (
  programId: PublicKey,
  info: any,
): Promise<MultisigInfo | null> => {
  try {
    const [multisigSigner] = await PublicKey.findProgramAddress(
      [info.publicKey.toBuffer()],
      programId,
    );

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(
      info.account.label.length,
      info.account.label,
    ).filter(function (elem, index) {
      return elem !== 0;
    });

    for (let i = 0; i < info.account.owners.length; i++) {
      owners.push({
        address: info.account.owners[i].toBase58(),
        name:
          info.account.ownersNames &&
          info.account.ownersNames.length &&
          info.account.ownersNames[i].length > 0
            ? new TextDecoder().decode(
                Buffer.from(
                  Uint8Array.of(
                    ...info.account.ownersNames[i].filter((b: any) => b !== 0),
                  ),
                ),
              )
            : '',
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
export const parseMultisigV2Account = async (
  programId: PublicKey,
  info: any,
): Promise<MultisigInfo | null> => {
  try {
    const [multisigSigner] = await PublicKey.findProgramAddress(
      [info.publicKey.toBuffer()],
      programId,
    );

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(
      info.account.label.length,
      info.account.label,
    ).filter(function (elem, index) {
      return elem !== 0;
    });

    let filteredOwners = info.account.owners.filter(
      (o: any) => !o.address.equals(PublicKey.default),
    );

    for (let i = 0; i < filteredOwners.length; i++) {
      owners.push({
        address: filteredOwners[i].address.toBase58(),
        name:
          filteredOwners[i].name.length > 0
            ? new TextDecoder().decode(
                Buffer.from(
                  Uint8Array.of(
                    ...filteredOwners[i].name.filter((b: any) => b !== 0),
                  ),
                ),
              )
            : '',
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
      balance: 0,
      coolOffPeriodInSeconds: info.account.coolOffPeriodInSeconds.toNumber(),
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
 * @returns {MultisigTransactionArchived} Returns the parsed multisig transaction account.
 */
export const parseMultisigTransaction = (
  multisig: any,
  owner: PublicKey,
  txInfo: any,
  txDetailInfo: any,
): MultisigTransactionArchived => {
  try {
    let ownerIndex = multisig.owners.findIndex(
      (o: any) => o.address.toBase58() === owner.toBase58(),
    );

    const signers: (boolean | null)[] = [];
    const allSigners = txInfo.account.signers.slice(
      0,
      multisig.owners.filter((o: any) => !o.address.equals(PublicKey.default))
        .length,
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
      pdaTimestamp: txInfo.account.pdaTimestamp
        ? txInfo.account.pdaTimestamp.toNumber()
        : undefined,
      pdaBump: txInfo.account.pdaBump,
      data: txInfo.account.data,
      details: parseMultisigTransactionDetail(txDetailInfo),
    } as MultisigTransactionArchived);
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
  parsedTx: ParsedTransactionWithMeta,
): MultisigTransactionActivityItem | null => {
  let item: any = null;

  if (parsedTx.transaction.message.instructions.length === 0) {
    return item;
  }

  const ix =
    parsedTx.transaction.message.instructions.length === 1
      ? (parsedTx.transaction.message
          .instructions[0] as PartiallyDecodedInstruction)
      : parsedTx.transaction.message.instructions.length === 2
      ? (parsedTx.transaction.message
          .instructions[1] as PartiallyDecodedInstruction)
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
      : decodedIx.name === 'cancelTransaction'
      ? 'deleted'
      : 'rejected';

  const ownerInfo = owners.filter((o: any) =>
    ix.accounts.some(a => a.equals(o.address)),
  )[0];

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
            .decode(
              Buffer.from(
                Uint8Array.of(...ownerInfo.name.filter((i: number) => i !== 0)),
              ),
            )
            .trim(),
        },
  } as MultisigTransactionActivityItem;

  return item;
};

/**
 * Parses the multisig transaction detail account.
 *
 * @param {any} txDetailInfo - Transaction detail account to parse.
 * @returns {MultisigTransactionDetail} Returns the parsed multisig transaction detail account.
 */
export const parseMultisigTransactionDetail = (
  txDetailInfo: any,
): MultisigTransactionDetail => {
  try {
    const txDetail = {
      title:
        txDetailInfo && txDetailInfo.title
          ? new TextDecoder('utf8').decode(
              Buffer.from(
                Uint8Array.of(
                  ...txDetailInfo.title.filter((b: number) => b !== 0),
                ),
              ),
            )
          : '',
      description:
        txDetailInfo && txDetailInfo.description
          ? new TextDecoder('utf8').decode(
              Buffer.from(
                Uint8Array.of(
                  ...txDetailInfo.description.filter((b: number) => b !== 0),
                ),
              ),
            )
          : '',
      expirationDate:
        txDetailInfo && txDetailInfo.expirationDate > 0
          ? new Date(txDetailInfo.expirationDate.toNumber() * 1_000)
          : undefined,
    } as MultisigTransactionDetail;

    return txDetail;
  } catch (err) {
    throw Error(`Multisig Transaction Error: ${err}`);
  }
};

/**
 * Gets the multisig transaction account summary
 *
 * @param {MultisigTransactionArchived} transaction - The multisig transaction to get the summary.
 * @returns {MultisigTransactionSummaryArchived | undefined} Returns the multisig transaction summary.
 */
export const getMultisigTransactionSummary = (
  transaction: MultisigTransactionArchived,
): MultisigTransactionSummaryArchived | undefined => {
  try {
    let expDate =
      transaction.details && transaction.details.expirationDate
        ? transaction.details.expirationDate.getTime().toString().length > 13
          ? new Date(
              parseInt(
                (
                  transaction.details.expirationDate.getTime() / 1_000
                ).toString(),
              ),
            ).toString()
          : transaction.details.expirationDate.toString()
        : '';

    let txSummary = {
      address: transaction.id.toBase58(),
      operation: transaction.operation.toString(),
      proposer: transaction.proposer ? transaction.proposer.toBase58() : '',
      title: transaction.details ? transaction.details.title : '',
      description: transaction.details ? transaction.details.description : '',
      createdOn: transaction.createdOn.toString(),
      executedOn: transaction.executedOn
        ? transaction.executedOn.toString()
        : '',
      expirationDate: expDate,
      approvals: transaction.signers.filter(s => s === true).length,
      multisig: transaction.multisig.toBase58(),
      status: transaction.status.toString(),
      didSigned: transaction.didSigned,
      instruction: parseMultisigTransactionInstruction(transaction),
    } as MultisigTransactionSummaryArchived;

    return txSummary;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return undefined;
  }
};

const parseMultisigTransactionInstruction = (
  transaction: MultisigTransactionArchived,
): MultisigInstructionArchived | null => {
  try {
    let ixAccInfos: InstructionAccountArchived[] = [];
    let accIndex = 0;

    for (let acc of transaction.accounts) {
      ixAccInfos.push({
        index: accIndex,
        label: '',
        address: acc.pubkey.toBase58(),
      } as InstructionAccountArchived);

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
          value: bufferStrArray.join(' '),
        } as InstructionParameterArchived,
      ],
    } as MultisigInstructionArchived;

    return ixInfo;
  } catch (err: any) {
    console.error(`Parse Multisig Transaction: ${err}`);
    return null;
  }
};
