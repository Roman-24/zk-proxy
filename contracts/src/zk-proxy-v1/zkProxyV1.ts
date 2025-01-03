// zkProxyV1.ts

import {
  SmartContract,
  state,
  State,
  method,
  Field,
  PublicKey,
  Signature,
  Struct,
  ZkProgram,
  SelfProof,
  Permissions,
  DeployArgs,
  Poseidon,
  UInt64,
} from 'o1js';

export class TransactionProof extends Struct({
  sender: PublicKey, // The address sending the funds
  recipient: PublicKey, // The address receiving the funds
  amount: UInt64, // The amount being transferred
  nonce: Field, // A unique number to prevent replay attacks
}) {
  // Method to convert the struct into an array of Field elements
  toFields(): Field[] {
    return [
      ...this.sender.toFields(), // Convert sender PublicKey to Fields
      ...this.recipient.toFields(), // Convert recipient PublicKey to Fields
      ...this.amount.toFields(), // Convert UInt64 amount to Fields
      this.nonce, // Add the nonce Field
    ];
  }
}

export const TransactionVerifier = ZkProgram({
  // Program identifier
  name: 'TransactionVerifier',
  
  // What's publicly visible as input (in this case, a hash)
  publicInput: Field,
  
  // What's publicly visible as output (the transaction details)
  publicOutput: TransactionProof,

  methods: {
    verify: {
      // What remains private during verification
      privateInputs: [TransactionProof, Signature],

      async method(
        hash: Field, // Public input: hash of the transaction
        transaction: TransactionProof, // Private: actual transaction details
        signature: Signature // Private: signature proving ownership
      ): Promise<TransactionProof> {
        // Verify the signature is valid for this transaction
        signature.verify(transaction.sender, transaction.toFields());

        // Hash the transaction and verify it matches the provided hash
        const computedHash = Poseidon.hash(transaction.toFields());
        computedHash.assertEquals(hash);

        // Return the verified transaction
        return transaction;
      },
    },
  }
});

export class ZkProxyV1 extends SmartContract {
  @state(Field) nextNonce = State<Field>();
  @state(UInt64) poolBalance = State<UInt64>();

  init() {
    super.init();
    this.nextNonce.set(Field(1));
    this.poolBalance.set(UInt64.from(0));
  }

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
      receive: Permissions.proofOrSignature(),
    });
  }

  @method async publicToSecret(
    senderAddress: PublicKey,
    proofHash: Field,
    amount: UInt64,
    signature: Signature
  ) {
    const currentBalance = this.poolBalance.get();
    this.poolBalance.requireEquals(currentBalance);

    signature.verify(senderAddress, [proofHash, ...amount.toFields()]);

    const newBalance = currentBalance.add(amount);
    newBalance.assertLessThanOrEqual(UInt64.MAXINT());

    this.poolBalance.set(newBalance);
  }

  @method async secretToPublic(
    proof: SelfProof<Field, TransactionProof>,
    recipientAddress: PublicKey,
    amount: UInt64
  ) {
    const currentBalance = this.poolBalance.get();
    this.poolBalance.requireEquals(currentBalance);

    proof.verify();

    const currentNonce = this.nextNonce.get();
    this.nextNonce.requireEquals(currentNonce);
    this.nextNonce.set(currentNonce.add(1));

    const newBalance = currentBalance.sub(amount);
    newBalance.assertGreaterThanOrEqual(UInt64.from(0));

    this.poolBalance.set(newBalance);
    this.send({ to: recipientAddress, amount });
  }

  @method async claimSecretTransfer(
    proof: SelfProof<Field, TransactionProof>
  ) {
    const currentBalance = this.poolBalance.get();
    this.poolBalance.requireEquals(currentBalance);

    proof.verify();
    const transaction = proof.publicOutput;

    const newBalance = currentBalance.sub(transaction.amount);
    newBalance.assertGreaterThanOrEqual(UInt64.from(0));

    this.poolBalance.set(newBalance);
    this.send({ to: transaction.recipient, amount: transaction.amount });
  }
}