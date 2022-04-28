import { AnchorProvider, BN, Idl, Program, Provider } from "@project-serum/anchor";
import { AccountMeta, Commitment, Connection, ConnectionConfig, GetProgramAccountsFilter, Keypair, PublicKey, PublicKeyInitData, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Multisig } from "./multisig";
import { MEAN_MULTISIG_OPS, MEAN_MULTISIG_PROGRAM, MultisigParticipant, MultisigTransaction } from "./types";
import idl from "./idl";
import { parseMultisigTransaction, parseMultisigV1Account, parseMultisigV2Account } from "./utils";

/**
 * MeanMultisig class implementation
 */
export class MeanMultisig implements Multisig {
  
  private rpcUrl: string;
  private program: Program<Idl>;
  private provider: Provider;
  private connection: Connection;

  /**
   * MeanMultisig class ctor. Intitialize program and connection
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
   * Gets the multisigs for where a specific owner belongs to. 
   * If owner is undefined then gets all multisig accounts of the program.
   * 
   * @param: owner
   */
  getMultisigs = async (owner?: PublicKey | undefined): Promise<Multisig[]> => {

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
      let multisigInfoArray: Multisig[] = [];

      for (let info of accounts) {
        let parsedMultisig: any;
        if (info.account.version && info.account.version === 2) {
          parsedMultisig = await parseMultisigV2Account(this.program, info);
        } else {
          parsedMultisig = await parseMultisigV1Account(this.program, info);
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
   * @param: multisig
   */
  getMultisigTransactions = async (multisig: PublicKey | undefined): Promise<any> => {

    try {

      let filters: GetProgramAccountsFilter[] = [];

      if (multisig) {
        filters = [
          { dataSize: 1200 },
          { memcmp: { offset: 8, bytes: multisig.toString() } },
        ];
      }

      let transactions: MultisigTransaction[] = [];
      let txs = await this.program.account.transaction.all(filters);

      for (let tx of txs) {
          
        const multisigAddress = multisig ?? new PublicKey(tx.account.multisig as PublicKeyInitData);
        const [txDetailAddress] = await PublicKey.findProgramAddress(
          [multisigAddress.toBuffer(), tx.publicKey.toBuffer()],
          this.program.programId
        );

        const txDetail = await this.program.account.transactionDetail.fetchNullable(txDetailAddress);
        let txInfo = parseMultisigTransaction(multisig, /*owner,*/ tx, txDetail);
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
   * @param: payer
   * @param: label
   * @param: threshold
   * @param: participants
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
   * @param: proposer
   * @param: title
   * @param: description
   * @param: expirationDate
   * @param: operation
   * @param: program
   * @param: accounts
   * @param: data
   * @param: preInstructions
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
   * @param: proposer
   * @param: title
   * @param: description
   * @param: expirationDate
   * @param: operation
   * @param: program
   * @param: accounts
   * @param: data
   * @param: preInstructions
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
   * @param: proposer
   * @param: transaction
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
   * @param: owner
   * @param: transaction
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
   * @param: owner
   * @param: transaction
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
          pubkey: this.program.programId,
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
   * @param: owner
   * @param: transaction
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
          meta.pubkey.equals(owner) ? { ...meta, isSigner: false } : meta
        )
        .concat({
          pubkey: this.program.programId,
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