import { AnchorProvider, BN, Idl, Program, Provider, Wallet } from "@project-serum/anchor";
import { AccountMeta, Commitment, Connection, ConnectionConfig, GetProgramAccountsFilter, Keypair, PublicKey, PublicKeyInitData, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Multisig } from "./multisig";
import { MEAN_MULTISIG_OPS, MEAN_MULTISIG_PROGRAM, MultisigInfo, MultisigParticipant, MultisigTransaction } from "./types";
import { parseMultisigTransaction, parseMultisigV1Account, parseMultisigV2Account } from "./utils";
import idl from "./idl";

/**
 * MeanMultisig class implementation
 * 
 * @implements {Multisig}
 */
export class MeanMultisig implements Multisig {
  
  /** @private */
  rpcUrl: string;
  /** @private */
  program: Program<Idl>;
  /** @private */
  provider: Provider;
  /** @private */
  connection: Connection;

  /**
   * MeanMultisig class ctor. Intitialize program and connection.
   * 
   * @constructor
   * @param {string} url - The RPC url to use to initialize the program.
   * @param {PublicKey} wallet - The wallet to use to initialize the program.
   * @param {Commitment | ConnectionConfig} commitment - The commitment to use in the connection.
   */
  constructor(
    url: string,
    wallet: PublicKey,
    commitment: Commitment | ConnectionConfig
  ) {
    const opts = AnchorProvider.defaultOptions();
    const anchorWallet = {
      publicKey: new PublicKey(wallet),
      signAllTransactions: async (txs: any) => txs,
      signTransaction: async (tx: any) => tx,
    };

    this.rpcUrl = url;
    this.connection = new Connection(this.rpcUrl, commitment || opts.commitment);
    this.provider = new AnchorProvider(this.connection, anchorWallet, opts);
    this.program = new Program(idl, MEAN_MULTISIG_PROGRAM, this.provider);
  }

  /**
   * Gets the multisig program instance.
   * 
   * @returns The multisig program object.
   */
  getProgram = (): Program<Idl> => {
    return this.program;
  }

  /**
   * Gets the multisigs for where a specific owner belongs to. 
   * If owner is undefined then gets all multisig accounts of the program.
   * 
   * @public
   * @param {PublicKey=} owner - One of the owner of the multisig account.
   * @returns {Promise<MultisigInfo[]>} Returns a list of parsed multisig accounts.
   */
  getMultisigs = async (owner?: PublicKey | undefined): Promise<MultisigInfo[]> => {

    try {
      // Get accounts
      let accounts: any[] = [];
      let multisigV2Accs = await this.program.account.multisigV2.all();
      let filteredAccs = multisigV2Accs.filter((a: any) => {
        if (owner && a.account.owners.filter((o: any) => o.address.equals(owner)).length) {
          return true;
        }
        return false;
      });

      accounts.push(...filteredAccs);
      let multisigAccs = await this.program.account.multisig.all();
      filteredAccs = multisigAccs.filter((a: any) => {
        if (owner && a.account.owners.filter((o: PublicKey) => o.equals(owner)).length) {
          return true;
        }
        return false;
      });

      accounts.push(...filteredAccs);
      let multisigInfoArray: MultisigInfo[] = [];

      for (let info of accounts) {
        let parsedMultisig: any;
        if (info.account.version && info.account.version === 2) {
          parsedMultisig = await parseMultisigV2Account(this.program.programId, info);
        } else {
          parsedMultisig = await parseMultisigV1Account(this.program.programId, info);
        }

        if (parsedMultisig) {
          multisigInfoArray.push(parsedMultisig);
        }
      }

      const sortedArray = multisigInfoArray.sort(
        (a: any, b: any) => b.createdOnUtc.getTime() - a.createdOnUtc.getTime()
      );

      return sortedArray;

    } catch (err: any) {
      console.error(`List Multisigs: ${err}`);
      return [];
    }
  }

