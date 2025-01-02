import {
  SmartContract,
  state,
  State,
  method,
  Field,
  PublicKey,
  Signature,
  Circuit,
  Struct,
  ZkProgram,
  SelfProof,
  Permissions,
  DeployArgs,
  Poseidon,
  UInt64,
} from 'o1js';

// Structure to store transaction details
export class TransactionProof extends Struct({
  sender: PublicKey,
  recipient: PublicKey,
  amount: UInt64, // Changed to UInt64 for compatibility with send method
  nonce: Field,
}) {
  toFields(): Field[] {
    return [
      ...this.sender.toFields(),
      ...this.recipient.toFields(),
      ...this.amount.toFields(), // Changed to handle UInt64
      this.nonce,
    ];
  }
}

// ZkProgram for generating transaction proofs
export const TransactionVerifier = ZkProgram({
  name: 'TransactionVerifier',
  publicInput: Field,
  publicOutput: TransactionProof,

  methods: {
    verify: {
      privateInputs: [TransactionProof, Signature],

      async method(
        hash: Field,
        transaction: TransactionProof,
        signature: Signature
      ): Promise<TransactionProof> {
        // Verify the signature
        signature.verify(transaction.sender, transaction.toFields());
        // Verify transaction hash using Poseidon (kept your change)
        const computedHash = Poseidon.hash(transaction.toFields());
        computedHash.assertEquals(hash);

        return transaction;
      },
    },
  }
});

export class PrivacyTxProxy extends SmartContract {
  @state(Field) nextNonce = State<Field>();
  @state(UInt64) poolBalance = State<UInt64>(); // Changed to UInt64

  // Initialize the contract
  init() {
    super.init();
    this.nextNonce.set(Field(1));
    this.poolBalance.set(UInt64.from(0));
  }

  // Deploy with custom permissions
  /*
  async deploy(args: DeployArgs) {
    await super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
    });
  }
  */

  @method async secretToPublic(
    proof: SelfProof<Field, TransactionProof>,
    recipientAddress: PublicKey,
    amount: UInt64 // Changed to UInt64
  ) {
    // Verify the proof
    proof.verify();

    // Get current state
    const currentNonce = this.nextNonce.get();
    this.nextNonce.get().assertEquals(currentNonce);

    // Update nonce
    this.nextNonce.set(currentNonce.add(1));

    // Verify pool has sufficient balance
    const currentBalance = this.poolBalance.get();
    this.poolBalance.get().assertEquals(currentBalance);
    
    // Check if balance is sufficient
    const newBalance = currentBalance.sub(amount);
    newBalance.assertGreaterThanOrEqual(UInt64.from(0));

    // Update pool balance
    this.poolBalance.set(newBalance);
    
    // Transfer to recipient
    this.send({ to: recipientAddress, amount });
  }

  @method async publicToSecret(
    senderAddress: PublicKey,
    proofHash: Field,
    amount: UInt64, // Changed to UInt64
    signature: Signature
  ) {
    // Verify sender's signature
    signature.verify(senderAddress, [proofHash, ...amount.toFields()]);

    // Get and update pool balance
    const currentBalance = this.poolBalance.get();
    const newBalance = currentBalance.add(amount);
    
    // Verify no overflow occurs
    newBalance.assertLessThanOrEqual(UInt64.MAXINT());
    
    this.poolBalance.set(newBalance);
  }

  @method async claimSecretTransfer(
    proof: SelfProof<Field, TransactionProof>
  ) {
    // Verify the proof
    proof.verify();

    // Get transaction details from proof
    const transaction = proof.publicOutput;

    // Verify pool has sufficient balance
    const currentBalance = this.poolBalance.get();
    this.poolBalance.get().assertEquals(currentBalance);
    
    // Check if balance is sufficient
    const newBalance = currentBalance.sub(transaction.amount);
    newBalance.assertGreaterThanOrEqual(UInt64.from(0));

    // Update pool balance
    this.poolBalance.set(newBalance);

    // Transfer to recipient
    this.send({ to: transaction.recipient, amount: transaction.amount });
  }

  // Helper method to check pool balance
  getPoolBalance(): UInt64 {
    return this.poolBalance.get();
  }
}