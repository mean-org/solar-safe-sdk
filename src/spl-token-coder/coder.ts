import { Idl } from '@project-serum/anchor';
import { SplTokenAccountsCoder } from '@project-serum/anchor/dist/cjs/coder/spl-token/accounts';
import { SplTokenEventsCoder } from '@project-serum/anchor/dist/cjs/coder/spl-token/events';
import { SplTokenStateCoder } from '@project-serum/anchor/dist/cjs/coder/spl-token/state';
import { MeanSplTokenInstructionCoder } from './instruction';

/**
 * Coder for the SPL token program.
 */
export class MeanSplTokenCoder {
  readonly instruction: MeanSplTokenInstructionCoder;
  readonly accounts: SplTokenAccountsCoder;
  readonly state: SplTokenStateCoder;
  readonly events: SplTokenEventsCoder;

  constructor(idl: Idl) {
    this.instruction = new MeanSplTokenInstructionCoder(idl);
    this.accounts = new SplTokenAccountsCoder(idl);
    this.events = new SplTokenEventsCoder(idl);
    this.state = new SplTokenStateCoder(idl);
  }
}
