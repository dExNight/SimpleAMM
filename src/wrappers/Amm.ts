import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type AmmConfig = {};

export function ammConfigToCell(config: AmmConfig): Cell {
    return beginCell().endCell();
}

export class Amm implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Amm(address);
    }

    static createFromConfig(config: AmmConfig, code: Cell, workchain = 0) {
        const data = ammConfigToCell(config);
        const init = { code, data };
        return new Amm(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
