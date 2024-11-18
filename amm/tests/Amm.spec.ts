import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Amm } from '../wrappers/Amm';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Amm', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Amm');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let amm: SandboxContract<Amm>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        amm = blockchain.openContract(Amm.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await amm.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: amm.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and amm are ready to use
    });
});
