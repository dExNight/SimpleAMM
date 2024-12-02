// Lp Wallet Smart Contract
import "imports/jetton_utils.tolk"
import "imports/constants.tolk"
import "imports/utils.tolk"

@pure
fun minTonsForStorage(): int
    asm "10000000 PUSHINT"; // 0.01 TON

@pure
fun gasConsumption(): int
    asm "15000000 PUSHINT"; // 0.015 TON

const NOTIFICATION_AMOUNT = 10000000;

@inline
fun loadData(): (int, slice, slice, cell) {
    var ds: slice = getContractData().beginParse();
    return (ds.loadCoins(),
        ds.loadAddress(),
        ds.loadAddress(),
        ds.loadRef()
    );
}

@inline
fun saveData(balance: int, ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell) {
    setContractData(packJettonWalletData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode));
}

fun sendTokens(inMsgBody: slice, senderAddress: slice, msgValue: int, fwdFee: int) {

    var queryId: int = inMsgBody.loadUint(64);
    var jettonAmount: int = inMsgBody.loadCoins();

    var toOwnerAddress: slice = inMsgBody.loadAddress();

    forceChain(toOwnerAddress);

    var (balance: int, ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell) = loadData();
    
    balance -= jettonAmount;

    assert(isSliceBitsEqual(ownerAddress, senderAddress), 705);
    assert(balance >= 0, 706);
    var (toWalletAddress, stateInit) = calculateUserJettonWalletAddress(toOwnerAddress, jettonMasterAddress, jettonWalletCode);

    var responseAddress: slice = inMsgBody.loadAddress();
    var customPayload: cell = inMsgBody.loadDict();
    var forwardTonAmount: int = inMsgBody.loadCoins();

    assert(getRemainingBitsCount(inMsgBody) >= 1, 708);
    var eitherForwardPayload: slice = inMsgBody;

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(toWalletAddress)
        .storeCoins(0)
        .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
        .storeRef(stateInit);

    var msgBody = beginCell()
        .storeUint(OP_INTERNAL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(jettonAmount)
        .storeSlice(ownerAddress)
        .storeSlice(responseAddress)
        .storeCoins(forwardTonAmount)
        .storeSlice(eitherForwardPayload)
        .endCell();
    msg = msg.storeRef(msgBody);
    
    var fwdCount: int = forwardTonAmount ? 2 : 1;

    assert(msgValue > forwardTonAmount + fwdCount * fwdFee + (2 * gasConsumption() + minTonsForStorage()), 709);

    sendRawMessage(msg.endCell(), 64); // revert on errors and Carry all the remaining value of the inbound message in addition to the value initially indicated in the new message
    saveData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode);
}

fun receiveTokens(inMsgBody: slice, senderAddress: slice, myTonBalance: int, fwdFee: int, msgValue: int) {
    var (balance: int, ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell) = loadData();

    var queryId: int = inMsgBody.loadUint(64);
    var jettonAmount: int = inMsgBody.loadCoins();

    balance += jettonAmount;

    var tonBalanceBeforeMsg: int = myTonBalance - msgValue;

    if (isSliceBitsEqual(jettonMasterAddress, senderAddress)){

        var storageFee: int = minTonsForStorage() - min(tonBalanceBeforeMsg, minTonsForStorage());

        msgValue -= (storageFee + gasConsumption());

        msgValue -= (NOTIFICATION_AMOUNT + fwdFee);

        var eitherForwardPayload: slice = inMsgBody;
        var msgBody = beginCell()
            .storeUint(OP_TRANSFER_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeSlice(jettonMasterAddress)
            .storeSlice(eitherForwardPayload)
            .endCell();

        var msg = beginCell()
            .storeUint(0x10, 6)
            .storeSlice(ownerAddress)
            .storeCoins(NOTIFICATION_AMOUNT)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(msgBody);

        sendRawMessage(msg.endCell(), 1);

        msg = beginCell()
            .storeUint(0x10, 6)
            .storeSlice(ownerAddress)
            .storeCoins(msgValue)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeUint(OP_EXCESSES, 32)
            .storeUint(queryId, 64);
        sendRawMessage(msg.endCell(), 2);

        saveData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode);
        return;
    }


    var fromAddress: slice = inMsgBody.loadAddress();
    var responseAddress: slice = inMsgBody.loadAddress();

    var (toWalletAddress, _) = calculateUserJettonWalletAddress(fromAddress, jettonMasterAddress, jettonWalletCode);
    assert(isSliceBitsEqual(toWalletAddress, senderAddress), 707);

    var forwardTonAmount: int = inMsgBody.loadCoins();

    var storageFee: int = minTonsForStorage() - min(tonBalanceBeforeMsg, minTonsForStorage());
    msgValue -= (storageFee + gasConsumption());

    if(forwardTonAmount) {
        msgValue -= (forwardTonAmount + fwdFee);
        var eitherForwardPayload: slice = inMsgBody;

        var msgBody = beginCell()
            .storeUint(OP_TRANSFER_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeSlice(fromAddress)
            .storeSlice(eitherForwardPayload)
            .endCell();

        var msg = beginCell()
            .storeUint(0x10, 6)
            .storeSlice(ownerAddress)
            .storeCoins(forwardTonAmount)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(msgBody);

        sendRawMessage(msg.endCell(), 1);
    }

    if ((responseAddress.preloadUint(2) != 0) & (msgValue > 0)) {
        var msg = beginCell()
            .storeUint(0x10, 6)
            .storeSlice(responseAddress)
            .storeCoins(msgValue)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeUint(OP_EXCESSES, 32)
            .storeUint(queryId, 64);
        sendRawMessage(msg.endCell(), 2);
    }

    saveData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode);
}

