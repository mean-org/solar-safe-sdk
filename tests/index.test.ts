import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';

import {Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { MeanMultisig } from '../src';
import { MSP, TreasuryType, Constants as MSPConstants, TimeUnit, SubCategory } from '@mean-dao/msp';

import {getDefaultKeyPair, _printSerializedTx} from "./utils";

const endpoint = 'http://localhost:8899';
// deploy multisig locally
// init settings
// change MEAN_MULTISIG_PROGRAM in types.ts
// todo: find a better approach

let meanMultisig: MeanMultisig;

describe('Tests multisig\n', async () => {
  let mint: Token;
  let connection: Connection;
  let user1Wallet: Keypair, user2Wallet: Keypair, user3Wallet: Keypair, additionalUser: Keypair;

  before(async () => {
    user1Wallet = Keypair.generate();
    user2Wallet = Keypair.generate();
    user3Wallet = Keypair.generate();
    additionalUser = Keypair.generate();

    const root = await getDefaultKeyPair();
    connection = new Connection(endpoint, 'confirmed');
    
    const tx = new Transaction();
    tx.add(SystemProgram.transfer({
      fromPubkey: root.publicKey,
      lamports: 2000 * LAMPORTS_PER_SOL,
      toPubkey: user1Wallet.publicKey
    }));
    tx.add(SystemProgram.transfer({
      fromPubkey: root.publicKey,
      lamports: 1000 * LAMPORTS_PER_SOL,
      toPubkey: user2Wallet.publicKey
    }));
    tx.add(SystemProgram.transfer({
      fromPubkey: root.publicKey,
      lamports: 1000 * LAMPORTS_PER_SOL,
      toPubkey: user3Wallet.publicKey
    }));
    tx.add(SystemProgram.transfer({
      fromPubkey: root.publicKey,
      lamports: 1000 * LAMPORTS_PER_SOL,
      toPubkey: additionalUser.publicKey
    }));
    await sendAndConfirmTransaction(connection, tx, [root], { commitment: 'confirmed' });
    console.log("Balance user1: : ", await connection.getBalance(user1Wallet.publicKey, 'confirmed'));
    console.log("Balance user2: : ", await connection.getBalance(user2Wallet.publicKey, 'confirmed'));
    console.log("Balance user3: : ", await connection.getBalance(user3Wallet.publicKey, 'confirmed'));
    console.log("Balance additional: ", await connection.getBalance(additionalUser.publicKey, 'confirmed'));

    // create a mint
    mint = await Token.createMint(connection, root, root.publicKey, root.publicKey, 9, TOKEN_PROGRAM_ID);
    await mint.mintTo(await mint.createAssociatedTokenAccount(user1Wallet.publicKey), root, [root], 1000 * LAMPORTS_PER_SOL);
    await mint.mintTo(await mint.createAssociatedTokenAccount(user2Wallet.publicKey), root, [root], 1000 * LAMPORTS_PER_SOL);
    await mint.mintTo(await mint.createAssociatedTokenAccount(user3Wallet.publicKey), root, [root], 1000 * LAMPORTS_PER_SOL);
    await mint.mintTo(await mint.createAssociatedTokenAccount(additionalUser.publicKey), root, [root], 1000 * LAMPORTS_PER_SOL);
    
    meanMultisig = new MeanMultisig(endpoint, user1Wallet.publicKey, 'confirmed');
  });

  
  it('Creates a transaction, approve, execute \n', async () => {
    console.log('Creating multisig');
    const label = 'Test';
    const threshold = 2;
    const owners = [
        {
            address: user1Wallet.publicKey.toBase58(),
            name: "u1"
        },
        {
            address: user2Wallet.publicKey.toBase58(),
            name: "u2"
        },
        {
            address: user3Wallet.publicKey.toBase58(),
            name: "u3"
        }
    ];
    const [createMultisigTx, multisig] = await meanMultisig.createMultisig(
        user1Wallet.publicKey,
        label,
        threshold,
        owners,
        0,
        TimeUnit.Day
    ) as [Transaction, PublicKey];
    createMultisigTx.partialSign(user1Wallet);
    const createVestingTreasuryTxSerialized = createMultisigTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createVestingTreasuryTxSerialized, { commitment: 'confirmed' });
    console.log(`Created multisig: ${multisig.toBase58()}\n`);

    console.log('Creating instructions');
    const ix1 = SystemProgram.transfer({
        fromPubkey: user1Wallet.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
        toPubkey: user2Wallet.publicKey
    });

    const ix2 = SystemProgram.transfer({
        fromPubkey: user2Wallet.publicKey,
        lamports:  10* LAMPORTS_PER_SOL,
        toPubkey: user3Wallet.publicKey
    });
    const title = 'Test transaction';
    const description = "This is a test transaction";
    const operation = 1;
    let expiry = new Date();
    expiry.setHours(expiry.getHours() + 1)
    const [createTransactionTx, txKey] = await meanMultisig.createTransaction(
        user1Wallet.publicKey,
        title,
        description,
        expiry,
        operation,
        multisig,
        [ix1, ix2],
        []
    ) as [Transaction, PublicKey];
    createTransactionTx.partialSign(user1Wallet);
    const createTransactionTxSerialized = createTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createTransactionTxSerialized, { commitment: 'confirmed' });
    console.log('Transaction created\n');

    console.log('Approving transaction');
    const approveTx = await meanMultisig.approveTransaction(
      user2Wallet.publicKey,
      txKey
    ) as Transaction;
    approveTx.partialSign(user2Wallet);
    const approveTxSerialized = approveTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, approveTxSerialized, { commitment: 'confirmed' });
    console.log('Transaction approved\n');

    console.log('Executing transaction');
    const executeTransactionTx = await meanMultisig.executeTransaction(
      user1Wallet.publicKey,
      txKey,
    ) as Transaction;
    executeTransactionTx.partialSign(user1Wallet);
    executeTransactionTx.partialSign(user2Wallet);
    const executeTransactionTxSerialized = executeTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, executeTransactionTxSerialized, { commitment: 'confirmed' });
    console.log(`Transaction executed\n`);

    const transactionsList = await meanMultisig.getMultisigTransactions(multisig, user1Wallet.publicKey);
    console.log(JSON.stringify(transactionsList, null, 2));
  });

  it('Creates a money streaming transaction, approve, execute \n', async () => {
    // before running this tests, deploy msp locally

    const msp: MSP = new MSP(endpoint, user1Wallet.publicKey.toBase58(), 'confirmed', new PublicKey("5sW2fA7vikEFHnaYhJsTSCTG7QG4smgoMkB2wHLU3THy"));
    
    console.log('Creating multisig');
    const label = 'Test2';
    const threshold = 2;
    const owners = [
        {
            address: user1Wallet.publicKey.toBase58(),
            name: "u1"
        },
        {
            address: user2Wallet.publicKey.toBase58(),
            name: "u2"
        },
        {
            address: user3Wallet.publicKey.toBase58(),
            name: "u3"
        }
    ];
    const [createMultisigTx, multisig] = await meanMultisig.createMultisig(
        user1Wallet.publicKey,
        label,
        threshold,
        owners,
        0,
        TimeUnit.Day
    ) as [Transaction, PublicKey];
    createMultisigTx.partialSign(user1Wallet);
    const createVestingTreasuryTxSerialized = createMultisigTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createVestingTreasuryTxSerialized, { commitment: 'confirmed' });
    console.log(`Created multisig: ${multisig.toBase58()}\n`);

    console.log('Creating instructions to create a money streaming treasury');
    
    const [createVestingTreasuryTx, treasury] = await msp.createVestingTreasury(
      user1Wallet.publicKey,
      user1Wallet.publicKey,
      '',
      TreasuryType.Open,
      false,
      mint.publicKey,
      12,
      TimeUnit.Minute,
      // 2 * LAMPORTS_PER_SOL,
      0,
      SubCategory.seed,
      new Date(),
    );
   
    let title = 'Create treasury';
    let description = "";
    let operation = 1;
    let expiry = new Date();
    expiry.setHours(expiry.getHours() + 1)
    const [createTransactionTx, txKey] = await meanMultisig.createTransaction(
        user1Wallet.publicKey,
        title,
        description,
        expiry,
        operation,
        multisig,
        createVestingTreasuryTx.instructions,
        []
    ) as [Transaction, PublicKey];
    createTransactionTx.partialSign(user1Wallet);
    const createTransactionTxSerialized = createTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createTransactionTxSerialized, { commitment: 'confirmed' });
    console.log('Create treasury transaction created\n');

    console.log('Approving transaction');
    let approveTx = await meanMultisig.approveTransaction(
      user2Wallet.publicKey,
      txKey
    ) as Transaction;
    approveTx.partialSign(user2Wallet);
    let approveTxSerialized = approveTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, approveTxSerialized, { commitment: 'confirmed' });
    console.log('Create treasury transaction approved\n');

    console.log('Executing transaction');
    let executeTransactionTx = await meanMultisig.executeTransaction(
      user1Wallet.publicKey,
      txKey,
    ) as Transaction;
    executeTransactionTx.partialSign(user1Wallet);
    let executeTransactionTxSerialized = executeTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, executeTransactionTxSerialized, { commitment: 'confirmed' });
    console.log(`Create treasury transaction executed\n`);

    // ------------------------------------------
    title = 'Add funds';
    description = "";
    operation = 2;
    expiry = new Date();
    expiry.setHours(expiry.getHours() + 1)

    const addFundsTx = await msp.addFunds(
        user1Wallet.publicKey,
        user1Wallet.publicKey,
        treasury,
        mint.publicKey,
        LAMPORTS_PER_SOL * 100,
    );

    const [addFundsTxTx, addFundstxKey] = await meanMultisig.createTransaction(
        user1Wallet.publicKey,
        title,
        description,
        expiry,
        operation,
        multisig,
        addFundsTx.instructions,
        []
    ) as [Transaction, PublicKey];
    addFundsTxTx.partialSign(user1Wallet);
    const addFundsTxTxSerialized = addFundsTxTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, addFundsTxTxSerialized, { commitment: 'confirmed' });
    console.log('Add funds transaction created\n');

     console.log('Approving transaction');
     approveTx = await meanMultisig.approveTransaction(
      user2Wallet.publicKey,
      addFundstxKey
    ) as Transaction;
    approveTx.partialSign(user2Wallet);
    approveTxSerialized = approveTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, approveTxSerialized, { commitment: 'confirmed' });
    console.log('Add funds transaction approved\n');

    console.log('Executing transaction');
    executeTransactionTx = await meanMultisig.executeTransaction(
      user1Wallet.publicKey,
      addFundstxKey,
    ) as Transaction;
    executeTransactionTx.partialSign(user1Wallet);
    executeTransactionTxSerialized = executeTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, executeTransactionTxSerialized, { commitment: 'confirmed' });
    console.log(`Add funds transaction executed\n`);
    
    // ----------------- Create stream -------------------
    title = 'Create stream';
    description = "";
    operation = 3;
    expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    const [createStreamTx,] = await msp.createStreamWithTemplate(
      user1Wallet.publicKey,
      user1Wallet.publicKey,
      treasury,
      user2Wallet.publicKey,
      10 * LAMPORTS_PER_SOL,
      'test_stream',
    ) as [Transaction, PublicKey];
    
    // create stream
    const [createStreamTxTx, createStreamMultisigTx] = await meanMultisig.createTransaction(
        user1Wallet.publicKey,
        title,
        description,
        expiry,
        operation,
        multisig,
        createStreamTx.instructions,
    ) as [Transaction, PublicKey];
    createStreamTxTx.partialSign(user1Wallet);
    const createStreamTxTxSerialized = createStreamTxTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createStreamTxTxSerialized, { commitment: 'confirmed' });
    console.log('Create stream transaction created\n');

    console.log('Approving transaction');
     approveTx = await meanMultisig.approveTransaction(
      user2Wallet.publicKey,
      createStreamMultisigTx
    ) as Transaction;
    approveTx.partialSign(user2Wallet);
    approveTxSerialized = approveTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, approveTxSerialized, { commitment: 'confirmed' });
    console.log('Create stream transaction approved\n');

    console.log('Executing transaction');
    executeTransactionTx = await meanMultisig.executeTransaction(
      user1Wallet.publicKey,
      createStreamMultisigTx,
    ) as Transaction;
    executeTransactionTx.partialSign(user1Wallet);
    executeTransactionTxSerialized = executeTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, executeTransactionTxSerialized, { commitment: 'confirmed' });
    console.log(`Create stream transaction executed\n`);

    const transactionsList = await meanMultisig.getMultisigTransactions(multisig, user1Wallet.publicKey);
    console.log(JSON.stringify(transactionsList, null, 2));
  });

  it('Edits a multisig \n', async () => {
    console.log('Editing multisig');
    let label = 'Test';
    let threshold = 2;
    let owners = [
        {
            address: user1Wallet.publicKey.toBase58(),
            name: "u1"
        },
        {
            address: user2Wallet.publicKey.toBase58(),
            name: "u2"
        },
        {
            address: user3Wallet.publicKey.toBase58(),
            name: "u3"
        }
    ];

    const [createMultisigTx, multisig] = await meanMultisig.createMultisig(
        user1Wallet.publicKey,
        label,
        threshold,
        owners,
        0,
        TimeUnit.Day
    ) as [Transaction, PublicKey];
    createMultisigTx.partialSign(user1Wallet);
    const createMultisigTxSerialized = createMultisigTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, createMultisigTxSerialized, { commitment: 'confirmed' });
    console.log(`Created multisig: ${multisig.toBase58()}\n`);


    // editing multisig

    label = 'Edited'
    owners = [
        {
            address: user1Wallet.publicKey.toBase58(),
            name: "u1"
        },
        {
            address: user2Wallet.publicKey.toBase58(),
            name: "u2"
        },
        {
            address: additionalUser.publicKey.toBase58(),
            name: "au"
        }
    ];
    
    const editMultisigTx = await meanMultisig.editMultisig(
        user1Wallet.publicKey,
        multisig,
        label,
        threshold,
        owners,
        0,
        TimeUnit.Day
    );
    
    const title = 'Edit Multisig';
    const description = "Editing multisig";
    const operation = 1;
    let expiry = new Date();
    expiry.setHours(expiry.getHours() + 1)
    const [editMultisigTxTx, txKey] = await meanMultisig.createTransaction(
        user1Wallet.publicKey,
        title,
        description,
        expiry,
        operation,
        multisig,
        editMultisigTx.instructions,
        []
    ) as [Transaction, PublicKey];
    editMultisigTxTx.partialSign(user1Wallet);
    const editMultisigTxSerialized = editMultisigTxTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, editMultisigTxSerialized, { commitment: 'confirmed' });
    console.log('Edit Transaction created\n');

    console.log('Approving edit transaction');
    const approveTx = await meanMultisig.approveTransaction(
      user2Wallet.publicKey,
      txKey
    ) as Transaction;
    approveTx.partialSign(user2Wallet);
    const approveTxSerialized = approveTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, approveTxSerialized, { commitment: 'confirmed' });
    console.log('Edit Transaction approved\n');

    console.log('Executing edit transaction');
    const executeTransactionTx = await meanMultisig.executeTransaction(
      user1Wallet.publicKey,
      txKey,
    ) as Transaction;
    executeTransactionTx.partialSign(user1Wallet);
    const executeTransactionTxSerialized = executeTransactionTx.serialize({
      verifySignatures: true,
    });
    await sendAndConfirmRawTransaction(connection, executeTransactionTxSerialized, { commitment: 'confirmed' });
    console.log(`Edit Transaction executed\n`);

    const mulltisgAccount = await meanMultisig.getMultisig(multisig);
    const newOwner = mulltisgAccount!.owners.find(a => a.address === additionalUser.publicKey.toBase58());

    if (!newOwner) {
      throw new Error("New owner not found");
    }
  });
});
