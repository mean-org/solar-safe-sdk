import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Idl, Program } from "@project-serum/anchor";
import { Multisig, MultisigParticipant, MultisigTransaction, MultisigTransactionDetail, MultisigTransactionFees, MultisigTransactionStatus, MULTISIG_ACTIONS } from "./types";

/**
 * Gets the multisig actions fees.
 * 
 * @param {Program<Idl>} program - Multisig program instance
 * @param {MULTISIG_ACTIONS} action - Multisig action to get the fees for.
 * @returns {Promise<MultisigTransactionFees>} Returns a MultisigTransactionFees object.
 */
export const getFees = async (
  program: Program<Idl>,
  action: MULTISIG_ACTIONS

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
          program.account.multisigV2.size
        );
      break;
    }
    case MULTISIG_ACTIONS.createTransaction: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          1500
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
  detail: any

): MultisigTransactionStatus => {

  try {

    if (!multisig) {
      throw Error("Invalid parameter: 'multisig'");
    }

    const executed = info.account.executedOn && info.account.executedOn.toNumber() > 0;

    if (executed) {
      return MultisigTransactionStatus.Executed;
    }

    const expirationDate =
      !executed && detail && detail.expirationDate > 0
        ? new Date(detail.expirationDate.toNumber() * 1_000)
        : undefined;

    if (expirationDate && expirationDate.getTime() < Date.now()) {
      return MultisigTransactionStatus.Expired;
    }

    let status = MultisigTransactionStatus.Pending;
    let approvals = info.account.signers.filter(
      (s: boolean) => s === true
    ).length;

    if (multisig && multisig.threshold === approvals) {
      status = MultisigTransactionStatus.Approved;
    }

    if (multisig && multisig.ownerSeqNumber !== info.account.ownerSetSeqno) {
      status = MultisigTransactionStatus.Voided;
    }

    return status;

  } catch (err) {
    throw Error(`Multisig Transaction Status: ${err}`);
  }
};

/**
 * Parses the multisig version 1 account.
 * 
 * @param {PublicKey} programId - The id of the multisig program.
 * @param {any} info - Transaction account to get the status.
 * @returns {Promise<Multisig | null>} Returns the parsed multisig account version 1.
 */
export const parseMultisigV1Account = async (
  programId: PublicKey,
  info: any

): Promise<Multisig | null> => {
  try {

    const [multisigSigner] = await PublicKey.findProgramAddress(
      [info.publicKey.toBuffer()],
      programId
    );

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(
      info.account.label.length,
      info.account.label
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
                    ...info.account.ownersNames[i].filter((b: any) => b !== 0)
                  )
                )
              )
            : "",
      } as MultisigParticipant);
    }

    const multisig = {
      id: info.publicKey,
      version: info.account.version,
      label: new TextDecoder().decode(labelBuffer),
      authority: multisigSigner,
      nounce: info.account.nonce,
      ownerSeqNumber: info.account.ownerSetSeqno,
      threshold: info.account.threshold.toNumber(),
      pendingTxsAmount: info.account.pendingTxs.toNumber(),
      createdOnUtc: new Date(info.account.createdOn.toNumber() * 1000),
      owners: owners,
    } as Multisig;

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
 * @returns {Promise<Multisig | null>} Returns the parsed multisig account version 2.
 */
