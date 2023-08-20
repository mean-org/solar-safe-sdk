import * as BufferLayout from 'buffer-layout';
import { BN, Instruction, InstructionCoder } from '@project-serum/anchor';
import camelCase from 'camelcase';
import { struct } from '@project-serum/borsh';
import { AccountMeta } from '@solana/web3.js';
import { InstructionDisplay } from '@project-serum/anchor/dist/cjs/coder/borsh/instruction';
import { sentenceCase } from '../utils';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';

export class MeanSystemInstructionCoder implements InstructionCoder {
  encode(ixName: string, ix: any): Buffer {
    switch (camelCase(ixName)) {
      case 'createAccount': {
        return encodeCreateAccount(ix);
      }
      case 'assign': {
        return encodeAssign(ix);
      }
      case 'transfer': {
        return encodeTransfer(ix);
      }
      case 'createAccountWithSeed': {
        return encodeCreateAccountWithSeed(ix);
      }
      case 'advanceNonceAccount': {
        return encodeAdvanceNonceAccount(ix);
      }
      case 'withdrawNonceAccount': {
        return encodeWithdrawNonceAccount(ix);
      }
      case 'initializeNonceAccount': {
        return encodeInitializeNonceAccount(ix);
      }
      case 'authorizeNonceAccount': {
        return encodeAuthorizeNonceAccount(ix);
      }
      case 'allocate': {
        return encodeAllocate(ix);
      }
      case 'allocateWithSeed': {
        return encodeAllocateWithSeed(ix);
      }
      case 'assignWithSeed': {
        return encodeAssignWithSeed(ix);
      }
      case 'transferWithSeed': {
        return encodeTransferWithSeed(ix);
      }
      default: {
        throw new Error(`Invalid instruction: ${ixName}`);
      }
    }
  }

  encodeState(_ixName: string, _ix: any): Buffer {
    throw new Error('System does not have state');
  }

  public decode(ix: Buffer | string, encoding: 'hex' | 'base58' = 'hex'): Instruction | null {
    if (typeof ix === 'string') {
      ix = encoding === 'hex' ? Buffer.from(ix, 'hex') : bs58.decode(ix);
    }

    // console.log('ix', ix);
    const tag = ix.slice(0, 4).readInt16LE();
    // console.log('tag', tag);
    const data = ix.slice(4);
    // console.log('data', data);
    const variant = LAYOUT.getVariant(tag, 0);
    // console.log('variant', variant);
    // console.log('decoded data', variant.layout.decode(data));

    return {
      data: variant.layout.decode(data),
      name: variant.property
    };
  }

  public format(ix: Instruction, accountMetas: AccountMeta[]): InstructionDisplay | null {
    const variant: any = Object.values(LAYOUT.registry).filter((v: any) => v.property === ix.name)[0];
    // const idlIx = this.idl.instructions.filter(i => i.name === ix.name)[0];
    // console.log('idlIx', idlIx);

    if (!variant) {
      return null;
    }
    // console.log('variant', variant);
    const args: any[] = [];

    for (const arg of Object.keys(ix.data)) {
      // console.log('arg', arg);
      const field = variant.layout.fields.filter((f: any) => f.property === arg)[0] as any;
      // console.log('field', field);
      const value = (ix.data as any)[arg];
      // console.log('value', value);
      if (field && value) {
        args.push({
          name: field.property,
          type: 'u64',
          data: value.toString()
        });
      }
    }

    // const accounts: any = [];
    const accounts = getIxAccounts(ix.name, accountMetas);

    return { args, accounts } as InstructionDisplay;
  }
}

class RustStringLayout extends BufferLayout.Layout<string | null> {
  layout = struct<
    Readonly<{
      length?: number;
      lengthPadding?: number;
      chars: Buffer;
    }>
  >(
    [
      BufferLayout.u32('length'),
      BufferLayout.u32('lengthPadding'),
      BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars')
    ],
    this.property
  );

  constructor(public property?: string) {
    super(-1, property);
  }

  encode(src: string | null, b: Buffer, offset = 0): number {
    if (src === null || src === undefined) {
      return this.layout.span;
    }

    const data = {
      chars: Buffer.from(src, 'utf8')
    };

    return this.layout.encode(data, b, offset);
  }

  decode(b: Buffer, offset = 0): string | null {
    const data = this.layout.decode(b, offset);
    return data['chars'].toString();
  }

  getSpan(b: Buffer, offset = 0): number {
    return (
      BufferLayout.u32().span +
      BufferLayout.u32().span +
      new BN(new Uint8Array(b).slice(offset, offset + 4), 10, 'le').toNumber()
    );
  }
}

function rustStringLayout(property: string) {
  return new RustStringLayout(property);
}

function publicKey(property: string): any {
  return BufferLayout.blob(32, property);
}

function encodeCreateAccount({ lamports, space, owner }: any): Buffer {
  return encodeData({
    createAccount: { lamports, space, owner: owner.toBuffer() }
  });
}

