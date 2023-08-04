import {
  AccountMeta,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { MultisigParticipant } from "./types";

/**
 * Multisig interface
 *
 * @interface: Multisig
 */
export interface Multisig {
  /**
   * Creates a new multisig account with funds
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {number} lamports - The amount of lamports to fund the multisig.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions.
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @returns Promise<{
   *   transaction: Transaction;
   *   msAccount: PublicKey;
   *   msSignerAccount: PublicKey;
   * } | null> Returns a promise that resolves to an object or null.
   *
   * @property {Transaction} transaction - The transaction for creating a new multisig.
   * @property {PublicKey} msAccount - The multisig account public key.
   * @property {PublicKey} msSignerAccount - The multisig signer/vault account public key.
   */
  buildCreateFundedMultisigTransaction: (
    payer: PublicKey,
    lamports: number,
    label: string,
    threshold: number,
    participants: MultisigParticipant[]
  ) => Promise<{
    transaction: Transaction;
    msAccount: PublicKey;
    msSignerAccount: PublicKey;
  } | null>;

  /**
   * Creates a new multisig account
   * @deprecated This function will be removed in next major release, use `buildCreateFundedMultisigTransaction` instead.
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions.
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new multisig.
   */
  createMultisig: (
    payer: PublicKey,
    label: string,
    // description: string | undefined,
    threshold: number,
    participants: MultisigParticipant[]
  ) => Promise<Transaction | null>;

  /**
   * Creates a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} proposer - The proposer of the transaction proposal. The proposer has to be one of the owners in the multisig of the transaction proposal.
   * @param {string} title - The title of the transaction proposal.
   * @param {string | undefined} description - An optional description for the transaction proposal.
   * @param {Date | undefined} expirationDate - Optional transaction expiration date.
   * @param {number} operation - The itransaction nstruction identifier of the transaction proposal.
   * @param {PublicKey} program - The id of the program where the transaction instruction belongs to.
   * @param {AccountMeta[]} accounts - The accounts required by the transaction instruction to be executed.
   * @param {Buffer} data - The data required by the transaction instruction to be executed.
   * @param {TransactionInstruction[]} [preInstructions=[]] - Any required instruction that needs to be executed before creating the transaction proposal.
   * @returns Promise<{
   *   transaction: Transaction;
   *   proposalAccount: PublicKey;
   * } | null> Returns a promise that resolves to an object or null.
   *
   * @property {Transaction} transaction - The transaction for creating a proposal.
   * @property {PublicKey} proposalAccount - The proposal account public key.
   */
  buildCreateTransaction: (
    proposer: PublicKey,
    title: string,
    description: string | undefined,
    expirationDate: Date | undefined,
    operation: number,
    multisig: PublicKey,
    program: PublicKey,
    accounts: AccountMeta[],
    data: Buffer | undefined,
    preInstructions?: TransactionInstruction[]
  ) => Promise<{
    transaction: Transaction;
    proposalAccount: PublicKey;
  } | null>;

  /**
   * Creates a multisig transaction proposal
   * @deprecated This function will be removed in next major release, use `buildCreateTransaction` instead.
   *
   * @public
   * @param {PublicKey} proposer - The proposer of the transaction proposal. The proposer has to be one of the owners in the multisig of the transaction proposal.
   * @param {string} title - The title of the transaction proposal.
   * @param {string | undefined} description - An optional description for the transaction proposal.
   * @param {Date | undefined} expirationDate - Optional transaction expiration date.
   * @param {number} operation - The itransaction nstruction identifier of the transaction proposal.
   * @param {PublicKey} program - The id of the program where the transaction instruction belongs to.
   * @param {AccountMeta[]} accounts - The accounts required by the transaction instruction to be executed.
   * @param {Buffer} data - The data required by the transaction instruction to be executed.
   * @param {TransactionInstruction[]} [preInstructions=[]] - Any required instruction that needs to be executed before creating the transaction proposal.
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new transaction proposal.
   */
  createTransaction: (
    proposer: PublicKey,
    title: string,
    description: string | undefined,
    expirationDate: Date | undefined,
    operation: number,
    multisig: PublicKey,
    program: PublicKey,
    accounts: AccountMeta[],
    data: Buffer | undefined,
    preInstructions?: TransactionInstruction[]
  ) => Promise<Transaction | null>;

  /**
   * Cancels a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} proposer - The owner that created the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be canceled.
   * @returns {Promise<Transaction | null>} Returns a transaction for canceling the transaction proposal.
   */
  cancelTransaction: (
    proposer: PublicKey,
    transaction: PublicKey
  ) => Promise<Transaction | null>;

  /**
   * Approves a multisig transaction proposal
   *
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be approved.
   * @returns {Promise<Transaction | null>} Returns a transaction for approving the transaction proposal.
   */
  approveTransaction: (
    owner: PublicKey,
    transaction: PublicKey
  ) => Promise<Transaction | null>;

  /**
   * Rejects a multisig transaction proposal
   *
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be approved.
   * @returns {Promise<Transaction | null>} Returns a transaction for approving the transaction proposal.
   */
  rejectTransaction: (
    owner: PublicKey,
    transaction: PublicKey
  ) => Promise<Transaction | null>;

  /**
   * Executes a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be executed.
   * @returns {Promise<Transaction | null>} Returns a transaction for executing the transaction proposal.
   */
  executeTransaction: (
    owner: PublicKey,
    transaction: PublicKey
  ) => Promise<Transaction>;
}
