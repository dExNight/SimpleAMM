import "constants.tolk";
import "utils.tolk";

fun calculateUserJettonWalletAddress(ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell): (slice, cell) {
    var data: cell = beginCell()
                .storeCoins(0)
                .storeSlice(ownerAddress)
                .storeSlice(jettonMasterAddress)
                .storeRef(jettonWalletCode)
            .endCell();
    
    var stateInit: cell = calculateStateInit(jettonWalletCode, data);
    return (calculateAddress(stateInit), stateInit);
}

fun mintInitialLpTokens(queryId: int, initialLpAmount: int, userAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell): void {
    var (jettonWalletAddress, stateInit) = calculateUserJettonWalletAddress(userAddress, jettonMasterAddress, jettonWalletCode);

    var msg: cell = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(jettonWalletAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1)
        .storeUint(1, 1)
        .storeRef(stateInit)
        .storeUint(0, 1)
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(initialLpAmount)
    .endCell();

    sendRawMessage(msg, 64);
}