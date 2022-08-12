import {
  AnchorProvider,
  BN,
  BorshInstructionCoder,
  Idl,
  Program,
  Provider,
} from '@project-serum/anchor';
import {
  AccountMeta,
  Cluster,
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
  TransactionInstruction,
} from '@solana/web3.js';
import { Multisig } from './multisig';
import {
  MEAN_MULTISIG_OPS,
  MEAN_MULTISIG_PROGRAM,
  MultisigInfo,
  MultisigParticipant,
  MultisigTransactionActivityItem,
  MultisigTransactionInstruction,
  TimeUnit,
  MultisigTransaction,
  MultisigTransactionArchived,
  MULTISIG_UPGRADE_BLOCKTIME
} from './types';
import {
  parseMultisigTransactionActivity,
  parseMultisigV1Account,
  parseMultisigV2Account,
  parseMultisigTransaction,
  parseMultisigTransactionArchived,
} from './utils';
import IDLArchived from './idl';
import {
  MeanMultisig as MeanMultisigMultipleInstruction,
  IDL as IDLMultipleInstructions,
} from './idl-multiple-instructions';
import { utf8 } from '@project-serum/anchor/dist/cjs/utils/bytes';

/**
 * MeanMultisig class implementation
 *
 * @implements {Multisig}
 */
