import { PublicKey, Transaction } from "@solana/web3.js";
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
     * @param: label
     * @param: description
     * @param: threshold
     * @param: participants
     */
    createMultisig: (
        label: string,
        description: string | undefined,
        threshold: number,
        participants: MultisigParticipant[],

    ) => Promise<Transaction>,

    /**
     * Creates a multisig transaction proposal
     * 
     * @param: proposer
     * @param: title
     * @param: description
     * @param: expirationDate
     * @param: program
     * @param: accounts
     * @param: data
     */
    createTransaction: (
        proposer: PublicKey,
        title: string,
        description: string | undefined,
        expirationDate: Date | undefined,
        program: PublicKey,
        accounts: PublicKey[],
        data: Buffer | string | undefined

    ) => Promise<Transaction>,

    /**
     * Cancels a multisig transaction proposal
     * 
     * @param: proposer
     * @param: transaction
     */
    cancelTransaction: (proposer: PublicKey, transaction: PublicKey) => Promise<Transaction>,

    /**
     * Approves a multisig transaction proposal
     * 
     * @param: owner
     * @param: transaction
     */
    approveTransaction: (owner: PublicKey, transaction: PublicKey) => Promise<Transaction>

    /**
     * Executes a multisig transaction proposal
     * 
     * @param: owner
     * @param: transaction
     */
    executeTransaction: (owner: PublicKey, transaction: PublicKey) => Promise<Transaction>

}