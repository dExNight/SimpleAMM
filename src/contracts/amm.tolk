import "constants.tolk";

global init: int;
global lpName: cell;
global adminAddress: slice;
global tokenA: int;
global tokenB: int;
global k: int;
global tokenAWalletAddress: slice;
global tokenBWalletAddress: slice;


fun saveData() {
    setContractData(beginCell().storeUint(init, 1).storeSlice(adminAddress).storeCoins(tokenA).storeCoins(tokenB).storeUint(k, 32).storeSlice(tokenAWalletAddress).storeSlice(tokenBWalletAddress).storeRef(lpName).endCell());
}

fun loadData() {
    var ds = getContractData().beginParse();
    init = ds.loadUint(1);
    adminAddress = ds.loadAddress();
    tokenA = ds.loadCoins();
    tokenB = ds.loadCoins();
    k = ds.loadUint(32);
    tokenAWalletAddress = ds.loadAddress();
    tokenBWalletAddress = ds.loadAddress();
    lpName = ds.loadRef(); // about 125 bits at max
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
    var query_id: int = msgBody.loadUint(64);

    loadData();

    if (op == OP_INITIALIZE_LP) {
        assert(!init, EXC_ALREADY_INITIALIZED);
        assert(isSliceBitsEqual(senderAddress, adminAddress), EXC_NOT_ADMIN);

        tokenAWalletAddress = msgBody.loadAddress();
        tokenBWalletAddress = msgBody.loadAddress();
        init = 1;
        saveData();
        return;
    }
}


get lp_storage(): (int, slice, int, int, int, slice, slice, cell) {
    loadData();
    return (init, adminAddress, tokenA, tokenB, k, tokenAWalletAddress, tokenBWalletAddress, lpName);
}
