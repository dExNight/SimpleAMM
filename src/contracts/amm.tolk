import "imports/constants.tolk";
import "imports/utils.tolk";

global init: int;
global adminAddress: slice;
global tokenA: int;
global tokenB: int;
global k: int;
global totalSupply: int;
global tokenAWalletAddress: slice;
global tokenBWalletAddress: slice;
global swapComission: int;
global lpName: cell;
global depositHelperCode: cell;
global jettonWalletCode: cell;
global content: cell;


fun saveData() {
    setContractData(
        beginCell()
            .storeUint(init, 1)
            .storeSlice(adminAddress)
            .storeCoins(tokenA)
            .storeCoins(tokenB)
            .storeUint(k, 256)
            .storeCoins(totalSupply)
            .storeRef(
            beginCell()
                    .storeSlice(tokenAWalletAddress)
                    .storeSlice(tokenBWalletAddress)
                    .storeUint(swapComission, 32)
                    .storeRef(lpName)
                .endCell()
        )
            .storeRef(depositHelperCode)
            .storeRef(jettonWalletCode)
            .storeRef(content)
        .endCell()
    );
}

fun loadData() {
    var ds: slice = getContractData().beginParse();
    init = ds.loadUint(1);
    adminAddress = ds.loadAddress();
    tokenA = ds.loadCoins();
    tokenB = ds.loadCoins();
    k = ds.loadUint(256);
    totalSupply = ds.loadCoins();

    var dv: slice = ds.loadRef().beginParse();
    tokenAWalletAddress = dv.loadAddress();
    tokenBWalletAddress = dv.loadAddress();
    swapComission = dv.loadUint(32); // 30 by default
    lpName = dv.loadRef();
    
    depositHelperCode = ds.loadRef();
    jettonWalletCode = ds.loadRef();
    content = ds.loadRef();
}

fun calculateAmountOut(amountIn: int, reserveIn: int, reserveOut: int): int {
    var netRate: int = SWAP_COMISSION_DENOMINATOR - swapComission;
    return mulDivFloor(
        amountIn,
        reserveOut * netRate,
        reserveIn * SWAP_COMISSION_DENOMINATOR + amountIn * netRate
    );
}

fun handleTransferNotification(queryId: int, senderAddress: slice, msgBody: slice): void {
    var isTokenA: int = isSliceBitsEqual(senderAddress, tokenAWalletAddress);
    var isTokenB: int = isSliceBitsEqual(senderAddress, tokenBWalletAddress);

    var jettonAmount: int = msgBody.loadCoins();
    var fromUser: slice = msgBody.loadAddress();
    msgBody = msgBody.loadUint(1) ? msgBody.loadRef().beginParse() : msgBody;

    if ((!isTokenA & !isTokenB) | (getRemainingBitsCount(msgBody) < 32) | !init) {
        sendJettons(queryId, jettonAmount, fromUser, null, senderAddress, 0, 64, 1, null);
        return;
    };

    var innerOp: int = msgBody.loadUint(32);

    if (innerOp == OP_DEPOSIT) {
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
                        .storeInt(isTokenA, 1)
                    .endCell();

        sendRawMessage(msg, 64);
        return;
    }

    if (innerOp == OP_SWAP) {
        if ((k == 0) | (jettonAmount <= 0) | (tokenA <= 0) | (tokenB <= 0)) {
            sendJettons(queryId, jettonAmount, fromUser, null, senderAddress, 0, 64, 1, null);
            return;
        };

        // Amount out computation
        var amountIn: int = jettonAmount;
        var (reserveIn, reserveOut) = isTokenA ? (tokenA, tokenB) : (tokenB, tokenA);
        var amountOut = calculateAmountOut(amountIn, reserveIn, reserveOut);

        var minAmountOut: int = msgBody.loadCoins();

        if ((amountOut < minAmountOut) | (amountOut >= reserveOut)) {
            sendJettons(queryId, jettonAmount, fromUser, null, senderAddress, 0, 64, 1, null);
            return;
        };

        if (isTokenA) {
            tokenA += amountIn;
            tokenB -= amountOut;
        } else {
            tokenB += amountIn;
            tokenA -= amountOut;
        }

        // process payment
        sendJettons(
            queryId, 
            amountOut,
            fromUser,
            null,
            isTokenA ? tokenBWalletAddress: tokenAWalletAddress,
            0,
            64,
            0,
            null
        );
    
        // Check that k did not decreased (protection from manipulation)
        var new_k: int = tokenA * tokenB;
        assert(new_k >= k, EXC_K_DECREASED);
    
        k = new_k;
        saveData();
        return;
    }

    sendJettons(queryId, jettonAmount, fromUser, null, senderAddress, 0, 64, 1, null);
    return;
}

