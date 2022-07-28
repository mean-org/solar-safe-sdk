import * as fs from "fs-extra";
import {join} from "path";
import {homedir} from "os";
import {Keypair, Transaction} from '@solana/web3.js';

export const getDefaultKeyPair = async (): Promise<Keypair> => {
    const id = await fs.readJSON(join(homedir(), '.config/solana/id.json'));
    const bytes = Uint8Array.from(id);
    return Keypair.fromSecretKey(bytes);
};

export const _printSerializedTx = (tx: Transaction, requireAllSignatures = false, verifySignatures = false) => {
    console.log(tx.serialize({
        requireAllSignatures,
        verifySignatures,
    }).toString('base64'));
}

export function sleep(ms: number) {
    console.log('Sleeping for', ms / 1000, 'seconds');
    return new Promise((resolve) => setTimeout(resolve, ms));
}
