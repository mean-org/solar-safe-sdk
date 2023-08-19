import { PublicKey } from '@solana/web3.js';

export const MEAN_MULTISIG_PROGRAM = new PublicKey('FF7U7Vj1PpBkTPau7frwLLrUHrjkxTQLsH7U5K3T3B3j');
export const MEAN_MULTISIG_OPS = new PublicKey('3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw');
export const LAMPORTS_PER_SIG = 5000;
export const DEFAULT_EXPIRATION_TIME_SECONDS = 604800;
export const ACCOUNT_REPLACEMENT_PLACEHOLDER = new PublicKey('NewPubkey1111111111111111111111111111111111');

/**
 * `MultisigTransactionStatus`
 *
 * @enum {number}
 */
export enum MultisigTransactionStatus {
  /** No enough signatures */
  Active = 0,
  /** Approved by the required amount of signers */
  Passed = 1,
  /** Successfully executed */
  Executed = 2,
  /** Rejected by the majority of owners */
  Failed = 3,
  /** Invalid owners set seq number */
  Voided = 4,
  /** Proposal has expired */
  Expired = 5,
  /** Pending for execution */
  Queued = 6
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
  executeTransaction = 6
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
};

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

export type InstructionAccountInfo = {
  index: number;
  label: string;
  value: string;
};

export type InstructionDataInfo = {
  index: number;
  label: string;
  value: any;
};

/**
 * `MultisigTransactionInstructionInfo` type definition
 *
 * @type {MultisigTransactionInstructionInfo}
 */
export type MultisigTransactionInstructionInfo = {
  programId: string;
  programName: string;
  accounts: InstructionAccountInfo[];
  data: InstructionDataInfo[];
};

export enum TransactionStatus {
  Iddle = 0,
  WalletNotFound = 1,
  TransactionStart = 2,
  TransactionStarted = 3,
  TransactionStartFailure = 4,
  InitTransaction = 5,
  InitTransactionSuccess = 6,
  InitTransactionFailure = 7,
  SignTransaction = 8,
  SignTransactionSuccess = 9,
  SignTransactionFailure = 10,
  SendTransaction = 11,
  SendTransactionSuccess = 12,
  SendTransactionFailure = 13,
  ConfirmTransaction = 14,
  ConfirmTransactionSuccess = 15,
  ConfirmTransactionFailure = 16,
  TransactionFinished = 17,
  SendTransactionFailureByMinimumAmount = 18,
  CreateRecurringBuySchedule = 19,
  CreateRecurringBuyScheduleSuccess = 20,
  CreateRecurringBuyScheduleFailure = 21,
  FeatureTemporarilyDisabled = 50
}

/**
 * `OperationType` enum definition
 *
 * @enum {OperationType}
 */
export enum OperationType {
  Transfer = 0,
  // Stream options
  StreamCreate = 1,
  StreamAddFunds = 2,
  StreamWithdraw = 3,
  StreamClose = 4,
  StreamPause = 5,
  StreamResume = 6,
  StreamTransferBeneficiary = 7,
  StreamCreateWithTemplate = 8,
  // Treasury options
  TreasuryCreate = 10,
  TreasuryStreamCreate = 11,
  TreasuryAddFunds = 12,
  TreasuryWithdraw = 13,
  TreasuryClose = 14,
  TreasuryRefreshBalance = 15,
  TreasuryEdit = 16,
  // DDCA Options
  DdcaCreate = 20,
  DdcaAddFunds = 21,
  DdcaWithdraw = 22,
  DdcaClose = 23,
  // Multisig options
  CreateMultisig = 30,
  EditMultisig = 31,
  CreateMint = 32,
  MintTokens = 33,
  TransferTokens = 34,
  SetMintAuthority = 35,
  UpgradeProgram = 36,
  UpgradeIDL = 37,
  SetMultisigAuthority = 38,
  SetAssetAuthority = 39,
  ApproveTransaction = 40,
  ExecuteTransaction = 41,
  CancelTransaction = 42,
  DeleteAsset = 43,
  CreateTransaction = 44,
  RejectTransaction = 45,
  UpdateSettings = 46,
  Custom = 49,
  // Tools
  Wrap = 50,
  Unwrap = 51,
  Swap = 52,
  CreateAsset = 53,
  CloseTokenAccount = 54,
  MergeTokenAccounts = 55,
  // Invest
  Stake = 60,
  Unstake = 61,
  Deposit = 62,
  // Credix
  CredixDepositFunds = 110,
  CredixWithdrawFunds = 111,
  CredixDepositTranche = 112,
  CredixWithdrawTranche = 113,
  CredixRedeemFundsForWithdrawRequest = 114
}
