import { toNano } from '@ton/core';
import { Amm } from '../wrappers/Amm';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const amm = provider.open(Amm.createFromConfig({}, await compile('Amm')));

    await amm.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(amm.address);

    // run methods on `amm`
}
