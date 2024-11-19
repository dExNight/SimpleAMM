export const Exceptions = {
    EXC_NOT_ADMIN: 101,
    EXC_INVALID_SENDER: 102,
    EXC_ALREADY_INITIALIZED: 103,
};

export const Gas = {
    initialize: 50000000n,
};

export const Opcodes = {
    OP_INITIALIZE_LP: 100,

    // Jettons
    transfer_jetton: 0xf8a7ea5,
    internal_transfer: 0x178d4519,
    transfer_notification: 0x7362d09c,
    provide_wallet_address: 0x2c76b973,
    take_wallet_address: 0xd1735400,
    burn_jetton: 0x595f07bc,
};
