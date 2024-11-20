import "constants.tolk"

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