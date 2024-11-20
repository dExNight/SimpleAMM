import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Amm } from '../wrappers/Amm';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { buildLpDepositPayload } from '../wrappers/payload';
import { Opcodes } from '../wrappers/constants';
import { DepositHelper } from '../wrappers/DepositHelper';

const LpName: string = 'NOT/USDT';
const INITIAL_JETTONS_TO_DEPOSIT: bigint = toNano('1000');
const JETTONS_A_TO_DEPOSIT: bigint = toNano('500');
const JETTONS_B_TO_DEPOSIT: bigint = toNano('700');

describe('Amm', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Amm');
    });

    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let amm: SandboxContract<Amm>;
    let userDepositHelper: SandboxContract<DepositHelper>;

    let jettonAMinter: SandboxContract<JettonMinter>;
    let jettonBMinter: SandboxContract<JettonMinter>;
    let jettonAAmmWallet: SandboxContract<JettonWallet>;
    let jettonBAmmWallet: SandboxContract<JettonWallet>;
    let userJettonAWallet: SandboxContract<JettonWallet>;
    let userJettonBWallet: SandboxContract<JettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');

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

        // Mint 10000 jettons for user
        await jettonAMinter.sendMint(admin.getSender(), {
            to: user.address,
            jettonAmount: toNano('10000'),
            fwdTonAmount: 1n,
            totalTonAmount: toNano('0.05'),
        });
        await jettonBMinter.sendMint(admin.getSender(), {
            to: user.address,
            jettonAmount: toNano('10000'),
            fwdTonAmount: 1n,
            totalTonAmount: toNano('0.05'),
        });

        amm = blockchain.openContract(
            Amm.createFromConfig(
                {
                    adminAddress: admin.address,
                    lpName: LpName,
                    depositHelperCode: await compile('DepositHelper'),
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
        userJettonAWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonAMinter.getWalletAddress(user.address)),
        );
        userJettonBWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await jettonBMinter.getWalletAddress(user.address)),
        );

        const deployResult = await amm.sendDeploy(admin.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: amm.address,
            deploy: true,
            success: true,
        });

        userDepositHelper = blockchain.openContract(
            DepositHelper.createFromAddress(await amm.getHelperAddresss(user.address)),
        );
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

    it('should successfuly provide liquidity', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
        });
        const addLiquidityAResult = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: INITIAL_JETTONS_TO_DEPOSIT,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });

        expect(addLiquidityAResult.transactions).toHaveTransaction({
            from: jettonAAmmWallet.address,
            to: amm.address,
            success: true,
            op: Opcodes.transfer_notification,
        });

        expect(addLiquidityAResult.transactions).toHaveTransaction({
            from: amm.address,
            to: userDepositHelper.address,
            success: true,
            op: Opcodes.OP_LIQUDITY_PROVISION,
        });

        const { tokenA: tokenABefore, tokenB: tokenBBefore } = await userDepositHelper.getStorage();
        expect(tokenABefore).toEqual(INITIAL_JETTONS_TO_DEPOSIT);
        expect(tokenBBefore).toEqual(0n);

        const addLiquidityBResult = await userJettonBWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: INITIAL_JETTONS_TO_DEPOSIT,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });

        expect(addLiquidityBResult.transactions).toHaveTransaction({
            from: jettonBAmmWallet.address,
            to: amm.address,
            success: true,
            op: Opcodes.transfer_notification,
        });

        expect(addLiquidityBResult.transactions).toHaveTransaction({
            from: amm.address,
            to: userDepositHelper.address,
            success: true,
            op: Opcodes.OP_LIQUDITY_PROVISION,
        });

        expect(addLiquidityBResult.transactions).toHaveTransaction({
            from: userDepositHelper.address,
            to: amm.address,
            success: true,
            op: Opcodes.OP_LIQUDITY_PROVIDED,
        });

        const { tokenA, tokenB, k } = await amm.getLpStorage();
        const expectedK: bigint = INITIAL_JETTONS_TO_DEPOSIT * INITIAL_JETTONS_TO_DEPOSIT;
        expect(tokenA).toEqual(INITIAL_JETTONS_TO_DEPOSIT);
        expect(tokenB).toEqual(INITIAL_JETTONS_TO_DEPOSIT);
        expect(k).toEqual(expectedK);
    });

    it('should successfuly provide liquidity 2', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
        });
        const addLiquidityAResult = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: INITIAL_JETTONS_TO_DEPOSIT,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });
        const addLiquidityBResult = await userJettonBWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: INITIAL_JETTONS_TO_DEPOSIT,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });
    });
});