export const parseMultisigV2Account = async (
  programId: PublicKey,
  info: any

): Promise<Multisig | null> => {

  try {

    const [multisigSigner] = await PublicKey.findProgramAddress(
      [info.publicKey.toBuffer()],
      programId
    );

    let owners: MultisigParticipant[] = [];
    let labelBuffer = Buffer.alloc(
      info.account.label.length,
      info.account.label
    ).filter(function (elem, index) {
      return elem !== 0;
    });

    let filteredOwners = info.account.owners.filter(
      (o: any) => !o.address.equals(PublicKey.default)
    );

    for (let i = 0; i < filteredOwners.length; i++) {
      owners.push({
        address: filteredOwners[i].address.toBase58(),
        name:
          filteredOwners[i].name.length > 0
            ? new TextDecoder().decode(
                Buffer.from(
                  Uint8Array.of(
                    ...filteredOwners[i].name.filter((b: any) => b !== 0)
                  )
                )
              )
            : "",

      } as MultisigParticipant);
    }

    const multisig = {
      id: info.publicKey,
      version: info.account.version,
      label: new TextDecoder().decode(labelBuffer),
      authority: multisigSigner,
      nounce: info.account.nonce,
      ownerSeqNumber: info.account.ownerSetSeqno,
      threshold: info.account.threshold.toNumber(),
      pendingTxsAmount: info.account.pendingTxs.toNumber(),
      createdOnUtc: new Date(info.account.createdOn.toNumber() * 1000),
      owners: owners,

    } as Multisig;

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
 * @param {any} txInfo - Transaction account to parse.
 * @param {any} txDetailInfo - Transaction detail account to parse.
 * @returns {MultisigTransaction} Returns the parsed multisig transaction account.
 */
export const parseMultisigTransaction = (
  multisig: any,
//   owner: PublicKey,
  txInfo: any,
  txDetailInfo: any

): MultisigTransaction => {

  try {

    // let currentOwnerIndex = multisig.owners.findIndex(
    //   (o: any) => o.address === owner.toBase58()
    // );

    return Object.assign({}, {
      id: txInfo.publicKey,
      multisig: txInfo.account.multisig,
      programId: txInfo.account.programId,
      signers: txInfo.account.signers,
      ownerSeqNumber: txInfo.account.ownerSetSeqno,
      createdOn: new Date(txInfo.account.createdOn.toNumber() * 1000),
      executedOn:
        txInfo.account.executedOn && txInfo.account.executedOn > 0
          ? new Date(txInfo.account.executedOn.toNumber() * 1000)
          : undefined,
      status: getTransactionStatus(multisig, txInfo, txDetailInfo),
      operation: txInfo.account.operation,
      accounts: txInfo.account.accounts,
      didSigned: false,
      proposer: txInfo.account.proposer,
      pdaTimestamp: txInfo.account.pdaTimestamp
        ? txInfo.account.pdaTimestamp.toNumber()
        : undefined,
      pdaBump: txInfo.account.pdaBump,
      data: txInfo.account.data,
      details: parseMultisigTransactionDetail(txDetailInfo),

    } as MultisigTransaction);

  } catch (err) {
    throw Error(`Multisig Transaction Error: ${err}`);
  }
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
      title:
        txDetailInfo && txDetailInfo.title
          ? new TextDecoder("utf8").decode(
              Buffer.from(
                Uint8Array.of(
                  ...txDetailInfo.title.filter((b: number) => b !== 0)
                )
              )
            )
          : "",
      description:
        txDetailInfo && txDetailInfo.description
          ? new TextDecoder("utf8").decode(
              Buffer.from(
                Uint8Array.of(
                  ...txDetailInfo.description.filter((b: number) => b !== 0)
                )
              )
            )
          : "",
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
 * Checks if a transaction has been approved by a specific owner.
 * 
 * @param {PublicKey} owner - The owner of the multsig account where the transaction belongs.
 * @param {Multisig} multisig - The multsig account where the transaction belongs.
 * @param {MultisigTransaction} transaction - Transaction account to check if it was approved by the owner.
 * @returns {boolean} Returns `true` if the transaction was approved by the owner otherwise returns `false`.
 */
export const isTransactionApprovedBy = (
  owner: PublicKey,
  multisig: Multisig,
  transaction: MultisigTransaction

): boolean => {

  let ownerIndex = multisig.owners.findIndex(
    (o: any) => o.address === owner.toBase58()
  );

  return transaction.signers[ownerIndex];
};