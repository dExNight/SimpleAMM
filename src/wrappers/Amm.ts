import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    TupleBuilder,
} from '@ton/core';
import { Gas, Opcodes } from './constants';

export type AmmConfig = {
    adminAddress: Address;
    lpName: string;
    depositHelperCode: Cell;
    jettonWalletCode: Cell;
    content: Cell;
};

export function ammConfigToCell(config: AmmConfig): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeAddress(config.adminAddress)
        .storeCoins(0)
        .storeCoins(0)
        .storeUint(0, 256)
        .storeCoins(0)
        .storeRef(
            beginCell()
                .storeAddress(null)
                .storeAddress(null)
                .storeUint(0, 32)
                .storeRef(beginCell().storeStringTail(config.lpName).endCell())
                .endCell(),
        )
        .storeRef(config.depositHelperCode)
        .storeRef(config.jettonWalletCode)
        .storeRef(config.content)
        .endCell();
}

export class Amm implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

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

    async sendInitialize(
        provider: ContractProvider,
        via: Sender,
        params: {
            tokenAWallet: Address;
            tokenBWallet: Address;
            swapComission: number;
        },
        opts?: { queryId: number },
    ) {
        await provider.internal(via, {
            value: Gas.initialize,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.OP_INITIALIZE_LP, 32)
                .storeUint(opts ? opts.queryId : 0, 64)
                .storeAddress(params.tokenAWallet)
                .storeAddress(params.tokenBWallet)
                .storeUint(params.swapComission, 32)
                .endCell(),
        });
    }

    async getLpStorage(provider: ContractProvider) {
        const result = (await provider.get('lp_storage', [])).stack;

        return {
            init: result.readNumber() === 1,
            adminAddress: result.readAddress(),
            tokenA: result.readBigNumber(),
            tokenB: result.readBigNumber(),
            k: result.readBigNumber(),
            tokenAWalletAddress: result.readAddressOpt(),
            tokenBWalletAddress: result.readAddressOpt(),
            lpName: result.readString(),
        };
    }

    async getHelperAddresss(provider: ContractProvider, userAddress: Address) {
        const params = new TupleBuilder();
        params.writeAddress(userAddress);
        const result = (await provider.get('get_helper_address', params.build())).stack;

        return result.readAddress();
    }

    async getExpectedAmountOut(
        provider: ContractProvider,
        opts: {
            amountIn: bigint;
            isTokenA: boolean;
        },
    ) {
        const params = new TupleBuilder();
        params.writeNumber(opts.amountIn);
        params.writeNumber(opts.isTokenA ? -1 : 0);
        const result = (await provider.get('expected_amount_out', params.build())).stack;

        return result.readBigNumber();
    }

    async getPriceImpact(
        provider: ContractProvider,
        opts: {
            amountIn: bigint;
            isTokenA: boolean;
        },
    ) {
        const params = new TupleBuilder();
        params.writeNumber(opts.amountIn);
        params.writeNumber(opts.isTokenA ? -1 : 0);
        const result = (await provider.get('price_impact', params.build())).stack;
        const numerator: number = Number(result.readBigNumber());
        const denominator: number = Number(result.readBigNumber());
        return numerator / denominator;
    }
}
