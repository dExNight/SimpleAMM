export class LpPriceCalculator {
    tokenAName: string;
    tokenBName: string;
    tokenADecimals: number;
    tokenBDecimals: number;

    constructor(lpName: string, tokenADecimals: number, tokenBDecimals: number) {
        this.tokenAName = lpName.split('/')[0];
        this.tokenBName = lpName.split('/')[1];
        this.tokenADecimals = tokenADecimals;
        this.tokenBDecimals = tokenBDecimals;
    }

    calculateTokenPrice(tokenA: bigint, tokenB: bigint): { priceAtoB: number; priceBtoA: number } {
        const oneTokenA = BigInt('1' + '0'.repeat(this.tokenADecimals));
        const oneTokenB = BigInt('1' + '0'.repeat(this.tokenBDecimals));
        // A -> B price
        const priceAtoB =
            Number((oneTokenA * tokenB * 997n) / (tokenA * 1000n + oneTokenA * 997n)) / 10 ** this.tokenBDecimals;

        // B -> A price
        const priceBtoA =
            Number((oneTokenB * tokenA * 997n) / (tokenB * 1000n + oneTokenB * 997n)) / 10 ** this.tokenADecimals;

        return { priceAtoB, priceBtoA };
    }

    calculateExpectedOutput(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
        return (amountIn * reserveOut * 997n) / (reserveIn * 1000n + amountIn * 997n);
    }
}
