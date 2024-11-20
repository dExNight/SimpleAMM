import { beginCell, Builder, Cell } from '@ton/core';
import { Opcodes } from './constants';

export function buildLpDepositPayload(): Cell {
    return beginCell().storeUint(Opcodes.OP_DEPOSIT, 32).endCell();
}
export function buildLpSwapPayload(minAmountOut: bigint): Cell {
    return beginCell().storeUint(Opcodes.OP_SWAP, 32).storeCoins(minAmountOut).endCell();
}