fun burnTokens(inMsgBody: slice, senderAddress: slice, msgValue: int, fwdFee: int) {
    var (balance: int, ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell) = loadData();
    
    var queryId: int = inMsgBody.loadUint(64);
    var jettonAmount: int = inMsgBody.loadCoins();
    var responseAddress: slice = inMsgBody.loadAddress();

    balance -= jettonAmount;

    assert(isSliceBitsEqual(ownerAddress, senderAddress), 705);
    assert(balance >= 0, 706);
    assert(msgValue > minJettonBurnAmount(), 707);

    var msgBody = beginCell()
      .storeUint(OP_BURN_NOTIFICATION, 32)
      .storeUint(queryId, 64)
      .storeCoins(jettonAmount)
      .storeSlice(ownerAddress)
      .storeSlice(responseAddress)
      .endCell();

    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeSlice(jettonMasterAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(msgBody);

    sendRawMessage(msg.endCell(), 64);

    saveData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode);
}

fun onBounce(inMsgBody: slice) {
    inMsgBody.skipBits(32);
    var (balance: int, ownerAddress: slice, jettonMasterAddress: slice, jettonWalletCode: cell) = loadData();

    var op: int = inMsgBody.loadUint(32);
    assert((op == OP_INTERNAL_TRANSFER) | (op == OP_BURN_NOTIFICATION), 709);

    var queryId: int = inMsgBody.loadUint(64);
    var jettonAmount: int = inMsgBody.loadCoins();

    balance += jettonAmount;
    saveData(balance, ownerAddress, jettonMasterAddress, jettonWalletCode);
}

fun onInternalMessage(myBalance: int, msgValue: int, inMsgFull: cell, inMsgBody: slice) {
    if (inMsgBody.isEndOfSlice()) { // ignore empty messages
        return;
    }

    var cs: slice = inMsgFull.beginParse();
    var flags: int = cs.loadUint(4);

    if (flags & 1) {
        onBounce(inMsgBody);
        return;
    }

    var senderAddress: slice = cs.loadAddress();
    cs.loadAddress(); // skip dst
    cs.loadCoins(); // skip value
    cs.skipBits(1); // skip extracurrency collection
    cs.loadCoins(); // skip ihr_fee
    var fwdFee: int = mulDivFloor(cs.loadCoins(), 3, 2);

    var op: int = inMsgBody.loadUint(32);

    if (op == OP_TRANSFER_JETTON) {
        sendTokens(inMsgBody, senderAddress, msgValue, fwdFee);
        return;
    }

    if (op == OP_INTERNAL_TRANSFER) {
        receiveTokens(inMsgBody, senderAddress, myBalance, fwdFee, msgValue);
        return;
    }

    if (op == OP_BURN_JETTON) {
        burnTokens(inMsgBody, senderAddress, msgValue, fwdFee);
        return;
    }

    throw 0xffff;
}

get get_wallet_data(): (int, slice, slice, cell) {
    return loadData();
}
