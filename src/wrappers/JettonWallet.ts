import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';
import walletData from '../build/JettonWallet.compiled.json';
import { Gas, Opcodes } from './constants';

export type JettonWalletConfig = {};

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell().endCell();
}

export const jettonWalletCode: Cell = Cell.fromHex(walletData.hex);

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell = jettonWalletCode, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            toAddress: Address;
            fwdAmount: bigint;
            jettonAmount: bigint;
            fwdPayload: Cell;
            queryId?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.transfer_jetton, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.toAddress)
                .storeAddress(via.address)
                .storeUint(0, 1)
                .storeCoins(opts.fwdAmount)
                .storeUint(1, 1)
                .storeRef(opts.fwdPayload)
                .endCell(),
        });
    }

    async sendBurnRequest(
        provider: ContractProvider,
        via: Sender,
        opts: {
            jettonAmount: bigint;
            queryId?: number;
        },
    ) {
        await provider.internal(via, {
            value: Gas.burn_lp + toNano(0.1),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.burn_jetton, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(via.address)
                .storeUint(0, 1)
                .endCell(),
        });
    }

    async getJettonBalance(provider: ContractProvider): Promise<bigint> {
        const result = (await provider.get('get_wallet_data', [])).stack;
        return result.readBigNumber();
    }

    async getWalletData(provider: ContractProvider) {
        const { stack } = await provider.get('get_wallet_data', []);

        return {
            jettonBalance: stack.readNumber(),
            ownerAddress: stack.readAddress(),
            jettonMasterAddress: stack.readAddress(),
            jettonWalletCode: stack.readCell(),
        };
    }
}