  /**
   * Gets the transactions for a specific multisig. 
   * If multisig is undefined then gets all transactions of the program
   * 
   * @public
   * @param {PublicKey} multisig - The multisig account where the transaction belongs.
   * @param {PublicKey} owner - One of the owners of the multisig account where the transaction belongs.
   * @returns {Promise<MultisigTransaction[]>} Returns a list of parsed multisig transactions.
   */
  getMultisigTransactions = async (multisig: PublicKey, owner: PublicKey): Promise<MultisigTransaction[]> => {

    try {

      const multisigAcc = await this.program.account.multisigV2.fetchNullable(multisig);

      if (!multisigAcc) { throw Error(`Multisig account ${multisig.toBase58()} not found`); }

      let filters: GetProgramAccountsFilter[] = [
        { dataSize: 1200 },
        { memcmp: { offset: 8, bytes: multisig.toString() } },
      ];

      let transactions: MultisigTransaction[] = [];
      let txs = await this.program.account.transaction.all(filters);

      for (let tx of txs) {
          
        const multisigAddress = multisig ?? new PublicKey(tx.account.multisig as PublicKeyInitData);
        const [txDetailAddress] = await PublicKey.findProgramAddress(
          [multisigAddress.toBuffer(), tx.publicKey.toBuffer()],
          this.program.programId
        );

        const txDetail = await this.program.account.transactionDetail.fetchNullable(txDetailAddress);
        let txInfo = parseMultisigTransaction(multisigAcc, owner, tx, txDetail);
        transactions.push(txInfo);
      }

      const sortedTxs = transactions.sort(
        (a, b) => b.createdOn.getTime() - a.createdOn.getTime()
      );

      return sortedTxs;
      
    } catch (err: any) {
      console.error(`List Multisig Transactions: ${err}`);
      return [];
    }
  }

  /**
   * Creates a new multisig account
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions. 
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new multisig.
   */
  createMultisig = async (
    payer: PublicKey,
    label: string,
    // description: string | undefined,
    threshold: number,
    participants: MultisigParticipant[]

  ): Promise<Transaction | null> => {

    try {

      const multisig = Keypair.generate();
      const [, nonce] = await PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        this.program.programId
      );

      const owners = participants.map((p: MultisigParticipant) => {
        return {
          address: new PublicKey(p.address),
          name: p.name,
        };
      });

      let tx = await this.program.methods
        .createMultisig(owners, new BN(threshold), nonce, label)
        .accounts({
          proposer: payer,
          multisig: multisig.publicKey,
          multisigOpsAccount: MEAN_MULTISIG_OPS,
          systemProgram: SystemProgram.programId,
        })
        .signers([multisig])
        .transaction();

      tx.feePayer = payer;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[multisig]);

