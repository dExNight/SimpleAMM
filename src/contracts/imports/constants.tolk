const OP_INITIALIZE_LP: int = 100;
const OP_LIQUDITY_PROVISION: int = 200;
const OP_LIQUDITY_PROVIDED: int = 201;
const OP_DEPOSIT: int = 202;
const OP_SWAP: int = 203;
const OP_UPDATE_COMMISSION: int = 204;

const OP_TRANSFER_JETTON: int = 0xf8a7ea5;
const OP_INTERNAL_TRANSFER: int = 0x178d4519;
const OP_TRANSFER_NOTIFICATION: int = 0x7362d09c;
const OP_BURN_JETTON: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;
const OP_EXCESSES: int = 0xd53276db;

const EXC_NOT_ADMIN: int = 101;
const EXC_INVALID_SENDER: int = 102;
const EXC_ALREADY_INITIALIZED: int = 103;
const EXC_INSUFFICIENT_RESERVE: int = 104;
const EXC_K_DECREASED: int = 105;
const EXC_INVALID_COMMISSION: int = 106;
const EXC_ZERO_LP_AMOUNT: int = 107;
const EXC_LP_EXCEEDS_SUPPLY: int = 108;

const SWAP_COMISSION_DENOMINATOR: int = 1000;
const DIVIDER: int = 100000000000000000000000000000000000000;

@pure
fun workchain(): int
    asm "0 PUSHINT";

@pure
fun minJettonBurnAmount(): int
    asm "500000000 PUSHINT";

@pure
fun minLiqudityProvisionAmount(): int
    asm "250000000 PUSHINT";

@pure
fun jettonTransferAmount(): int
    asm "100000000 PUSHINT";