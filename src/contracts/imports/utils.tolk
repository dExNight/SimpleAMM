import "constants.tolk"

fun sqrt(x: int): int {
    if (x == 0) { return x; }

    var r: int = 181;
    var xx: int = x;
    if (xx >= 0x100000000000000000000000000000000) {
        xx >>= 128;
        r <<= 64;
    }
    if (xx >= 0x10000000000000000) {
        xx >>= 64;
        r <<= 32;
    }
    if (xx >= 0x100000000) {
        xx >>= 32;
        r <<= 16;
    }
    if (xx >= 0x10000) {
        xx >>= 16;
        r <<= 8;
    }

    r = (r * (xx + 65536)) >> 18;

    repeat(7) {
        r = (r + x / r) >> 1;
    }

    var r1: int = x / r;

    return (r < r1 ? r : r1);
}

fun calculateStateInit(code: cell, data: cell): cell {
    return beginCell()
            .storeUint(0, 2)
            .storeDict(code)
            .storeDict(data)
            .storeUint(0, 1)
        .endCell();
}

fun calculateAddress(stateInit: cell): slice {
    return beginCell()
            .storeUint(4, 3)
            .storeInt(0, 8)
            .storeUint(cellHash(stateInit), 256)
        .endCell()
        .beginParse();
}

fun calculateDepositHelperAddress(lpAddress: slice, ownerAddress: slice, depositHelperCode: cell): (slice, cell) {
    var data: cell = beginCell().storeSlice(lpAddress).storeSlice(ownerAddress).storeCoins(0).storeCoins(0).endCell();
    var stateInit: cell = calculateStateInit(depositHelperCode, data);
    return (calculateAddress(stateInit), stateInit);
}

fun sendJettons(queryId: int, jettonAmount: int, toAddress: slice, responseAddress: slice, jettonWalletAddress: slice, 
    msgValue: int, sendingMode: int, forwardTonAmount: int, forwardPayload: cell) {

    var msgBody: builder = beginCell()
                        .storeUint(OP_TRANSFER_JETTON, 32)
                        .storeUint(queryId, 64)
                        .storeCoins(jettonAmount)
                        .storeSlice(toAddress);
    if (responseAddress != null) {
        msgBody.storeSlice(responseAddress);
    }
    else {
        msgBody.storeUint(0, 2);
    }
    msgBody.storeUint(0, 1)
                        .storeCoins(forwardTonAmount)
                        .storeUint(1, 1);

    if (forwardPayload != null) {
        msgBody.storeDict(forwardPayload);
    }
    else {
        msgBody.storeUint(0, 1);
    }

    var msg: cell = beginCell()
                .storeUint(0x10, 6) 
                .storeSlice(jettonWalletAddress)
                .storeCoins(msgValue)
                .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1)
                .storeUint(1, 1)
                .storeRef(msgBody.endCell())
            .endCell();
            
    sendRawMessage(msg, sendingMode);  
}