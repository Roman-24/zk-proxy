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


export class TransactionProof extends Struct({
  sender: PublicKey,
  recipient: PublicKey,
  amount: UInt64,
  nonce: Field,
}) {
  toFields(): Field[] {
    return [
      ...this.sender.toFields(),
      ...this.recipient.toFields(),
      ...this.amount.toFields(),
      this.nonce,
    ];
  }
}

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
        signature.verify(transaction.sender, transaction.toFields());
        const computedHash = Poseidon.hash(transaction.toFields());
        computedHash.assertEquals(hash);
        return transaction;
      },
    },
  }
});

export class ZkProxy extends SmartContract {
  @state(Field) nextNonce = State<Field>();
  @state(UInt64) poolBalance = State<UInt64>();

  init() {
    super.init();
    this.nextNonce.set(Field(1));
    this.poolBalance.set(UInt64.from(0));
  }

  @method async deposit(
    senderAddress: PublicKey,
    proofHash: Field,
    amount: UInt64,
    signature: Signature
  ) {
    // Verify current state
    const currentBalance = this.poolBalance.get();
    this.poolBalance.requireEquals(currentBalance);

    // Verify signature
    signature.verify(senderAddress, [proofHash, ...amount.toFields()]);

    // Update pool balance
    const newBalance = currentBalance.add(amount);
    newBalance.assertLessThanOrEqual(UInt64.MAXINT());
    this.poolBalance.set(newBalance);
  }

  @method async withdraw(
    proof: SelfProof<Field, TransactionProof>,
    recipientAddress: PublicKey,
    amount: UInt64
  ) {
    // Verify current state
    const currentBalance = this.poolBalance.get();
    this.poolBalance.requireEquals(currentBalance);

    // Verify proof
    proof.verify();

    // Update nonce
    const currentNonce = this.nextNonce.get();
    this.nextNonce.requireEquals(currentNonce);
    this.nextNonce.set(currentNonce.add(1));

    // Update balance and send
    const newBalance = currentBalance.sub(amount);
    newBalance.assertGreaterThanOrEqual(UInt64.from(0));
    this.poolBalance.set(newBalance);
    this.send({ to: recipientAddress, amount });
  }
}