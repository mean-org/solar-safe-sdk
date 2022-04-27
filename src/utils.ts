import { Commitment, Connection, ConnectionConfig, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program, utils, Wallet, web3 } from "@project-serum/anchor";
import { MultisigTransactionFees, MultisigTransactionStatus, MULTISIG_ACTIONS } from "./types";

export const createConnection = (
  url: string,
  commitmentOrConfig?: Commitment | ConnectionConfig | undefined

): Connection => {
  return new Connection(url, commitmentOrConfig || "confirmed");
};

export const createReadonlyWallet = (pubKey: PublicKey): Wallet => {
  return {
    publicKey: pubKey,
    signAllTransactions: async (txs: any) => txs,
    signTransaction: async (tx: any) => tx,
    payer: Keypair.generate(), // dummy unused payer
  };
};

export const createAnchorProvider = (
  rpcUrl: string,
  wallet: Wallet,
  opts?: web3.ConfirmOptions

): AnchorProvider => {

  opts = opts ?? AnchorProvider.defaultOptions();
  const connection = new Connection(rpcUrl, opts.preflightCommitment);
  const provider = new AnchorProvider(connection, wallet, opts);
  return provider;
};

export const createProgram = (
  rpcUrl: string,
  wallet: Wallet,
  programId: PublicKey,
  idl: Idl,
  confirmOptions?: web3.ConfirmOptions

): Program<Idl> => {

  const provider = createAnchorProvider(rpcUrl, wallet, confirmOptions);
  const program = new Program(idl, programId, provider);
  return program;
};

export const getFees = async (
  program: Program<Idl>,
  action: MULTISIG_ACTIONS

): Promise<MultisigTransactionFees> => {
    
  let txFees: MultisigTransactionFees = {
    networkFee: 0.0,
    rentExempt: 0.0,
    multisigFee: 0.02,
  };

  switch (action) {
    case MULTISIG_ACTIONS.createMultisig: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          program.account.multisigV2.size
        );
      break;
    }
    case MULTISIG_ACTIONS.createTransaction: {
      txFees.networkFee = 0.00001;
      txFees.rentExempt =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          1500
        );
      break;
    }
    case MULTISIG_ACTIONS.cancelTransaction: {
      txFees.networkFee = 0.000005;
      txFees.rentExempt = 0.0;
      break;
    }
    default: {
      break;
    }
  }

  txFees.rentExempt = txFees.rentExempt / LAMPORTS_PER_SOL;

  return txFees;
};

export const getTransactionStatus = (
  multisig: any,
  info: any,
  detail: any

): MultisigTransactionStatus => {

  try {
    if (!multisig) {
      throw Error("Invalid parameter: 'multisig'");
    }

    const executed = info.account.executedOn && info.account.executedOn.toNumber() > 0;

    if (executed) {
      return MultisigTransactionStatus.Executed;
    }

    const expirationDate =
      !executed && detail && detail.expirationDate > 0
        ? new Date(detail.expirationDate.toNumber() * 1_000)
        : undefined;

    if (expirationDate && expirationDate.getTime() < Date.now()) {
      return MultisigTransactionStatus.Expired;
    }

    let status = MultisigTransactionStatus.Pending;
    let approvals = info.account.signers.filter(
      (s: boolean) => s === true
    ).length;

    if (multisig && multisig.threshold === approvals) {
      status = MultisigTransactionStatus.Approved;
    }

    if (multisig && multisig.ownerSeqNumber !== info.account.ownerSetSeqno) {
      status = MultisigTransactionStatus.Voided;
    }

    return status;

  } catch (err) {
    throw Error(`Multisig Transaction Status: ${err}`);
  }
};
