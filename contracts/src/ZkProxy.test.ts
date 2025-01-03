import { Mina, AccountUpdate, PrivateKey, Field, Poseidon, PublicKey, Signature, UInt64 } from 'o1js';
import { TransactionVerifier, TransactionProof, ZkProxy } from './zkProxy';

describe('ZkProxy', () => {
  let zkApp: ZkProxy;
  let deployerAccount: PublicKey;
  let deployerKey: PrivateKey;
  let senderAccount: PublicKey;
  let senderKey: PrivateKey;
  let recipientAccount: PublicKey;
  let recipientKey: PrivateKey;

  beforeAll(async () => {
    // Compile contracts
    console.time('Compilation');
    await ZkProxy.compile();
    await TransactionVerifier.compile();
    console.timeEnd('Compilation');
  });

  beforeEach(async () => {
    // Set up local blockchain
    const Local = await  Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    // Set up test accounts
    const testAccounts = Local.testAccounts;
    deployerKey = PrivateKey.fromBase58(testAccounts[0].privateKey);
    deployerAccount = PublicKey.fromBase58(testAccounts[0].publicKey);
    senderKey = PrivateKey.fromBase58(testAccounts[1].privateKey);
    senderAccount = PublicKey.fromBase58(testAccounts[1].publicKey);
    recipientKey = PrivateKey.fromBase58(testAccounts[2].privateKey);
    recipientAccount = testAccounts[2].publicKey;

    // Deploy contract
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ZkProxy(zkAppAddress);
    
    const deployTx = await Mina.transaction(deployerAccount, async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({});
    });
    await deployTx.prove();
    await deployTx.sign([deployerKey, zkAppPrivateKey]).send();
  });

  /**
   * @notice Test basic deposit functionality
   */
  it('should process deposit correctly', async () => {
    const amount = UInt64.from(1_000_000_000);
    const proofHash = Poseidon.hash([Field(1)]);
    const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);
    // Execute deposit
    const tx = await Mina.transaction(senderAccount, async () => {
      zkApp.deposit(senderAccount, proofHash, amount, signature);
    });
    await tx.prove();
    await tx.sign([senderKey]).send();

    // Verify pool balance
    const poolBalance = await zkApp.poolBalance.get();
    expect(poolBalance.toString()).toBe(amount.toString());
  });

  /**
   * @notice Test complete withdrawal flow
   */
  it('should process withdrawal correctly', async () => {
    // Setup: First deposit funds
    const depositAmount = UInt64.from(5_000_000_000);
    const proofHash = Poseidon.hash([Field(1)]);
    const signature = Signature.create(senderKey, [proofHash, ...depositAmount.toFields()]);
    
    const depositTx = await Mina.transaction(senderAccount, async () => {
      zkApp.deposit(senderAccount, proofHash, depositAmount, signature);
    });
    await depositTx.prove();
    await depositTx.sign([senderKey]).send();

    // Create withdrawal proof
    const withdrawAmount = UInt64.from(1_000_000_000);
    const transaction = new TransactionProof({
      sender: senderAccount,
      recipient: recipientAccount,
      amount: withdrawAmount,
      nonce: Field(1)
    });
    
    const withdrawalHash = Poseidon.hash(transaction.toFields());
    const proof = await TransactionVerifier.verify(
      withdrawalHash,
      transaction,
      Signature.create(senderKey, transaction.toFields())
    );
    // Execute withdrawal
    const withdrawTx = await Mina.transaction(senderAccount, async () => {
      zkApp.withdraw(proof, recipientAccount, withdrawAmount);
    });
    await withdrawTx.prove();
    await withdrawTx.sign([senderKey]).send();

    // Verify final balances
    const poolBalance = await zkApp.poolBalance.get();
    const expectedBalance = depositAmount.sub(withdrawAmount);
    expect(poolBalance.toString()).toBe(expectedBalance.toString());
  });
});