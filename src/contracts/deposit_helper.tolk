import "imports/constants.tolk";

global lpAddress: slice;
global ownerAddress: slice;
global tokenA: int;
global tokenB: int;

fun saveData() {
    setContractData(beginCell().storeSlice(lpAddress).storeSlice(ownerAddress).storeCoins(tokenA).storeCoins(tokenB).endCell());
}

fun loadData() {
    var ds = getContractData().beginParse();
    lpAddress = ds.loadAddress();
    ownerAddress = ds.loadAddress();
    tokenA = ds.loadCoins();
    tokenB = ds.loadCoins();
}


fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    var cs = msgFull.beginParse();
    var flags = cs.loadMessageFlags();
    if (isMessageBounced(flags)) { // TODO: handle bounced messages
        return;
    }

    if (msgBody.isEndOfSliceBits()) {
        loadData();
        return;
    }

    var senderAddress: slice = cs.loadAddress();
    
    var op: int = msgBody.loadUint(32);
    var queryId: int = msgBody.loadUint(64);

    loadData();

    if (op == OP_LIQUDITY_PROVISION) {
        assert(isSliceBitsEqual(senderAddress, lpAddress), EXC_INVALID_SENDER);
        var jettonAmount: int = msgBody.loadCoins();
        var fromUser: slice = msgBody.loadAddress();
        var isTokenA: int = msgBody.loadUint(1);
        // TODO: process topup
        var processLpDeposit: int = 0;
        if (isTokenA == 1) {
            tokenA += jettonAmount;
            processLpDeposit = tokenB > 0 ? 1 : 0;
        } else {
            tokenB += jettonAmount;
            processLpDeposit = tokenA > 0 ? 1 : 0;
        }

        if (processLpDeposit) {
            var msg: cell = beginCell().storeUint(0x18, 6).storeSlice(lpAddress).storeCoins(0).storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1).storeUint(OP_LIQUDITY_PROVIDED, 32).storeUint(queryId, 64).storeCoins(tokenA).storeCoins(tokenB).storeSlice(ownerAddress).endCell();
            sendRawMessage(msg, 64);
            tokenA -= tokenA;
            tokenB -= tokenB;
        }
        saveData();
        return;
    }
}


get deposit_helper_storage(): (slice, slice, int, int) {
    loadData();
    return (lpAddress, ownerAddress, tokenA, tokenB);
}
