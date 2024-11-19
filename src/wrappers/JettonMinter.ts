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
import minterData from '../build/JettonMinter.compiled.json';
import { jettonWalletCode } from './JettonWallet';

const jettonMinterCode: Cell = Cell.fromHex(minterData.hex);

export type JettonMinterConfig = {
    admin: Address;
    content: Cell;
    walletСode?: Cell;
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(config.admin)
        .storeRef(config.content)
        .storeRef(config.walletСode ? config.walletСode : jettonWalletCode)
        .endCell();
}

export function jettonContentToCell(uri: string): Cell {
    return beginCell().storeUint(1, 8).storeStringTail(uri).endCell();
}

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell = jettonMinterCode, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            to: Address;
            jettonAmount: bigint;
            fwdTonAmount: bigint;
            totalTonAmount: bigint;
        },
    ) {
        await provider.internal(via, {
            value: toNano('0.1') + opts.totalTonAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1674b0a0, 32)
                .storeUint(0, 64)
                .storeAddress(opts.to)
                .storeCoins(opts.jettonAmount)
                .storeCoins(opts.fwdTonAmount)
                .storeCoins(opts.totalTonAmount)
                .endCell(),
        });
    }

    async sendDiscovery(
        provider: ContractProvider,
        via: Sender,
        owner: Address,
        includeAddress: boolean,
        value: bigint = toNano('0.1'),
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x2c76b973, 32)
                .storeUint(0, 64)
                .storeAddress(owner)
                .storeBit(includeAddress)
                .endCell(),
        });
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x4840664f, 32).storeUint(0, 64).storeAddress(newOwner).endCell(),
        });
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x5773d1f5, 32).storeUint(0, 64).storeRef(content).endCell(),
        });
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const result = (
            await provider.get('get_wallet_address', [
                { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
            ])
        ).stack;
        return result.readAddress();
    }

    async getJettonData(provider: ContractProvider) {
        const result = (await provider.get('get_jetton_data', [])).stack;
        const totalSupply = result.readBigNumber();
        const mintable = result.readBoolean();
        const adminAddress = result.readAddress();
        const content = result.readCell();
        const walletCode = result.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode,
        };
    }

    async getTotalSupply(provider: ContractProvider): Promise<bigint> {
        const result = await this.getJettonData(provider);
        return result.totalSupply;
    }

    async getAdminAddress(provider: ContractProvider): Promise<Address> {
        const result = await this.getJettonData(provider);
        return result.adminAddress;
    }

    async getContent(provider: ContractProvider): Promise<Cell> {
        const result = await this.getJettonData(provider);
        return result.content;
    }
}
