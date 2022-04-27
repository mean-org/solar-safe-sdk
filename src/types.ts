import { PublicKey } from "@solana/web3.js";

export const MEAN_MULTISIG_OPS = new PublicKey("3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw");
export const LAMPORTS_PER_SIG = 5000;
export const DEFAULT_EXPIRATION_TIME_SECONDS = 604800;

export enum MultisigTransactionStatus {
  // No enough signatures
  Pending = 0,
  // Approved by the required amount of signers
  Approved = 1,
  // Successfully executed (didExecute = true)
  Executed = 2,
  // Rejected by any owner
  Rejected = 3,
  // Invalid owners set seq number
  Voided = 4,
  // Proposal has expired
  Expired = 5,
  //
  Queued = 6,
}

export enum MULTISIG_ACTIONS {
  createMultisig = 1,
  editMultisig = 2,
  createTransaction = 3,
  cancelTransaction = 4,
  approveTransaction = 5,
  executeTransaction = 6,
}

export type MultisigTransactionFees = {
  networkFee: number;
  rentExempt: number;
  multisigFee: number;
};

export type Multisig = {
  id: PublicKey;
  label: string;
  description?: string;
  authority: PublicKey;
  owners: MultisigParticipant[];
  threshold: number;
  nounce: number;
  ownerSeqNumber: number;
  createdOnUtc: Date;
  pendingTxsAmount: number;
  version: number;
};

export type MultisigTransaction = {
  id: PublicKey;
  operation: number;
  multisig: PublicKey;
  programId: PublicKey;
  signers: boolean[];
  createdOn: Date;
  executedOn: Date | undefined;
  ownerSeqNumber: number;
  status: MultisigTransactionStatus;
  accounts: any[];
  data: Buffer;
  proposer: PublicKey | undefined;
  pdaTimestamp: number | undefined;
  pdaBump: number | undefined;
  details: MultisigTransactionDetail;
  didSigned: boolean;
};

export type MultisigParticipant = {
  address: string;
  name: string;
};

export type MultisigTransactionDetail = {
  title: string;
  description: string;
  expirationDate: Date | undefined;
};

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

export type MultisigIntegration = {
  program: InstructionProgram;
  instructions: MultisigInstruction[];
};

export type MultisigInstruction = {
  name: string;
  accounts: InstructionAccount[];
  data: InstructionParameter[];
};

export type InstructionProgram = {
  name: string;
  address: string;
};

export type InstructionAccount = {
  index: number;
  label: string;
  address: string;
};

export type InstructionParameter = {
  index: number;
  name: string;
  value: any;
};
