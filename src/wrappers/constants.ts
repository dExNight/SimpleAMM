export const Exceptions = {
    EXC_NOT_ADMIN: 101,
    EXC_INVALID_SENDER: 102,
    EXC_ALREADY_INITIALIZED: 103,
    EXC_INSUFFICIENT_RESERVE: 104,
    EXC_K_DECREASED: 105,
};

export const Gas = {
    initialize: 50000000n,
};

export const Opcodes = {
    OP_INITIALIZE_LP: 100,
    OP_LIQUDITY_PROVISION: 200,
    OP_LIQUDITY_PROVIDED: 201,
    OP_DEPOSIT: 202,
    OP_SWAP: 203,

    // Jettons
    transfer_jetton: 0xf8a7ea5,
    internal_transfer: 0x178d4519,
    transfer_notification: 0x7362d09c,
    provide_wallet_address: 0x2c76b973,
    take_wallet_address: 0xd1735400,
    burn_jetton: 0x595f07bc,
};

export const DIVIDER: bigint = 100000000000000000000000000000000000000n;
