import { AnchorProvider, BN, BorshAccountsCoder, BorshInstructionCoder, Idl, Program, ProgramAccount, Provider, Wallet } from "@project-serum/anchor";
import { AccountMeta, Commitment, ConfirmedSignaturesForAddress2Options, Connection, ConnectionConfig, Finality, GetProgramAccountsConfig, GetProgramAccountsFilter, Keypair, PublicKey, PublicKeyInitData, SystemInstruction, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Multisig } from "./multisig";
import { MEAN_MULTISIG_OPS, MEAN_MULTISIG_PROGRAM, MultisigInfo, MultisigParticipant, MultisigTransaction, MultisigTransactionActivityItem } from "./types";
import { parseMultisigTransaction, parseMultisigTransactionActivity, parseMultisigV1Account, parseMultisigV2Account } from "./utils";
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
   * Gets the parsed multisig info of a specific multisig account address. 
   * 
   * @public
   * @param {PublicKey} id - The address of the multisig account.
   * @returns {Promise<MultisigInfo>} Returns a parsed multisig account.
   */
   getMultisig = async (address: PublicKey): Promise<MultisigInfo | null> => {

    try {
      
      let multisigAcc = await this.program.account.multisigV2.fetchNullable(address);

      if (!multisigAcc) {
        multisigAcc = await this.program.account.multisig.fetchNullable(address);

        if (!multisigAcc) { return null; }
      }

      let parsedMultisig: any;

      if (multisigAcc.version && multisigAcc.version === 2) {
        parsedMultisig = await parseMultisigV2Account(this.program.programId, {
          publicKey: address,
          account: multisigAcc
        });
      } else {
        parsedMultisig = await parseMultisigV1Account(this.program.programId, {
          publicKey: address,
          account: multisigAcc
        });
      }

      if (!parsedMultisig) { return null; }

      parsedMultisig["balance"] = await this.connection.getBalance(parsedMultisig.authority);

      return parsedMultisig;

    } catch (err: any) {
      console.error(`Get Multisig: ${err}`);
      return null;
    }
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
      let multisigInfoArray: MultisigInfo[] = [];

      for (let info of accounts) {
        const parsedMultisig = await parseMultisigV2Account(this.program.programId, info);
        if (parsedMultisig) {
          parsedMultisig["balance"] = await this.connection.getBalance(parsedMultisig.authority);
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
   * @param {PublicKey} transaction - The transaction account.
   * @param {PublicKey} owner - One of the owners of the multisig account where the transaction belongs.
   * @returns {Promise<MultisigTransaction>} Returns a parsed multisig transactions.
   */
  getMultisigTransaction = async (multisig: PublicKey, transaction: PublicKey, owner: PublicKey): Promise<MultisigTransaction | null> => {

    try {

      const multisigAcc = await this.program.account.multisigV2.fetchNullable(multisig);

      if (!multisigAcc) { throw Error(`Multisig account ${multisig.toBase58()} not found`); }

      const transactionAcc = await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) { throw Error(`Transaction account ${transaction.toBase58()} not found`); }

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId
      );

      const txDetail = await this.program.account.transactionDetail.fetchNullable(txDetailAddress);
      const tx = {
        publicKey: transaction,
        account: transactionAcc
      };

      const txInfo = parseMultisigTransaction(multisigAcc, owner, tx, txDetail);

      return txInfo;
      
    } catch (err: any) {
      console.error(`Get Multisig Transaction: ${err}`);
      return null;
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

      let txFilters: GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8, bytes: multisig.toString() } },
      ];

      const promises = [
        this.program.account.transaction.all(txFilters),
        this.program.account.transactionDetail.all()
      ];
    
      const [txs, details] = await Promise.all(promises);
      let transactions: MultisigTransaction[] = [];

      for (let tx of txs) {
          
        const [txDetailAddress] = await PublicKey.findProgramAddress(
          [multisig.toBuffer(), tx.publicKey.toBuffer()],
          this.program.programId
        );

        const detail = details.filter((d: ProgramAccount) => d.publicKey.equals(txDetailAddress))[0];

        if (detail) {
          let txInfo = parseMultisigTransaction(multisigAcc, owner, tx, detail.account);
          transactions.push(txInfo);
        }
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
   * Gets the list of activities of a specific transaction . 
   * 
   * @public
   * @param {PublicKey} transaction - The transaction account.
   * @param {string=} before - The item signature to start getting signatures from.
   * @param {number=} limit - The mac amount of items to retrieve.
   * @param {Finality | undefined} commitment - The transaction account.
   * @returns {Promise<MultisigTransactionActivityItem[]>} Returns a list of parsed multisig transaction activity.
   */
  getMultisigTransactionActivity = async (
    transaction: PublicKey,
    before: string = '',
    limit: number = 10,
    commitment?: Finality | undefined,

  ): Promise<any[]> => {
    
    try {

      const transactionAcc: any = await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) { throw Error(`Transaction account ${transaction.toBase58()} not found`); }

      const multisigAcc: any = await this.program.account.multisigV2.fetchNullable(transactionAcc.multisig);

      if (!multisigAcc) { throw Error(`Multisig account ${transactionAcc.multisig.toBase58()} not found`); }

      let activity: MultisigTransactionActivityItem[] = [];
      let finality = commitment !== undefined ? commitment : "finalized";
      let filter = { limit: limit } as ConfirmedSignaturesForAddress2Options;

      if (before) { filter['before'] = before };

      let signatures = await this
        .program
        .provider
        .connection
        .getConfirmedSignaturesForAddress2(
          transaction, 
          filter, 
          finality
        );

      let txs = await this
        .program
        .provider
        .connection
        .getParsedTransactions(
          signatures.map((s: any) => s.signature), 
          finality
        );
      
      const coder = new BorshInstructionCoder(this.program.idl);

      for (const tx of txs) {
        if (!tx) { continue; }
        const item = parseMultisigTransactionActivity(
          coder,
          multisigAcc.owners,
          tx
        );
        if (item) {
          activity.push(item);
        }
      }

      const sorted = activity.sort((a, b) => b.createdOn.getTime() - a.createdOn.getTime());
      sorted.forEach((item, index) => { item.index = index });

      return activity;

    } catch (err: any) {
      console.error(`List Multisig Transaction Activity: ${err}`);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[multisig]);

      return tx;

    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return null;
    }
  };

  /**
   * Creates a new multisig account with funds
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {number} lamports - The amount of lamports to fund the multisig.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions. 
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new multisig.
   */
  createFundedMultisig = async (
    payer: PublicKey,
    lamports: number,
    label: string,
    threshold: number,
    participants: MultisigParticipant[]

  ): Promise<Transaction | null> => {

    try {

      const multisig = Keypair.generate();
      const [multisigSigner, nonce] = await PublicKey.findProgramAddress(
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
        .postInstructions([
          SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: multisigSigner,
            lamports: lamports
          })
        ])
        .transaction();

      tx.feePayer = payer;
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Approve Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Rejects a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} owner - One of the owners of the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be approved.
   * @returns {Promise<Transaction | null>} Returns a transaction for rejecting the transaction proposal.
   */
   rejectTransaction = async (
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
        .reject()
        .accounts({
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Reject Transaction: ${err}`);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
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
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      return tx;

    } catch (err: any) {
      console.error(`Execute Create Money Stream Transaction: ${err}`);
      return null;
    }
  };
}