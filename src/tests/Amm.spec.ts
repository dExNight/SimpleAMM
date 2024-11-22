import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, fromNano, toNano } from '@ton/core';
import { Amm } from '../wrappers/Amm';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { buildLpDepositPayload, buildLpSwapPayload } from '../wrappers/payload';
import { Opcodes } from '../wrappers/constants';
import { DepositHelper } from '../wrappers/DepositHelper';
import { LpPriceCalculator } from '../utils/tokenPriceCalculator';

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
    let userLpTokensWallet: SandboxContract<JettonWallet>;

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
                    jettonWalletCode: await compile('LpWallet'),
                    content: beginCell().endCell(),
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

        userLpTokensWallet = blockchain.openContract(
            JettonWallet.createFromAddress(await amm.getWalletAddresss(user.address)),
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
            swapComission: 3,
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

    it('should successfuly provide liquidity & mint lp tokens', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
            swapComission: 3,
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

        expect(addLiquidityBResult.transactions).toHaveTransaction({
            from: amm.address,
            to: userLpTokensWallet.address,
            success: true,
            op: Opcodes.internal_transfer,
        });

        const { tokenA, tokenB, k, totalSupply } = await amm.getLpStorage();
        const expectedK: bigint = INITIAL_JETTONS_TO_DEPOSIT * INITIAL_JETTONS_TO_DEPOSIT;
        expect(tokenA).toEqual(INITIAL_JETTONS_TO_DEPOSIT);
        expect(tokenB).toEqual(INITIAL_JETTONS_TO_DEPOSIT);
        expect(k).toEqual(expectedK);
        expect(Number(totalSupply)).toBeCloseTo(Math.sqrt(Number(k)));

        const userLpBalance = await userLpTokensWallet.getJettonBalance();
        expect(userLpBalance).toEqual(totalSupply);
    });

    it('should successfuly provide liquidity 2', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
            swapComission: 3,
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

    it('should successfuly swap', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
            swapComission: 3,
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

        const swapAAmount = toNano('100');
        const minBAmountOut = toNano('90');
        const expectedBAmountOut = await amm.getExpectedAmountOut({
            amountIn: swapAAmount,
            isTokenA: true,
        });
        const userBalanceBefore = await userJettonBWallet.getJettonBalance();

        const swapResult = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: swapAAmount,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpSwapPayload(minBAmountOut),
            value: toNano('0.5'),
        });

        expect(swapResult.transactions).toHaveTransaction({
            from: jettonAAmmWallet.address,
            to: amm.address,
            success: true,
            op: Opcodes.transfer_notification,
        });

        expect(swapResult.transactions).toHaveTransaction({
            from: amm.address,
            to: jettonBAmmWallet.address,
            success: true,
            op: Opcodes.transfer_jetton,
        });

        const userBalanceAfter = await userJettonBWallet.getJettonBalance();
        expect(userBalanceAfter - userBalanceBefore).toBeGreaterThanOrEqual(expectedBAmountOut);

        const { tokenA, tokenB, k } = await amm.getLpStorage();
        expect(tokenA).toBeGreaterThan(INITIAL_JETTONS_TO_DEPOSIT);
        expect(tokenB).toBeLessThan(INITIAL_JETTONS_TO_DEPOSIT);
        expect(k).toBeGreaterThanOrEqual(INITIAL_JETTONS_TO_DEPOSIT * INITIAL_JETTONS_TO_DEPOSIT);
    });

    it('should successfuly swap 2', async () => {
        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
            swapComission: 3,
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

        const swapAAmount = toNano('100');
        const minBAmountOut = toNano('90');

        const swapResult = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: swapAAmount,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpSwapPayload(minBAmountOut),
            value: toNano('0.5'),
        });

        const secondSwapAAmount = swapAAmount * 1n;
        const expectedBAmountOut = await amm.getExpectedAmountOut({
            amountIn: secondSwapAAmount,
            isTokenA: true,
        });

        const userBalanceBefore = await userJettonBWallet.getJettonBalance();

        const swapResult2 = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: secondSwapAAmount,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpSwapPayload(expectedBAmountOut),
            value: toNano('0.5'),
        });

        expect(swapResult2.transactions).toHaveTransaction({
            from: jettonAAmmWallet.address,
            to: amm.address,
            success: true,
            op: Opcodes.transfer_notification,
        });

        expect(swapResult2.transactions).toHaveTransaction({
            from: amm.address,
            to: jettonBAmmWallet.address,
            success: true,
            op: Opcodes.transfer_jetton,
        });

        const userBalanceAfter = await userJettonBWallet.getJettonBalance();
        expect(userBalanceAfter - userBalanceBefore).toBeGreaterThanOrEqual(expectedBAmountOut);
        console.log('User received: ', fromNano(userBalanceAfter - userBalanceBefore));

        const { tokenA, tokenB, k } = await amm.getLpStorage();
        expect(tokenA).toBeGreaterThan(INITIAL_JETTONS_TO_DEPOSIT);
        expect(tokenB).toBeLessThan(INITIAL_JETTONS_TO_DEPOSIT);
        expect(k).toBeGreaterThanOrEqual(INITIAL_JETTONS_TO_DEPOSIT * INITIAL_JETTONS_TO_DEPOSIT);
    });

    it('should compute token prices', async () => {
        const notDecimals: number = 9;
        const usdtDecimals: number = 6;
        const notToDeposit: number = 1000 * 10 ** notDecimals;
        const usdtToDeposit: number = 100 * 10 ** usdtDecimals;

        const initializeResult = await amm.sendInitialize(admin.getSender(), {
            tokenAWallet: jettonAAmmWallet.address,
            tokenBWallet: jettonBAmmWallet.address,
            swapComission: 3,
        });
        const addLiquidityAResult = await userJettonAWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: BigInt(notToDeposit),
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });
        const addLiquidityBResult = await userJettonBWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: BigInt(usdtToDeposit),
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpDepositPayload(),
            value: toNano('0.5'),
        });

        const { tokenA: tokenAInitial, tokenB: tokenBInitial } = await amm.getLpStorage();

        // Initially in the pool: 1000 NOT and 1000000 USDT
        const priceCalculator = new LpPriceCalculator(LpName, notDecimals, usdtDecimals);
        const { priceAtoB, priceBtoA } = priceCalculator.calculateTokenPrice(tokenAInitial, tokenBInitial);

        console.log('Price for 1 NOT = ', priceAtoB, 'USDT');
        console.log('Price for 1 USDT = ', priceBtoA, 'NOT');

        const expectedAmount = await amm.getExpectedAmountOut({
            amountIn: BigInt(10 * 10 ** usdtDecimals),
            isTokenA: false,
        });

        const swapBAmount = 10n * BigInt(10 ** usdtDecimals);
        const minAAmountOut = expectedAmount;

        const userBalanceBefore: bigint = await userJettonAWallet.getJettonBalance();

        const swapResult = await userJettonBWallet.sendTransfer(user.getSender(), {
            toAddress: amm.address,
            jettonAmount: swapBAmount,
            fwdAmount: toNano('0.25'),
            fwdPayload: buildLpSwapPayload(minAAmountOut),
            value: toNano('0.5'),
        });

        expect(swapResult.transactions).toHaveTransaction({
            from: jettonBAmmWallet.address,
            to: amm.address,
            success: true,
            op: Opcodes.transfer_notification,
        });

        expect(swapResult.transactions).toHaveTransaction({
            from: amm.address,
            to: jettonAAmmWallet.address,
            success: true,
            op: Opcodes.transfer_jetton,
        });

        const userBalanceAfter: bigint = await userJettonAWallet.getJettonBalance();
        const received = fromNano(userBalanceAfter - userBalanceBefore);
        console.log('User received: ', received, 'NOT');

        // Проверяем что получили примерно 99.7 NOT
        expect(Number(received)).toBeGreaterThanOrEqual(Number(expectedAmount) / 10 ** notDecimals);
    });
});
