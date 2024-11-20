import { beginCell, Builder, Cell } from '@ton/core';
import { Opcodes } from './constants';

export function buildLpDepositPayload(): Cell {
    return beginCell().storeUint(Opcodes.OP_DEPOSIT, 32).endCell();
}