      return tx;

    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return null;
    }
  };

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
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new transaction proposal.
   */
  createTransaction = async (
    proposer: PublicKey,
    title: string,
    description: string | undefined,
    expirationDate: Date | undefined,
    operation: number,
    multisig: PublicKey,
    program: PublicKey,
    accounts: AccountMeta[],
    data: Buffer | undefined,
    preInstructions: TransactionInstruction[] = []

  ): Promise<Transaction | null> => {

    try {

      const transaction = Keypair.generate();
      const txSize = 1200;
      const createIx = await this.program.account.transaction.createInstruction(
        transaction,
        txSize
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.publicKey.toBuffer()],
        this.program.programId
      );

      const expirationTime = parseInt(
        (expirationDate ? expirationDate.getTime() / 1_000 : 0).toString()
      );

      let tx = await this.program.methods
        .createTransaction(
          program,
          accounts,
          data,
          operation,
          title,
          description,
          new BN(expirationTime),
          new BN(0),
          new BN(0)
        )
        .accounts({
          multisig: multisig,
          transaction: transaction.publicKey,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          multisigOpsAccount: MEAN_MULTISIG_OPS,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([...preInstructions, createIx])
        .signers([transaction])
        .transaction();

      tx.feePayer = proposer;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[transaction]);

      return tx;

    } catch (err: any) {
      console.error(`Create Transaction: ${err}`);
      return null;
    }
  };

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
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new transaction proposal.
   */
  createMoneyStreamTransaction = async (
    proposer: PublicKey,
    title: string,
    description: string | undefined,
    expirationDate: Date | undefined,
    pdaTimestamp: number,
    pdaBump: number,
    operation: number,
    multisig: PublicKey,
    program: PublicKey,
    accounts: AccountMeta[],
    data: Buffer | undefined,
    preInstructions: TransactionInstruction[] = []

  ): Promise<Transaction | null> => {

    try {

      const transaction = Keypair.generate();
      const txSize = 1200;
      const createIx = await this.program.account.transaction.createInstruction(
        transaction,
        txSize
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.publicKey.toBuffer()],
        this.program.programId
      );

      const expirationTime = parseInt(
        (expirationDate ? expirationDate.getTime() / 1_000 : 0).toString()
      );

      let tx = await this.program.methods
        .createTransaction(
          program,
          accounts,
          data,
          operation,
          title,
          description,
          new BN(expirationTime),
          new BN(pdaTimestamp),
          new BN(pdaBump)
        )
        .accounts({
          multisig: multisig,
          transaction: transaction.publicKey,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          multisigOpsAccount: MEAN_MULTISIG_OPS,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([...preInstructions, createIx])
        .signers([transaction])
        .transaction();

      tx.feePayer = proposer;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[transaction]);

      return tx;

    } catch (err: any) {
      console.error(`Create Money Stream Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Cancels a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} proposer - The owner that created the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be canceled.
   * @returns {Promise<Transaction | null>} Returns a transaction for canceling the transaction proposal.
   */
  cancelTransaction = async (
    proposer: PublicKey,
    transaction: PublicKey

  ): Promise<Transaction | null> => {

    try {

      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment
      );

      if (!txAccount) {
        throw Error("Transaction proposal not found");
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId
      );

      let tx = await this.program.methods
        .cancelTransaction()
        .accounts({
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = proposer;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Cancel Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Approves a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be approved.
   * @returns {Promise<Transaction | null>} Returns a transaction for approving the transaction proposal.
   */
  approveTransaction = async (
    owner: PublicKey,
    transaction: PublicKey

  ): Promise<Transaction | null> => {
      
    try {

      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment
      );

      if (!txAccount) {
        throw Error("Transaction proposal not found");
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId
      );

      let tx = await this.program.methods
        .approve()
        .accounts({
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Approve Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Executes a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be executed.
   * @returns {Promise<Transaction | null>} Returns a transaction for executing the transaction proposal.
   */
  executeTransaction = async (
    owner: PublicKey,
    transaction: PublicKey

  ): Promise<Transaction | null> => {

    try {

      const txAccount: any = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment
      );

      if (!txAccount) {
        throw Error("Transaction proposal not found");
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [multisigSigner] = await PublicKey.findProgramAddress(
        [multisig.toBuffer()],
        this.program.programId
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId
      );

      let remainingAccounts = txAccount.accounts
        // Change the signer status on the vendor signer since it's signed by the program, not the client.
        .map((meta: any) =>
          meta.pubkey.equals(multisigSigner)
            ? { ...meta, isSigner: false }
            : meta
        )
        .concat({
          pubkey: txAccount.programId,
          isWritable: false,
          isSigner: false,
        });

      let tx = await this.program.methods
        .executeTransaction()
        .accounts({
          multisig: multisig,
          multisigSigner: multisigSigner,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          payer: owner,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Execute Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Executes a multisig transaction proposal (Special case for Money Stream creation)
   *
   * @public
   * @param {PublicKey} owner - One of the owners of the `Create Money Stream` transaction proposal.
   * @param {PublicKey} transaction - The `Create Money Stream` transaction proposal to be executed.
   * @returns {Promise<Transaction | null>} Returns a transaction for executing a `Create Money Stream` transaction proposal.
   */
  executeCreateMoneyStreamTransaction = async (
    owner: PublicKey,
    transaction: PublicKey

  ): Promise<Transaction | null> => {

    try {

      const txAccount: any = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment
      );

      if (!txAccount) {
        throw Error("Transaction proposal not found");
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [multisigSigner] = await PublicKey.findProgramAddress(
        [multisig.toBuffer()],
        this.program.programId
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId
      );

      let remainingAccounts = txAccount.accounts
        // Change the signer status on the vendor signer since it's signed by the program, not the client.
        .map((meta: any) =>
          !meta.pubkey.equals(owner) ? { ...meta, isSigner: false } : meta
        )
        .concat({
          pubkey: txAccount.programId,
          isWritable: false,
          isSigner: false,
        });

      const streamPda = remainingAccounts[7].pubkey;

      let tx = await this.program.methods
        .executeTransactionPda(txAccount.pdaTimestamp, txAccount.pdaBump)
        .accounts({
          multisig: multisig,
          multisigSigner: multisigSigner,
          pdaAccount: streamPda,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          payer: owner,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Execute Create Money Stream Transaction: ${err}`);
      return null;
    }
  };
}