export class MeanMultisig implements Multisig {
  /** @private */
  rpcUrl: string;
  /** @private */
  programArchived: Program<Idl>;
  /** @private */
  program: Program<MeanMultisigMultipleInstruction>;
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
  constructor(
    url: string,
    wallet: PublicKey,
    commitment: Commitment | ConnectionConfig,
  ) {
    const opts = AnchorProvider.defaultOptions();
    const anchorWallet = {
      publicKey: new PublicKey(wallet),
      signAllTransactions: async (txs: any) => txs,
      signTransaction: async (tx: any) => tx,
    };

    this.rpcUrl = url;
    this.connection = new Connection(
      this.rpcUrl,
      commitment || opts.commitment,
    );
    this.provider = new AnchorProvider(this.connection, anchorWallet, opts);
    this.programArchived = new Program(
      IDLArchived,
      MEAN_MULTISIG_PROGRAM,
      this.provider,
    );
    this.program = new Program(
      IDLMultipleInstructions,
      MEAN_MULTISIG_PROGRAM,
      this.provider,
    );
    PublicKey.findProgramAddress(
      [Buffer.from(utf8.encode('settings'))],
      this.program.programId,
    )
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
  getProgram = (): Program<MeanMultisigMultipleInstruction> => {
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
      let multisigAcc = await this.program.account.multisigV2.fetchNullable(
        address,
      );

      if (!multisigAcc) {
        multisigAcc = await this.programArchived.account.multisig.fetchNullable(
          address,
        );

        if (!multisigAcc) {
          return null;
        }
      }

      let parsedMultisig: any;

      if (multisigAcc.version && multisigAcc.version === 2) {
        parsedMultisig = await parseMultisigV2Account(this.program.programId, {
          publicKey: address,
          account: multisigAcc,
        });
      } else {
        parsedMultisig = await parseMultisigV1Account(this.program.programId, {
          publicKey: address,
          account: multisigAcc,
        });
      }

      if (!parsedMultisig) {
        return null;
      }

      parsedMultisig['balance'] = await this.connection.getBalance(
        parsedMultisig.authority,
      );

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
  getMultisigs = async (
    owner?: PublicKey | undefined,
  ): Promise<MultisigInfo[]> => {
    try {
      // Get accounts
      let accounts: any[] = [];
      let multisigV2Accs = await this.program.account.multisigV2.all();
      let filteredAccs = multisigV2Accs.filter((a: any) => {
        if (
          owner &&
          a.account.owners.filter((o: any) => o.address.equals(owner)).length
        ) {
          return true;
        }
        return false;
      });

      accounts.push(...filteredAccs);
      let multisigInfoArray: MultisigInfo[] = [];

      for (let info of accounts) {
        const parsedMultisig = await parseMultisigV2Account(
          this.program.programId,
          info,
        );
        if (parsedMultisig) {
          parsedMultisig['balance'] = await this.connection.getBalance(
            parsedMultisig.authority,
          );
          multisigInfoArray.push(parsedMultisig);
        }
      }

      const sortedArray = multisigInfoArray.sort(
        (a: any, b: any) => b.createdOnUtc.getTime() - a.createdOnUtc.getTime(),
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
   * @returns {Promise<MultisigTransactionArchived>} Returns a parsed multisig transactions.
   */
  getMultisigTransaction = async (
    multisig: PublicKey,
    transaction: PublicKey,
    owner: PublicKey,
  ): Promise<MultisigTransaction | null> => {
    try {
      const multisigAcc = await this.program.account.multisigV2.fetchNullable(
        multisig,
      );

      if (!multisigAcc) {
        throw Error(`Multisig account ${multisig.toBase58()} not found`);
      }

      const transactionAcc =
        await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) {
        throw Error(`Transaction account ${transaction.toBase58()} not found`);
      }

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId,
      );

      const txDetail =
        await this.programArchived.account.transactionDetail.fetchNullable(
          txDetailAddress,
        );
      const tx = {
        publicKey: transaction,
        account: transactionAcc,
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
   * @param {Cluster} cluster - The cluster id of the environment.
   * @returns {Promise<MultisigTransaction | MultisigTransactionArchived[]>} Returns a list of parsed multisig transactions.
   */
  getMultisigTransactions = async (
    multisig: PublicKey,
    owner: PublicKey,
    clusterId: Cluster,
  ): Promise<(MultisigTransaction | MultisigTransactionArchived)[]> => {
    const multisigAcc = await this.program.account.multisigV2.fetchNullable(
      multisig,
    );

    if (!multisigAcc) {
      throw Error(`Multisig account ${multisig.toBase58()} not found`);
    }

    let txFilters: GetProgramAccountsFilter[] = [
      { memcmp: { offset: 8, bytes: multisig.toString() } },
    ];

    const txs = await this.program.account.transaction.all(txFilters);
    const txDetailAddresses: PublicKey[] = await Promise.all(
      txs.map(
        async tx =>
          (
            await PublicKey.findProgramAddress(
              [multisig.toBuffer(), tx.publicKey.toBuffer()],
              this.program.programId,
            )
          )[0],
      ),
    );

    const details = await this.program.account.transactionDetail.fetchMultiple(
      txDetailAddresses,
    );

    let transactions: (MultisigTransaction | MultisigTransactionArchived)[] =
      [];

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const upgradeDate = MULTISIG_UPGRADE_BLOCKTIME[clusterId];
      const detail = details[i];
      if (detail) {
        if (tx.account.createdOn.toNumber() > upgradeDate) {
          transactions.push(
            parseMultisigTransaction(multisigAcc, owner, tx, detail),
          );
        } else {
          transactions.push(
            parseMultisigTransactionArchived(multisigAcc, owner, tx, detail),
          );
        }
      }
    }
    const sortedTxs = transactions.sort(
      (a, b) => b.createdOn.getTime() - a.createdOn.getTime(),
    );
    return sortedTxs;
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
    commitment?: Finality | undefined,
  ): Promise<any[]> => {
    try {
      const transactionAcc: any =
        await this.program.account.transaction.fetchNullable(transaction);

      if (!transactionAcc) {
        throw Error(`Transaction account ${transaction.toBase58()} not found`);
      }

      const multisigAcc: any =
        await this.program.account.multisigV2.fetchNullable(
          transactionAcc.multisig,
        );

      if (!multisigAcc) {
        throw Error(
          `Multisig account ${transactionAcc.multisig.toBase58()} not found`,
        );
      }

      let activity: MultisigTransactionActivityItem[] = [];
      let finality = commitment !== undefined ? commitment : 'finalized';
      let filter = { limit: limit } as ConfirmedSignaturesForAddress2Options;

      if (before) {
        filter['before'] = before;
      }

      let signatures =
        await this.program.provider.connection.getConfirmedSignaturesForAddress2(
          transaction,
          filter,
          finality,
        );

      let txs = await this.program.provider.connection.getParsedTransactions(
        signatures.map((s: any) => s.signature),
        finality,
      );

      const coder = new BorshInstructionCoder(this.program.idl);

      for (const tx of txs) {
        if (!tx) {
          continue;
        }
        const item = parseMultisigTransactionActivity(
          coder,
          multisigAcc.owners,
          tx,
        );
        if (item) {
          activity.push(item);
        }
      }

      const sorted = activity.sort(
        (a, b) => b.createdOn.getTime() - a.createdOn.getTime(),
      );
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
   * @param {number} coolOffPeriodValue - The cool off period before the transaction can be executed (ex: 1)
   * @param {number} coolOffPeriodUnit - The unit of the cool off period (ex: TimeUnit.Hour)
   * @returns {Promise<[Transaction | null, PublicKey | null]>} Returns a transaction for creating a new multisig and the multisig address.
   */
  createMultisig = async (
    payer: PublicKey,
    label: string,
    // description: string | undefined,
    threshold: number,
    participants: MultisigParticipant[],
    coolOffPeriodValue: number,
    coolOffPeriodUnit: TimeUnit,
  ): Promise<[Transaction | null, PublicKey | null]> => {
    try {
      const multisig = Keypair.generate();
      const [, nonce] = await PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        this.program.programId,
      );
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const owners = participants.map((p: MultisigParticipant) => {
        return {
          address: new PublicKey(p.address),
          name: p.name,
        };
      });

      let tx = await this.program.methods
        .createMultisig(
          owners,
          new BN(threshold),
          nonce,
          label,
          new BN(coolOffPeriodValue * (coolOffPeriodUnit as number)),
        )
        .accounts({
          proposer: payer,
          multisig: multisig.publicKey,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId,
        })
        .signers([multisig])
        .transaction();

      tx.feePayer = payer;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[multisig]);

      return [tx, multisig.publicKey];
    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return [null, null];
    }
  };

  /**
   * Edits a multisig account
   *
   * @public
   * @param {PublicKey} payer - The payer of the transaction.
   * @param {PublicKey} multisig - The multisig account to edit.
   * @param {string} label - The label of the multisig account.
   * @param {number} threshold - The minimum amount required in this multisig to execute transactions.
   * @param {MultisigParticipant[]} participants - The partisipants/owners of the multisig.
   * @param {number} coolOffPeriodValue - The cool off period before the transaction can be executed (ex: 1)
   * @param {number} coolOffPeriodUnit - The unit of the cool off period (ex: TimeUnit.Hour)
   * @returns {Promise<Transaction>} Returns a transaction for editing the multisig.
   */
  editMultisig = async (
    payer: PublicKey,
    multisig: PublicKey,
    label: string,
    threshold: number,
    participants: MultisigParticipant[],
    coolOffPeriodValue: number,
    coolOffPeriodUnit: TimeUnit,
  ): Promise<Transaction> => {
    const [multisigSigner] = await PublicKey.findProgramAddress(
      [multisig.toBuffer()],
      this.program.programId,
    );
    if (!this.settings) {
      this.settings = (
        await PublicKey.findProgramAddress(
          [Buffer.from(utf8.encode('settings'))],
          this.program.programId,
        )
      )[0];
    }
    const owners = participants.map((p: MultisigParticipant) => {
      return {
        address: new PublicKey(p.address),
        name: p.name,
      };
    });

    let tx = await this.program.methods
      .editMultisig(
        owners,
        new BN(threshold),
        label,
        new BN(coolOffPeriodUnit * (coolOffPeriodValue as number)),
      )
      .accounts({
        multisigSigner,
        multisig,
      })
      .transaction();

    tx.feePayer = payer;
    const { blockhash } = await this.connection.getLatestBlockhash(
      this.connection.commitment,
    );
    tx.recentBlockhash = blockhash;

    return tx;
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
   * @param {number} coolOffPeriodValue - The cool off period before the transaction can be executed (ex: 1)
   * @param {number} coolOffPeriodUnit - The unit of the cool off period (ex: TimeUnit.Hour)
   * @returns {Promise<[Transaction | null, PublicKey | null]>} Returns a transaction for creating a new multisig and multisig address.
   */
  createFundedMultisig = async (
    payer: PublicKey,
    lamports: number,
    label: string,
    threshold: number,
    participants: MultisigParticipant[],
    coolOffPeriodValue: number,
    coolOffPeriodUnit: TimeUnit,
  ): Promise<[Transaction | null, PublicKey | null]> => {
    try {
      const multisig = Keypair.generate();
      const [multisigSigner, nonce] = await PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        this.program.programId,
      );
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const owners = participants.map((p: MultisigParticipant) => {
        return {
          address: new PublicKey(p.address),
          name: p.name,
        };
      });

      let tx = await this.program.methods
        .createMultisig(
          owners,
          new BN(threshold),
          nonce,
          label,
          new BN(coolOffPeriodUnit * (coolOffPeriodValue as number)),
        )
        .accounts({
          proposer: payer,
          multisig: multisig.publicKey,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId,
        })
        .signers([multisig])
        .postInstructions([
          SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: multisigSigner,
            lamports: lamports,
          }),
        ])
        .transaction();

      tx.feePayer = payer;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[multisig]);

      return [tx, multisig.publicKey];
    } catch (err: any) {
      console.error(`Create Multisig: ${err}`);
      return [null, null];
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
   * @param {PublicKey} multisig - The address of the multisig.
   * @param  {TransactionInstruction[]} instructions - The transaction instructions to be executed.
   * @param {TransactionInstruction[]} [preInstructions=[]] - Any required instruction that needs to be executed before creating the transaction proposal.
   * @returns {Promise<[Transaction | null, PublicKey | null]>} Returns a transaction for creating a new transaction proposal.
   */
  createTransaction = async (
    proposer: PublicKey,
    title: string,
    description: string | undefined,
    expirationDate: Date | undefined,
    operation: number,
    multisig: PublicKey,
    instructions: TransactionInstruction[] = [],
    preInstructions: TransactionInstruction[] = [],
  ): Promise<[Transaction | null, PublicKey | null]> => {
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const transaction = Keypair.generate();
      const txSize = 1200;
      const createIx = await this.program.account.transaction.createInstruction(
        transaction,
        txSize,
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.publicKey.toBuffer()],
        this.program.programId,
      );

      const expirationTime = parseInt(
        (expirationDate ? expirationDate.getTime() / 1_000 : 0).toString(),
      );
      let tx = await this.program.methods
        .createTransaction(
          instructions.map(i => ({
            programId: i.programId,
            accounts: i.keys,
            data: i.data,
            keys: i.keys,
          })),
          operation,
          title,
          description || '',
          new BN(expirationTime),
        )
        .accounts({
          multisig: multisig,
          transaction: transaction.publicKey,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([...preInstructions, createIx])
        .signers([transaction])
        .transaction();

      tx.feePayer = proposer;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
      tx.recentBlockhash = blockhash;
      tx.partialSign(...[transaction]);

      return [tx, transaction.publicKey];
    } catch (err: any) {
      console.error(`Create Transaction: ${err}`);
      return [null, null];
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
    transaction: PublicKey,
  ): Promise<Transaction | null> => {
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment,
      );

      if (!txAccount) {
        throw Error('Transaction proposal not found');
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId,
      );

      let tx = await this.program.methods
        .cancelTransaction()
        .accounts({
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          proposer: proposer,
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = proposer;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
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
    transaction: PublicKey,
  ): Promise<Transaction | null> => {
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment,
      );

      if (!txAccount) {
        throw Error('Transaction proposal not found');
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId,
      );

      let tx = await this.program.methods
        .approve()
        .accounts({
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
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
    transaction: PublicKey,
  ): Promise<Transaction | null> => {
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment,
      );

      if (!txAccount) {
        throw Error('Transaction proposal not found');
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId,
      );

      let tx = await this.program.methods
        .reject()
        .accounts({
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
          multisig: multisig,
          transaction: transaction,
          transactionDetail: txDetailAddress,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
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
    transaction: PublicKey,
  ): Promise<Transaction | null> => {
    try {
      if (!this.settings) {
        this.settings = (
          await PublicKey.findProgramAddress(
            [Buffer.from(utf8.encode('settings'))],
            this.program.programId,
          )
        )[0];
      }
      const txAccount = await this.program.account.transaction.fetchNullable(
        transaction,
        this.connection.commitment,
      );

      if (!txAccount) {
        throw Error('Transaction proposal not found');
      }

      const multisig = new PublicKey(txAccount.multisig as PublicKeyInitData);
      const [multisigSigner] = await PublicKey.findProgramAddress(
        [multisig.toBuffer()],
        this.program.programId,
      );

      const [txDetailAddress] = await PublicKey.findProgramAddress(
        [multisig.toBuffer(), transaction.toBuffer()],
        this.program.programId,
      );

      let instructions =
        txAccount.instructions as MultisigTransactionInstruction[];
      let remainingAccounts: AccountMeta[] = [];
      instructions.forEach(instruction => {
        instruction.accounts.forEach(account => {
          if (account.pubkey.equals(multisigSigner)) {
            account.isSigner = false;
          }
          remainingAccounts.push(account);
        });
        remainingAccounts.push({
          pubkey: instruction.programId,
          isWritable: false,
          isSigner: false,
        });
      });

      let tx = await this.program.methods
        .executeTransaction()
        .accounts({
          opsAccount: MEAN_MULTISIG_OPS,
          settings: this.settings,
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
      const { blockhash } = await this.connection.getLatestBlockhash(
        this.connection.commitment,
      );
      tx.recentBlockhash = blockhash;

      return tx;
    } catch (err: any) {
      console.error(`Execute Transaction: ${err}`);
      return null;
    }
  };
}
