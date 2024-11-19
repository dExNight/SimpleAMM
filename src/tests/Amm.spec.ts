import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Amm } from '../wrappers/Amm';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';

const LpName: string = 'NOT/USDT';

describe('Amm', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Amm');
    });

    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let amm: SandboxContract<Amm>;

    let jettonAMinter: SandboxContract<JettonMinter>;
    let jettonBMinter: SandboxContract<JettonMinter>;
    let jettonAAmmWallet: SandboxContract<JettonWallet>;
    let jettonBAmmWallet: SandboxContract<JettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('admin');

        jettonAMinter = blockchain.openContract(
            JettonMinter.createFromConfig({
                admin: admin.address,
                content: beginCell().storeBit(0).endCell(),
            }),
        );
        jettonBMinter = blockchain.openContract(
            JettonMinter.createFromConfig({
                admin: admin.address,
                content: beginCell().storeBit(1).endCell(),
            }),
        );

        await jettonAMinter.sendDeploy(admin.getSender(), toNano('0.05'));
        await jettonBMinter.sendDeploy(admin.getSender(), toNano('0.05'));

        // Mint 10000 jettons
        await jettonAMinter.sendMint(admin.getSender(), {
            to: admin.address,
            jettonAmount: toNano('10000'),
            fwdTonAmount: 1n,
            totalTonAmount: toNano('0.05'),
        });
        await jettonBMinter.sendMint(admin.getSender(), {
            to: admin.address,
            jettonAmount: toNano('10000'),
            fwdTonAmount: 1n,
            totalTonAmount: toNano('0.05'),
        });

        amm = blockchain.openContract(
            Amm.createFromConfig(
                {
                    adminAddress: admin.address,
                    lpName: LpName,
                },
                code,
            ),
        );

        jettonAAmmWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonAMinter.getWalletAddress(amm.address)),
        );
        jettonBAmmWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonBMinter.getWalletAddress(amm.address)),
        );

        const deployResult = await amm.sendDeploy(admin.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: amm.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and amm are ready to use
    });

    it('should successfuly initialize', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
        });
        expect(initializeResult.transactions).toHaveTransaction({
            from: admin.address,
            to: amm.address,
            success: true,
        });

        const { init, lpName, tokenAWalletAddress, tokenBWalletAddress } = await amm.getLpStorage();
        expect(init).toBeTruthy();
        expect(lpName).toEqual(LpName);
        expect(tokenAWalletAddress).toEqualAddress(jettonAAmmWallet.address);
        expect(tokenBWalletAddress).toEqualAddress(jettonBAmmWallet.address);
    });
});
