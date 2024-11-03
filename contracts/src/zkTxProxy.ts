import { Field, SmartContract, state, State, method, PublicKey, Signature } from 'o1js';

export class ZkTxProxy extends SmartContract {
  // State to store the public key of the sender (optional)
  // this can work as white list
  @state(PublicKey) senderPublicKey = State<PublicKey>();

  // Initialize the zkApp with the sender's public key
  init() {
    super.init();
    // Set permissions if needed
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
      send: Permissions.proof(),
    });
  }

  // Method to proxy the transaction
  @method
  proxyTransaction(
    transactionData: Field,
    signature: Signature,
    senderPublicKey: PublicKey,
    receiverPublicKey: PublicKey,
    amount: Field
  ) {
    // Verify the signature to ensure the sender authorized the transaction
    const isValidSignature = signature.verify(senderPublicKey, [
      transactionData,
    ]);
    isValidSignature.assertTrue('Invalid signature');

    // Process the transactionData as needed (e.g., decrypt or validate)
    // For simplicity, we'll assume transactionData is valid

    // Execute the transaction on behalf of the sender
    // Perform the transfer from the zkApp to the receiver
    this.send({
      to: receiverPublicKey,
      amount,
    });
  }
}
