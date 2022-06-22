import { PublicKey } from "@solana/web3.js";

export const MEAN_MULTISIG_PROGRAM = new PublicKey("FF7U7Vj1PpBkTPau7frwLLrUHrjkxTQLsH7U5K3T3B3j");
export const MEAN_MULTISIG_OPS = new PublicKey("3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw");
export const LAMPORTS_PER_SIG = 5000;
export const DEFAULT_EXPIRATION_TIME_SECONDS = 604800;

/**
 * `MultisigTransactionStatus`
 * 
 * @enum {number}
 */
export enum MultisigTransactionStatus {
  /** No enough signatures */
  Pending = 0,
  /** Approved by the required amount of signers */
  Approved = 1,
  /** Successfully executed (didExecute = true) */
  Executed = 2,
  /** Rejected by any owner */
  Rejected = 3,
  /** Invalid owners set seq number */
  Voided = 4,
  /** Proposal has expired */
  Expired = 5,
  /** Pending for exxecution */
  Queued = 6,
}

/**
 * `MULTISIG_ACTIONS`
 * 
 * @enum {number}
 */
export enum MULTISIG_ACTIONS {
  createMultisig = 1,
  editMultisig = 2,
  createTransaction = 3,
  cancelTransaction = 4,
  approveTransaction = 5,
  executeTransaction = 6,
}

/**
 * `MultisigTransactionFees` type definition
 * 
 * @type {MultisigTransactionFees}
 */
export type MultisigTransactionFees = {
  networkFee: number;
  rentExempt: number;
  multisigFee: number;
};

/**
 * `MultisigInfo` type definition
 * 
 * @type {MultisigInfo}
 */
export type MultisigInfo = {
  id: PublicKey;
  label: string;
  description?: string;
  balance: number;
  authority: PublicKey;
  owners: MultisigParticipant[];
  threshold: number;
  nounce: number;
  ownerSetSeqno: number;
  createdOnUtc: Date;
  pendingTxsAmount: number;
  version: number;
};

/**
 * `MultisigTransaction` type definition
 * 
 * @type {MultisigTransaction}
 */
export type MultisigTransaction = {
  id: PublicKey;
  operation: number;
  multisig: PublicKey;
  programId: PublicKey;
  signers: (boolean | null)[];
  createdOn: Date;
  executedOn: Date | undefined;
  ownerSetSeqno: number;
  status: MultisigTransactionStatus;
  accounts: any[];
  data: Buffer;
  proposer: PublicKey | undefined;
  pdaTimestamp: number | undefined;
  pdaBump: number | undefined;
  details: MultisigTransactionDetail;
  didSigned: boolean | null;
};

/**
 * `MultisigTransactionActivity` type definition
 * 
 * @type {MultisigTransactionActivityItem}
 */
export type MultisigTransactionActivityItem = {
  index: number;
  address: string;
  action: string;
  createdOn: Date;
  owner: any;
}

/**
 * `MultisigParticipant` type definition
 * 
 * @type {MultisigParticipant}
 */
export type MultisigParticipant = {
  address: string;
  name: string;
};

/**
 * `MultisigTransactionDetail` type definition
 * 
 * @type {MultisigTransactionDetail}
 */
export type MultisigTransactionDetail = {
  title: string;
  description: string;
  expirationDate: Date | undefined;
};

/**
 * `MultisigTransactionSummary` type definition
 * 
 * @type {MultisigTransactionSummary}
 */
export type MultisigTransactionSummary = {
  address: string;
  operation: string;
  multisig: string;
  approvals: number;
  createdOn: string;
  executedOn: string;
  status: string;
  proposer: string;
  title: string;
  description: string;
  expirationDate: string;
  didSigned: boolean;
  instruction: MultisigInstruction;
};

export type MultisigInstruction = {
  programId: string;
  accounts: InstructionAccount[];
  data: InstructionParameter[];
};

export type InstructionAccount = {
  label: string;
  address: string;
};

export type InstructionParameter = {
  name: string;
  value: any;
};