function encodeAssign({ owner }: any): Buffer {
  return encodeData({
    assign: { owner: owner.toBuffer() }
  });
}

function encodeTransfer({ lamports }: any): Buffer {
  return encodeData({
    transfer: { lamports }
  });
}

function encodeCreateAccountWithSeed({ base, seed, lamports, space, owner }: any): Buffer {
  return encodeData(
    {
      createAccountWithSeed: {
        base: base.toBuffer(),
        seed,
        lamports,
        space,
        owner: owner.toBuffer()
      }
    },
    LAYOUT.getVariant(3).span + seed.length
  );
}

function encodeInitializeNonceAccount({ authorized }: any): Buffer {
  return encodeData({
    initializeNonceAccount: { authorized: authorized.toBuffer() }
  });
}

function encodeAdvanceNonceAccount({ authorized }: any): Buffer {
  return encodeData({
    advanceNonceAccount: { authorized: authorized.toBuffer() }
  });
}

function encodeWithdrawNonceAccount({ lamports }: any): Buffer {
  return encodeData({
    withdrawNonceAccount: { lamports }
  });
}

function encodeAuthorizeNonceAccount({ authorized }: any): Buffer {
  return encodeData({
    authorizeNonceAccount: { authorized: authorized.toBuffer() }
  });
}

function encodeAllocate({ space }: any): Buffer {
  return encodeData({
    allocate: { space }
  });
}

function encodeAllocateWithSeed({ base, seed, space, owner }: any): Buffer {
  return encodeData(
    {
      allocateWithSeed: {
        base: base.toBuffer(),
        seed,
        space,
        owner: owner.toBuffer()
      }
    },
    LAYOUT.getVariant(9).span + seed.length
  );
}

function encodeAssignWithSeed({ base, seed, owner }: any): Buffer {
  return encodeData(
    {
      assignWithSeed: {
        base: base.toBuffer(),
        seed,
        owner: owner.toBuffer()
      }
    },
    LAYOUT.getVariant(10).span + seed.length
  );
}

function encodeTransferWithSeed({ lamports, seed, owner }: any): Buffer {
  return encodeData(
    {
      transferWithSeed: {
        lamports,
        seed,
        owner: owner.toBuffer()
      }
    },
    LAYOUT.getVariant(11).span + seed.length
  );
}

const LAYOUT = BufferLayout.union(BufferLayout.u32('instruction'));
LAYOUT.addVariant(
  0,
  BufferLayout.struct([BufferLayout.ns64('lamports'), BufferLayout.ns64('space'), publicKey('owner')]),
  'createAccount'
);
LAYOUT.addVariant(1, BufferLayout.struct([publicKey('owner')]), 'assign');
LAYOUT.addVariant(2, BufferLayout.struct([BufferLayout.ns64('lamports')]), 'transfer');
LAYOUT.addVariant(
  3,
  BufferLayout.struct([
    publicKey('base'),
    rustStringLayout('seed'),
    BufferLayout.ns64('lamports'),
    BufferLayout.ns64('space'),
    publicKey('owner')
  ]),
  'createAccountWithSeed'
);
LAYOUT.addVariant(4, BufferLayout.struct([publicKey('authorized')]), 'advanceNonceAccount');
LAYOUT.addVariant(5, BufferLayout.struct([BufferLayout.ns64('lamports')]), 'withdrawNonceAccount');
LAYOUT.addVariant(6, BufferLayout.struct([publicKey('authorized')]), 'initializeNonceAccount');
LAYOUT.addVariant(7, BufferLayout.struct([publicKey('authorized')]), 'authorizeNonceAccount');
LAYOUT.addVariant(8, BufferLayout.struct([BufferLayout.ns64('space')]), 'allocate');
LAYOUT.addVariant(
  9,
  BufferLayout.struct([publicKey('base'), rustStringLayout('seed'), BufferLayout.ns64('space'), publicKey('owner')]),
  'allocateWithSeed'
);
LAYOUT.addVariant(
  10,
  BufferLayout.struct([publicKey('base'), rustStringLayout('seed'), publicKey('owner')]),
  'assignWithSeed'
);
LAYOUT.addVariant(
  11,
  BufferLayout.struct([BufferLayout.ns64('lamports'), rustStringLayout('seed'), publicKey('owner')]),
  'transferWithSeed'
);

function encodeData(instruction: any, maxSpan?: number): Buffer {
  const b = Buffer.alloc(maxSpan ?? instructionMaxSpan);
  const span = LAYOUT.encode(instruction, b);

  if (maxSpan === undefined) {
    return b.slice(0, span);
  }

  return b;
}

const instructionMaxSpan = Math.max(...Object.values(LAYOUT.registry).map((r: any) => r.span));

const getIxAccounts = (name: string, keys: AccountMeta[]): any[] => {
  switch (name) {
    case 'transfer':
      return [
        { name: sentenceCase('from'), ...keys[0] },
        { name: sentenceCase('to'), ...keys[1] }
      ];
    default:
      return [];
  }
};