fun handleLiquidityProvision(queryId: int, senderAddress: slice, msgBody: slice): void {
    var providedTokenA: int = msgBody.loadCoins();
    var providedTokenB: int = msgBody.loadCoins();
    var fromUser: slice = msgBody.loadAddress();

    var (depositHelperAddress, _) = calculateDepositHelperAddress(getMyAddress(), fromUser, depositHelperCode);
    assert(isSliceBitsEqual(depositHelperAddress, senderAddress), EXC_INVALID_SENDER);
        
    if (k == 0) {
        tokenA = providedTokenA;
        tokenB = providedTokenB;
        k = tokenA * tokenB;
    } else {
        var pairFraction: int = mulDivFloor(tokenA, DIVIDER, tokenB);
        var userPairFraction: int = mulDivFloor(providedTokenA, DIVIDER, providedTokenB);

        if (pairFraction == userPairFraction) {
            tokenA += providedTokenA;
            tokenB += providedTokenB;
        } else if (pairFraction > userPairFraction) {
            // User provided too much amount of TokenB
            var correctTokenB: int = mulDivFloor(providedTokenA, tokenB, tokenA);
            var excessTokenB: int = providedTokenB - correctTokenB;
            
            tokenA += providedTokenA;
            tokenB += correctTokenB;
            
            sendJettons(queryId, excessTokenB, fromUser, null, tokenBWalletAddress, 0, 64, 0, null);
        } else {
            // User provided too much amount of TokenA
            var correctTokenA: int = mulDivFloor(providedTokenB, tokenA, tokenB);
            var excessTokenA: int = providedTokenA - correctTokenA;
            
            tokenA += correctTokenA;
            tokenB += providedTokenB;
            
            sendJettons(queryId, excessTokenA, fromUser, null, tokenAWalletAddress, 0, 64, 0, null);
        }

        k = tokenA * tokenB;
        // TODO: mint LP tokens
    }
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
        handleTransferNotification(queryId, senderAddress, msgBody);
        return;
    }

    if (op == OP_LIQUDITY_PROVIDED) {
        if (!init) {
            return;
        }
        handleLiquidityProvision(queryId, senderAddress, msgBody);
        saveData();
        return;
    }

    assert(isSliceBitsEqual(senderAddress, adminAddress), EXC_NOT_ADMIN);

    if (op == OP_INITIALIZE_LP) {
        assert(!init, EXC_ALREADY_INITIALIZED);
        tokenAWalletAddress = msgBody.loadAddress();
        tokenBWalletAddress = msgBody.loadAddress();
        swapComission = msgBody.loadUint(32);
        assert(swapComission < SWAP_COMISSION_DENOMINATOR, EXC_INVALID_COMMISSION);
        init = 1;
        saveData();
        return;
    }

    if (op == OP_UPDATE_COMMISSION) {
        var newCommission: int = msgBody.loadUint(32);
        assert(newCommission < SWAP_COMISSION_DENOMINATOR, EXC_INVALID_COMMISSION);
        swapComission = newCommission;
        saveData();
        return;
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

get expected_amount_out(amountIn: int, isTokenA: int): int {
    loadData();
    var (reserveIn, reserveOut) = isTokenA ? (tokenA, tokenB) : (tokenB, tokenA);
    var netRate: int = SWAP_COMISSION_DENOMINATOR - swapComission;
    return mulDivFloor(
        amountIn,
        reserveOut * netRate,
        reserveIn * SWAP_COMISSION_DENOMINATOR + amountIn * netRate
    );
}

get price_impact(amountIn: int, isTokenA: int): (int, int) {
    loadData();
    // TODO
    return (1, 100);
}

get get_jetton_data(): (int, int, slice, cell, cell) {
    loadData();
    return (totalSupply, -1, adminAddress, content, jettonWalletCode);
}

get get_wallet_address(ownerAddress: slice): slice {
    loadData();
    return calculateUserJettonWalletAddress(ownerAddress, getMyAddress(), jettonWalletCode);
}