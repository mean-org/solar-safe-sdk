import * as BufferLayout from 'buffer-layout';
import { AccountMeta, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { Idl, Instruction } from '@project-serum/anchor';
import { InstructionDisplay } from '@project-serum/anchor/dist/cjs/coder/borsh/instruction';
import { SplTokenInstructionCoder } from '@project-serum/anchor/dist/cjs/coder/spl-token/instruction';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { sentenceCase } from '../utils';

export class MeanSplTokenInstructionCoder extends SplTokenInstructionCoder {
  readonly idl: Idl;

  constructor(idl: Idl) {
    super(idl);
    this.idl = idl;
  }

  public decode(ix: Buffer | string, encoding: 'hex' | 'base58' = 'hex'): Instruction | null {
    if (typeof ix === 'string') {
      ix = encoding === 'hex' ? Buffer.from(ix, 'hex') : bs58.decode(ix);
    }

    const tag = ix.slice(0, 1);
    const data = ix.slice(1);
    const variant = LAYOUT.getVariant(tag, 0);

    return {
      data: variant.layout.decode(data),
      name: variant.property
    };
  }

  public format(ix: Instruction, accountMetas: AccountMeta[]): InstructionDisplay | null {
    const variant: any = Object.values(LAYOUT.registry).filter((v: any) => v.property === ix.name)[0];
    const idlIx = this.idl.instructions.filter(i => i.name === ix.name)[0];

    if (!variant || !idlIx) {
      return null;
    }

    const args: any[] = [];

    for (const arg of Object.keys(ix.data)) {
      const field = idlIx.args.filter(a => a.name === arg)[0] as any;
      const value = (ix.data as any)[arg];
      if (field && value) {
        args.push({
          name: field.name,
          type: field.type,
          data:
            field.type === 'publicKey' ||
            (typeof field.type === 'object' && field.type.coption && field.type.coption === 'publicKey')
              ? new PublicKey(value as PublicKeyInitData).toString()
              : value.toString()
        });
      }
    }

    const accounts: any = [];

    for (let i = 0; i < accountMetas.length; i++) {
      const accName = sentenceCase(idlIx.accounts[i].name);
      accounts.push({
        name: accName,
        ...accountMetas[i]
      });
    }

    return { args, accounts } as InstructionDisplay;
  }
}

const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'));
LAYOUT.addVariant(
  0,
  BufferLayout.struct([
    BufferLayout.u8('decimals'),
    BufferLayout.blob(32, 'mintAuthority'),
    BufferLayout.u8('freezeAuthorityOption'),
    publicKey('freezeAuthority')
  ]),
  'initializeMint'
);
LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount');
LAYOUT.addVariant(2, BufferLayout.struct([BufferLayout.u8('m')]), 'initializeMultisig');
LAYOUT.addVariant(3, BufferLayout.struct([BufferLayout.nu64('amount')]), 'transfer');
LAYOUT.addVariant(4, BufferLayout.struct([BufferLayout.nu64('amount')]), 'approve');
LAYOUT.addVariant(5, BufferLayout.struct([]), 'revoke');
LAYOUT.addVariant(
  6,
  BufferLayout.struct([
    BufferLayout.u8('authorityType'),
    BufferLayout.u8('newAuthorityOption'),
    publicKey('newAuthority')
  ]),
  'setAuthority'
);
LAYOUT.addVariant(7, BufferLayout.struct([BufferLayout.nu64('amount')]), 'mintTo');
LAYOUT.addVariant(8, BufferLayout.struct([BufferLayout.nu64('amount')]), 'burn');
LAYOUT.addVariant(9, BufferLayout.struct([]), 'closeAccount');
LAYOUT.addVariant(10, BufferLayout.struct([]), 'freezeAccount');
LAYOUT.addVariant(11, BufferLayout.struct([]), 'thawAccount');
LAYOUT.addVariant(
  12,
  BufferLayout.struct([BufferLayout.nu64('amount'), BufferLayout.u8('decimals')]),
  'transferChecked'
);
LAYOUT.addVariant(
  13,
  BufferLayout.struct([BufferLayout.nu64('amount'), BufferLayout.u8('decimals')]),
  'approvedChecked'
);
LAYOUT.addVariant(14, BufferLayout.struct([BufferLayout.nu64('amount'), BufferLayout.u8('decimals')]), 'mintToChecked');
LAYOUT.addVariant(15, BufferLayout.struct([BufferLayout.nu64('amount'), BufferLayout.u8('decimals')]), 'burnedChecked');
LAYOUT.addVariant(16, BufferLayout.struct([publicKey('authority')]), 'InitializeAccount2');
LAYOUT.addVariant(17, BufferLayout.struct([]), 'syncNative');
LAYOUT.addVariant(18, BufferLayout.struct([publicKey('authority')]), 'initializeAccount3');
LAYOUT.addVariant(19, BufferLayout.struct([BufferLayout.u8('m')]), 'initializeMultisig2');
LAYOUT.addVariant(
  20,
  BufferLayout.struct([
    BufferLayout.u8('decimals'),
    publicKey('mintAuthority'),
    BufferLayout.u8('freezeAuthorityOption'),
    publicKey('freezeAuthority')
  ]),
  'initializeMint2'
);

function publicKey(property: string): any {
  return BufferLayout.blob(32, property);
}
