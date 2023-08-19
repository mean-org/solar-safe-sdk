import {
  AnchorProvider,
  BN,
  BorshInstructionCoder,
  Program,
  ProgramAccount,
  Provider,
  IdlAccounts,
  IdlTypes
} from '@project-serum/anchor';
import {
  AccountMeta,
  Commitment,
  ConfirmedSignaturesForAddress2Options,
  Connection,
  ConnectionConfig,
  Finality,
  GetProgramAccountsFilter,
  Keypair,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { Multisig } from './multisig';
import {
  ACCOUNT_REPLACEMENT_PLACEHOLDER,
  MEAN_MULTISIG_OPS,
  MEAN_MULTISIG_PROGRAM,
  MultisigInfo,
  MultisigParticipant,
  MultisigTransaction,
  MultisigTransactionActivityItem,
  MultisigTransactionInstructionInfo
} from './types';
import {
  createAnchorProgram,
  parseMultisigProposalIx,
  parseMultisigSystemProposalIx,
  parseMultisigTransaction,
  parseMultisigTransactionActivity,
  parseMultisigV1Account,
  parseMultisigV2Account
} from './utils';
// import { IDL, MeanMultisig as IdlMultisig } from './idl';
import { utf8 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { IDL as SplTokenIdl } from '@project-serum/anchor/dist/cjs/spl/token';
import { IDL, IdlMultisig } from '.';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

type IdlTransaction = IdlAccounts<IdlMultisig>['transaction'];
type IdlTransactionAccount = IdlTypes<IdlMultisig>['TransactionAccount'];

/**
 * MeanMultisig class implementation
 *
 * @implements {Multisig}
 */
export class MeanMultisig implements Multisig {
  /** @private */
  rpcUrl: string;
  /** @private */
  program: Program<IdlMultisig>;
  /** @private */
  provider: Provider;
  /** @private */
  connection: Connection;
  /** @private */
  settings: PublicKey | undefined;
  /**
   * MeanMultisig class ctor. Intitialize program and connection.
   *
   * @constructor
   * @param {string} url - The RPC url to use to initialize the program.
   * @param {PublicKey} wallet - The wallet to use to initialize the program.
   * @param {Commitment | ConnectionConfig} commitment - The commitment to use in the connection.
   */
  constructor(url: string, wallet: PublicKey, commitment: Commitment | ConnectionConfig, programId?: PublicKey) {
    const opts = AnchorProvider.defaultOptions();
    const anchorWallet = {
      publicKey: new PublicKey(wallet),
      signAllTransactions: async (txs: any) => txs,
      signTransaction: async (tx: any) => tx
    };

    this.rpcUrl = url;
    this.connection = new Connection(this.rpcUrl, commitment || opts.commitment);
    this.provider = new AnchorProvider(this.connection, anchorWallet, opts);
    this.program = new Program(IDL, programId ?? MEAN_MULTISIG_PROGRAM, this.provider);
    console.log(`=========> MULTISIG CLIENT CREATED! ProgramID: ${programId}`);

    PublicKey.findProgramAddress([Buffer.from(utf8.encode('settings'))], this.program.programId)
      .then(([address]) => {
        this.settings = address;
      })
      .catch(err => console.error(err));
  }

  /**
   * Gets the multisig program instance.
   *
   * @returns The multisig program object.
   */
  getProgram = (): Program<IdlMultisig> => {
    return this.program;
  };

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
        return null;
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

      if (!parsedMultisig) {
        return null;
      }

      parsedMultisig['balance'] = await this.connection.getBalance(parsedMultisig.authority);

      return parsedMultisig;
    } catch (err: any) {
      console.error(`Get Multisig: ${err}`);
      return null;
    }
  };

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
          parsedMultisig['balance'] = await this.connection.getBalance(parsedMultisig.authority);
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
  };

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
  getMultisigTransaction = async (
    multisig: PublicKey,
    transaction: PublicKey,
    owner: PublicKey
  ): Promise<MultisigTransaction | null> => {
    try {
      const multisigAcc = await this.program.account.multisigV2.fetchNullable(multisig);

      if (!multisigAcc) {
        throw Error(`Multisig account ${multisig.toBase58()} not found`);
      }

      const transactionAcc = await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) {
        throw Error(`Transaction account ${transaction.toBase58()} not found`);
      }

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
  };

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

      if (!multisigAcc) {
        throw Error(`Multisig account ${multisig.toBase58()} not found`);
      }

      let txFilters: GetProgramAccountsFilter[] = [{ memcmp: { offset: 8, bytes: multisig.toString() } }];

      const promises = [this.program.account.transaction.all(txFilters), this.program.account.transactionDetail.all()];

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

      const sortedTxs = transactions.sort((a, b) => b.createdOn.getTime() - a.createdOn.getTime());

      return sortedTxs;
    } catch (err: any) {
      console.error(`List Multisig Transactions: ${err}`);
      return [];
    }
  };

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
    commitment?: Finality | undefined
  ): Promise<any[]> => {
    try {
      const transactionAcc: any = await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) {
        throw Error(`Transaction account ${transaction.toBase58()} not found`);
      }

      const multisigAcc: any = await this.program.account.multisigV2.fetchNullable(transactionAcc.multisig);

      if (!multisigAcc) {
        throw Error(`Multisig account ${transactionAcc.multisig.toBase58()} not found`);
      }

      let activity: MultisigTransactionActivityItem[] = [];
      let finality = commitment ?? 'finalized';
      let filter = { limit: limit } as ConfirmedSignaturesForAddress2Options;

      if (before) {
        filter['before'] = before;
      }

      let signatures = await this.program.provider.connection.getConfirmedSignaturesForAddress2(
        transaction,
        filter,
        finality
      );

      let txs = await this.program.provider.connection.getParsedTransactions(
        signatures.map((s: any) => s.signature),
        finality
      );

      const coder = new BorshInstructionCoder(this.program.idl);

      for (const tx of txs) {
        if (!tx) {
          continue;
        }
        const item = parseMultisigTransactionActivity(coder, multisigAcc.owners, tx);
        if (item) {
          activity.push(item);
        }
      }

      const sorted = activity.sort((a, b) => b.createdOn.getTime() - a.createdOn.getTime());
      sorted.forEach((item, index) => {
        item.index = index;
      });

      return activity;
    } catch (err: any) {
      console.error(`List Multisig Transaction Activity: ${err}`);
      return [];
    }
  };

  /**
   * Creates a new multisig account
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
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
  buildCreateMultisigTransaction = async (
    payer: PublicKey,
    label: string,
    // description: string | undefined,
    threshold: number,
    participants: MultisigParticipant[]
  ): Promise<{
    transaction: Transaction;
    msAccount: PublicKey;
    msSignerAccount: PublicKey;
  } | null> => {
    try {
      const multisig = Keypair.generate();
      const [multisigSigner, nonce] = await PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        this.program.programId
      );
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress([Buffer.from(utf8.encode('settings'))], this.program.programId)
        )[0];
      }
      const owners = participants.map((p: MultisigParticipant) => {
        return {
          address: new PublicKey(p.address),
          name: p.name
        };
      });

      let tx = await this.program.methods
        .createMultisig(owners, new BN(threshold), nonce, label)
        .accounts({
          proposer: payer,
          multisig: multisig.publicKey,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId
        })
        .signers([multisig])
        .transaction();

      tx.feePayer = payer;
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[multisig]);

      return {
        transaction: tx,
        msAccount: multisig.publicKey,
        msSignerAccount: multisigSigner
      };
    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return null;
    }
  };

  /**
   * Creates a new multisig account
   *
   * @deprecated This function will be removed in next major release, use `buildCreateMultisigTransaction` instead.
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions.
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @returns {Promise<Transaction | null>} Returns a transaction for creating a new multisig.
   *
   */
  createMultisig = async (
    payer: PublicKey,
    label: string,
    // description: string | undefined,
    threshold: number,
    participants: MultisigParticipant[]
  ): Promise<Transaction | null> => {
    console.warn('createMultisig is deprecated, use buildCreateMultisigTransaction instead');
    const result = await this.buildCreateMultisigTransaction(payer, label, threshold, participants);
    return result ? result.transaction : null;
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
  buildCreateFundedMultisigTransaction = async (
    payer: PublicKey,
    lamports: number,
    label: string,
    threshold: number,
    participants: MultisigParticipant[]
  ): Promise<{
    transaction: Transaction;
    msAccount: PublicKey;
    msSignerAccount: PublicKey;
  } | null> => {
    try {
      const multisig = Keypair.generate();
      const [multisigSigner, nonce] = await PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        this.program.programId
      );
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress([Buffer.from(utf8.encode('settings'))], this.program.programId)
        )[0];
      }
      const owners = participants.map((p: MultisigParticipant) => {
        return {
          address: new PublicKey(p.address),
          name: p.name
        };
      });

      let tx = await this.program.methods
        .createMultisig(owners, new BN(threshold), nonce, label)
        .accounts({
          proposer: payer,
          multisig: multisig.publicKey,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId
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

      return {
        transaction: tx,
        msAccount: multisig.publicKey,
        msSignerAccount: multisigSigner
      };
    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return null;
    }
  };

  /**
   * Creates a new multisig account with funds
   *
   * @deprecated This function will be removed in next major release, use `buildCreateFundedMultisigTransaction` instead.
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
    console.warn('createFundedMultisig is deprecated, use buildCreateFundedMultisigTransaction instead');
    const result = await this.buildCreateFundedMultisigTransaction(payer, lamports, label, threshold, participants);
    return result ? result.transaction : null;
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
   * @returns Promise<{
   *   transaction: Transaction;
   *   proposalAccount: PublicKey;
   * } | null> Returns a promise that resolves to an object or null.
   *
   * @property {Transaction} transaction - The transaction for creating a proposal.
   * @property {PublicKey} proposalAccount - The proposal account public key.
   */
  buildCreateProposalTransaction = async (
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
  ): Promise<{
    transaction: Transaction;
    proposalAccount: PublicKey;
  } | null> => {
    try {
      console.log('Get settings');
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress([Buffer.from(utf8.encode('settings'))], this.program.programId)
        )[0];
      }
      console.log('Generate transaction keypair');
      const transaction = Keypair.generate();
      console.log('transaction public key:', transaction.publicKey.toBase58());
      const txSize = 1200;
      console.log('Generate pre instruction');
      const createIx = await this.program.account.transaction.createInstruction(transaction, txSize);

      console.log('Get txDetailAddress');
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.publicKey.toBuffer()],
        this.program.programId
      );
      console.log('txDetailAddress:', txDetailAddress.toBase58());

      const expirationTime = parseInt((expirationDate ? expirationDate.getTime() / 1_000 : 0).toString());

      console.log('Call program createTransaction()');
      let tx = await this.program.methods
        .createTransaction(
          program,
          accounts,
          data,
          operation,
          title,
          description ?? '',
          new BN(expirationTime),
          new BN(0),
          0
        )
        .accounts({
          multisig: multisig,
          transaction: transaction.publicKey,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId
        })
        .preInstructions([...preInstructions, createIx])
        .signers([transaction])
        .transaction();

      tx.feePayer = proposer;
      console.log('Get blockhash');
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[transaction]);

      console.log('Returning...');
      return { transaction: tx, proposalAccount: transaction.publicKey };
    } catch (err: any) {
      console.error(`Create Transaction: ${err}`);
      return null;
    }
  };

  /**
   * Creates a multisig transaction proposal
   * @deprecated This function will be removed in next major release, use `buildCreateProposalTransaction` instead.
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
    console.warn('createTransaction is deprecated, use buildCreateProposalTransaction instead');
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress([Buffer.from(utf8.encode('settings'))], this.program.programId)
        )[0];
      }
      const transaction = Keypair.generate();
      const txSize = 1200;
      const createIx = await this.program.account.transaction.createInstruction(transaction, txSize);

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.publicKey.toBuffer()],
        this.program.programId
      );

      const expirationTime = parseInt((expirationDate ? expirationDate.getTime() / 1_000 : 0).toString());

      let tx = await this.program.methods
        .createTransaction(
          program,
          accounts,
          data,
          operation,
          title,
          description ?? '',
          new BN(expirationTime),
          new BN(0),
          0
        )
        .accounts({
          multisig: multisig,
          transaction: transaction.publicKey,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId
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
   * Cancels a multisig transaction proposal
   *
   * @public
   * @param {PublicKey} proposer - The owner that created the transaction proposal.
   * @param {PublicKey} transaction - The transaction proposal to be canceled.
   * @returns {Promise<Transaction | null>} Returns a transaction for canceling the transaction proposal.
   */
  cancelTransaction = async (proposer: PublicKey, transaction: PublicKey): Promise<Transaction | null> => {
    try {
      const txAccount = await this.program.account.transaction.fetchNullable(transaction, this.connection.commitment);

      if (!txAccount) {
        throw Error('Transaction proposal not found');
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
          systemProgram: SystemProgram.programId
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
  approveTransaction = async (owner: PublicKey, transaction: PublicKey): Promise<Transaction | null> => {
    try {
      const txAccount = await this.program.account.transaction.fetchNullable(transaction, this.connection.commitment);

      if (!txAccount) {
        throw Error('Transaction proposal not found');
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
          systemProgram: SystemProgram.programId
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
  rejectTransaction = async (owner: PublicKey, transaction: PublicKey): Promise<Transaction | null> => {
    try {
      const txAccount = await this.program.account.transaction.fetchNullable(transaction, this.connection.commitment);

      if (!txAccount) {
        throw Error('Transaction proposal not found');
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
          systemProgram: SystemProgram.programId
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
  executeTransaction = async (owner: PublicKey, transaction: PublicKey): Promise<Transaction> => {
    const txAccount = await this.program.account.transaction.fetchNullable(transaction, this.connection.commitment);

    if (!txAccount) {
      throw Error('Transaction proposal not found');
    }

    const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
    const [multisigSigner] = await PublicKey.findProgramAddress([multisig.toBuffer()], this.program.programId);

    const [txDetailAddress] = await PublicKey.findProgramAddress(
      [multisig.toBuffer(), transaction.toBuffer()],
      this.program.programId
    );

    let remainingAccounts = (txAccount.accounts as IdlTransactionAccount[])
      // Change the signer status on the vendor signer since it's signed by the program, not the client.
      .map(meta => (meta.pubkey.equals(multisigSigner) ? { ...meta, isSigner: false } : meta))
      .concat({
        pubkey: txAccount.programId,
        isWritable: false,
        isSigner: false
      });

    // Replace placeholders with fresh random keypairs in the remaining
    // accounts list
    const accountReplacementKeys: Keypair[] = [];
    for (const element of remainingAccounts) {
      if (!element.pubkey.equals(ACCOUNT_REPLACEMENT_PLACEHOLDER)) {
        continue;
      }
      const replacementKey = Keypair.generate();
      element.pubkey = replacementKey.publicKey;
      accountReplacementKeys.push(replacementKey);
    }

    if (accountReplacementKeys.length > 0) {
      let tx = await this.program.methods
        .executeTransactionWithReplacements(accountReplacementKeys.map(k => k.publicKey))
        .accounts({
          multisig: multisig,
          multisigSigner: multisigSigner,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          payer: owner,
          systemProgram: SystemProgram.programId
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      tx.partialSign(...accountReplacementKeys);

      return tx;
    }

    let tx = await this.program.methods
      .executeTransaction()
      .accounts({
        multisig: multisig,
        multisigSigner: multisigSigner,
        transaction: transaction,
        transactionDetail: txDetailAddress,
        payer: owner,
        systemProgram: SystemProgram.programId
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    tx.feePayer = owner;
    const { blockhash } = await this.connection.getLatestBlockhash(this.connection.commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  };

  /**
   * Decodes a multisig transaction proposal
   *
   * @public
   * @param {MultisigTransaction} transaction - The multisig transaction proposal data
   * @returns {MultisigTransactionInstructionInfo | null} Returns a transaction for executing the transaction proposal.
   */
  decodeProposalInstruction = (transaction: MultisigTransaction): MultisigTransactionInstructionInfo | null => {
    if (transaction.programId.equals(SystemProgram.programId)) {
      return parseMultisigSystemProposalIx(transaction);
    } else if (transaction.programId.equals(TOKEN_PROGRAM_ID)) {
      const program = createAnchorProgram(this.connection, TOKEN_PROGRAM_ID, SplTokenIdl);
      const ixInfo = parseMultisigProposalIx(transaction, this.program.programId, program);
      return ixInfo;
    } else {
      return parseMultisigProposalIx(transaction, this.program.programId);
    }
  };
}
