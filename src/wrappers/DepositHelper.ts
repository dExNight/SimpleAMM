import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type DepositHelperConfig = {
    lpAddress: Address;
    ownerAddress: Address;
};

export function depositHelperConfigToCell(config: DepositHelperConfig): Cell {
    return beginCell()
        .storeAddress(config.lpAddress)
        .storeAddress(config.ownerAddress)
        .storeCoins(0)
        .storeCoins(0)
        .endCell();
}

export class DepositHelper implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new DepositHelper(address);
    }

    static createFromConfig(config: DepositHelperConfig, code: Cell, workchain = 0) {
        const data = depositHelperConfigToCell(config);
        const init = { code, data };
        return new DepositHelper(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getStorage(provider: ContractProvider) {
        const result = (await provider.get('deposit_helper_storage', [])).stack;

        return {
            lpAddress: result.readAddress(),
            ownerAddress: result.readAddress(),
            tokenA: result.readBigNumber(),
            tokenB: result.readBigNumber(),
        };
    }
}
