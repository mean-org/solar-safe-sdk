import { AccountMeta, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { MultisigParticipant } from "./types";

/**
 * Multisig interface
 * 
 * @interface: Multisig
 */
export interface Multisig {

    /**
     * Creates a new multisig account
     * 
     * @param: payer
     * @param: label
     * @param: threshold
     * @param: participants
     */
    createMultisig: (
        payer: PublicKey,
        label: string,
        // description: string | undefined,
        threshold: number,
        participants: MultisigParticipant[],

    ) => Promise<Transaction | null>,

    /**
     * Creates a multisig transaction proposal
     * 
     * @param: proposer
     * @param: title
     * @param: description
     * @param: expirationDate
     * @param: operation,
     * @param: multisig
     * @param: program
     * @param: accounts
     * @param: data
     * @param: preInstructions
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

    ) => Promise<Transaction | null>,

    /**
     * Cancels a multisig transaction proposal
     * 
     * @param: proposer
     * @param: transaction
     */
    cancelTransaction: (proposer: PublicKey, transaction: PublicKey) => Promise<Transaction | null>,

    /**
     * Approves a multisig transaction proposal
     * 
     * @param: owner
     * @param: transaction
     */
    approveTransaction: (owner: PublicKey, transaction: PublicKey) => Promise<Transaction | null>,

    /**
     * Executes a multisig transaction proposal
     * 
     * @param: owner
     * @param: transaction
     */
    executeTransaction: (owner: PublicKey, transaction: PublicKey) => Promise<Transaction | null>,
}