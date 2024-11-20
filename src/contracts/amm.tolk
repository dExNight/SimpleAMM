import "imports/constants.tolk";
import "imports/utils.tolk";

global init: int;
global lpName: cell;
global adminAddress: slice;
global tokenA: int;
global tokenB: int;
global k: int;
global tokenAWalletAddress: slice;
global tokenBWalletAddress: slice;
global depositHelperCode: cell;


fun saveData() {
    setContractData(beginCell().storeUint(init, 1).storeSlice(adminAddress).storeCoins(tokenA).storeCoins(tokenB).storeUint(k, 256).storeRef(beginCell().storeSlice(tokenAWalletAddress).storeSlice(tokenBWalletAddress).endCell()).storeRef(lpName).storeRef(depositHelperCode).endCell());
}

fun loadData() {
    var ds: slice = getContractData().beginParse();
    init = ds.loadUint(1);
    adminAddress = ds.loadAddress();
    tokenA = ds.loadCoins();
    tokenB = ds.loadCoins();
    k = ds.loadUint(256);
    var dv: slice = ds.loadRef().beginParse();
    tokenAWalletAddress = dv.loadAddress();
    tokenBWalletAddress = dv.loadAddress();
    lpName = ds.loadRef(); // about 125 bits at max
    depositHelperCode = ds.loadRef();
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

    if (op == OP_TRANSFER_NOTIFICATION) {
        assert((isSliceBitsEqual(senderAddress, tokenAWalletAddress) | isSliceBitsEqual(senderAddress, tokenBWalletAddress)), EXC_INVALID_SENDER);
        var jettonAmount: int = msgBody.loadCoins();
        var fromUser: slice = msgBody.loadAddress();
        
        msgBody = msgBody.loadUint(1) ? msgBody.loadRef().beginParse() : msgBody;

        if (getRemainingBitsCount(msgBody) < 32) {
            sendJettons(queryId, jettonAmount, fromUser, null, isSliceBitsEqual(senderAddress, tokenAWalletAddress) ? tokenAWalletAddress: tokenBWalletAddress, 0, 64, 1, null);
            return;
        }

        var innerOp: int = msgBody.loadUint(32);

        if (innerOp != OP_DEPOSIT) {
            sendJettons(queryId, jettonAmount, fromUser, null, isSliceBitsEqual(senderAddress, tokenAWalletAddress) ? tokenAWalletAddress: tokenBWalletAddress, 0, 64, 1, null);
            return;
        }

        var isTokenA: int = isSliceBitsEqual(senderAddress, tokenAWalletAddress) ? 1 : 0; 

        var (depositHelperAddress, stateInit) = calculateDepositHelperAddress(getMyAddress(), fromUser, depositHelperCode);
        var msg: cell = beginCell()
                        .storeUint(0x18, 6)
                        .storeSlice(depositHelperAddress)  
                        .storeCoins(0)
                        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1)
                        .storeUint(1, 1)
                        .storeRef(stateInit)
                        .storeUint(0, 1)
                        .storeUint(OP_LIQUDITY_PROVISION, 32)
                        .storeUint(queryId, 64)
                        .storeCoins(jettonAmount)
                        .storeSlice(fromUser)
                        .storeUint(isTokenA, 1)
                    .endCell();

        sendRawMessage(msg, 64);
        return;
    }

    if (op == OP_INITIALIZE_LP) {
        assert(!init, EXC_ALREADY_INITIALIZED);
        assert(isSliceBitsEqual(senderAddress, adminAddress), EXC_NOT_ADMIN);

        tokenAWalletAddress = msgBody.loadAddress();
        tokenBWalletAddress = msgBody.loadAddress();
        init = 1;
        saveData();
        return;
    }

    if (op == OP_LIQUDITY_PROVIDED) {
        if (!init) {
            return;
        }
        var providedTokenA: int = msgBody.loadCoins();
        var providedTokenB: int = msgBody.loadCoins();
        var fromUser: slice = msgBody.loadAddress();

        var (depositHelperAddress, _) = calculateDepositHelperAddress(getMyAddress(), fromUser, depositHelperCode);
        assert(isSliceBitsEqual(depositHelperAddress, senderAddress), EXC_INVALID_SENDER);
        
        if (k == 0) {
            tokenA = providedTokenA;
            tokenB = providedTokenB;
            k = tokenA * tokenB;
            saveData();
            return;
        } else {
            var pairFraction: int = mulDivFloor(tokenA, DIVIDER, tokenB);
            var userPairFraction: int = mulDivFloor(providedTokenA, DIVIDER, providedTokenB);

            if (pairFraction == userPairFraction) {
                tokenA += providedTokenA;
                tokenB += providedTokenB;
            } else if (pairFraction > userPairFraction) {
                // User provided too much amount of TokenB
                var correctTokenB: int = mulDivFloor(providedTokenA * tokenB, DIVIDER, tokenA);
                var excessTokenB: int = providedTokenB * DIVIDER - correctTokenB;
            
                tokenA += providedTokenA;
                tokenB += correctTokenB;
            
                sendJettons(queryId, excessTokenB / DIVIDER, fromUser, null, tokenBWalletAddress, 0, 64, 0, null);
            } else {
                // User provided too much amount of TokenA
                var correctTokenA: int = mulDivFloor(providedTokenB * tokenA, DIVIDER, tokenB);
                var excessTokenA: int = providedTokenA - correctTokenA;
            
                tokenA += correctTokenA;
                tokenB += providedTokenB;
            
                sendJettons(queryId, excessTokenA / DIVIDER, fromUser, null, tokenAWalletAddress, 0, 64, 0, null);
            }

            k = tokenA * tokenB;
            // TODO: mint LP tokens
            saveData();
            return;
        }

    }
}


get lp_storage(): (int, slice, int, int, int, slice, slice, cell) {
    loadData();
    return (init, adminAddress, tokenA, tokenB, k, tokenAWalletAddress, tokenBWalletAddress, lpName);
}

get get_helper_address(user_address: slice): slice {
    loadData();
    var (depositHelperAddress, _) = calculateDepositHelperAddress(getMyAddress(), user_address, depositHelperCode);
    return depositHelperAddress;
}
