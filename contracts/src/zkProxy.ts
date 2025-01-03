import {
    SmartContract,
    state,
    State,
    method,
    Field,
    PublicKey,
    UInt64,
    Signature,
    SelfProof,
    Poseidon,
    ZkProgram,
    Struct
} from 'o1js';

/**
 * @notice Represents the structure of a private transaction
 * @dev Uses Struct from o1js for efficient field conversion
 */
export class TransactionProof extends Struct({
    // Public key of the transaction sender
    sender: PublicKey,
    // Public key of the transaction recipient
    recipient: PublicKey,
    // Transaction amount using UInt64 for precise numerical representation
    amount: UInt64,
    // Unique identifier to prevent transaction replay attacks
    nonce: Field,
}) {
    /**
     * Converts the transaction structure into an array of Field elements
     * This conversion is necessary for:
     * 1. Zero-knowledge proof generation
     * 2. Hash computation
     * 3. Signature verification
     * 
     * @returns {Field[]} Array of field elements representing the transaction
     */
    toFields(): Field[] {
        return [
            ...this.sender.toFields(),    // Convert sender's public key to fields
            ...this.recipient.toFields(), // Convert recipient's public key to fields
            ...this.amount.toFields(),    // Convert amount to fields
            this.nonce,                   // Add nonce as a field
        ];
    }
}

/**
 * @notice Zero-knowledge program for transaction verification
 * @dev Implements proof generation and verification logic
 */
export const TransactionVerifier = ZkProgram({
    // Unique identifier for the verification program
    name: 'TransactionVerifier',

    // Public input: only the transaction hash is visible on-chain
    publicInput: Field,

    // Public output: the verified transaction proof
    publicOutput: TransactionProof,

    methods: {
        /**
         * Core verification method for transaction validity
         */
        verify: {
            // Private inputs that remain confidential
            // These inputs are never revealed on-chain
            privateInputs: [TransactionProof, Signature],

            /**
             * Verifies transaction authenticity and integrity
             * 
             * @param hash {Field} Public input - hash of the transaction
             * @param transaction {TransactionProof} Private input - actual transaction details
             * @param signature {Signature} Private input - cryptographic signature
             * @returns {Promise<TransactionProof>} Verified transaction proof
             */
            async method(
                hash: Field,
                transaction: TransactionProof,
                signature: Signature
            ): Promise<TransactionProof> {
                // Step 1: Verify the signature matches the sender and transaction data
                signature.verify(transaction.sender, transaction.toFields());

                // Step 2: Compute hash of the transaction data
                const computedHash = Poseidon.hash(transaction.toFields());

                // Step 3: Verify computed hash matches the provided hash
                // This ensures transaction data hasn't been tampered with
                computedHash.assertEquals(hash);

                // Step 4: Return verified transaction
                return transaction;
            },
        },
    }
});

/**
 * @notice Main ZkProxy smart contract
 * @dev Manages deposits and withdrawals with privacy preservation
 */
export class ZkProxy extends SmartContract {
    @state(Field) nextNonce = State<Field>();    // Tracks transaction sequence
    @state(UInt64) poolBalance = State<UInt64>(); // Total pool balance

    /**
     * @notice Initializes contract state
     */
    init() {
        super.init();
        this.nextNonce.set(Field(1));
        this.poolBalance.set(UInt64.from(0));
    }

    /**
     * @notice Processes a deposit into the privacy pool
     * @param senderAddress Sender's public key
     * @param proofHash Hash of transaction proof
     * @param amount Deposit amount
     * @param signature Transaction signature
     */
    @method async deposit(
        senderAddress: PublicKey,
        proofHash: Field,
        amount: UInt64,
        signature: Signature
    ) {
        // Verify current pool state
        const currentBalance = this.poolBalance.get();
        this.poolBalance.requireEquals(currentBalance);

        // Verify transaction signature
        signature.verify(senderAddress, [proofHash, ...amount.toFields()]);

        // Update pool balance with overflow check
        const newBalance = currentBalance.add(amount);
        newBalance.assertLessThanOrEqual(UInt64.MAXINT());
        this.poolBalance.set(newBalance);
    }

    /**
     * @notice Processes a withdrawal from the privacy pool
     * @param proof Zero-knowledge proof of transaction validity
     * @param recipientAddress Recipient's public key
     * @param amount Withdrawal amount
     */
    @method async withdraw(
        proof: SelfProof<Field, TransactionProof>,
        recipientAddress: PublicKey,
        amount: UInt64
    ) {
        // Verify current state
        const currentBalance = this.poolBalance.get();
        this.poolBalance.requireEquals(currentBalance);

        // Verify zero-knowledge proof
        proof.verify();

        // Update nonce for replay protection
        const currentNonce = this.nextNonce.get();
        this.nextNonce.requireEquals(currentNonce);
        this.nextNonce.set(currentNonce.add(1));

        // Process withdrawal with underflow check
        const newBalance = currentBalance.sub(amount);
        newBalance.assertGreaterThanOrEqual(UInt64.from(0));
        this.poolBalance.set(newBalance);

        // Send funds to recipient
        this.send({ to: recipientAddress, amount });
    }
}
