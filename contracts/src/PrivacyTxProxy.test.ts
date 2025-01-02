import { PrivacyTxProxy, TransactionVerifier, TransactionProof } from './privacyTxProxy.js';
import { 
  Mina, 
  PrivateKey, 
  PublicKey, 
  AccountUpdate, 
  UInt64, 
  Signature,
  Field,
  Poseidon,
  Bool
} from 'o1js';

let proofsEnabled = false;

describe('PrivacyTxProxy', () => {
    let deployerAccount: Mina.TestPublicKey,
    deployerKey: PrivateKey,
    senderAccount: Mina.TestPublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: PrivacyTxProxy,
    recipientAccount: Mina.TestPublicKey,
    recipientKey: PrivateKey;

  beforeAll(async () => {
    if (proofsEnabled) await PrivacyTxProxy.compile();
  });

  beforeEach(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    
    [deployerAccount, senderAccount, recipientAccount] = Local.testAccounts;
    deployerKey = deployerAccount.key;
    senderKey = senderAccount.key;
    recipientKey = recipientAccount.key;

    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new PrivacyTxProxy(zkAppAddress);
  });
  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      await zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the ProxyContract', async () => {
    await localDeploy();

    const balance = await Mina.getBalance(zkAppAddress);
    expect(balance.toString()).toEqual('0');

    const nonce = await zkApp.nextNonce.get();
    expect(nonce).toEqual(Field(1));

    const poolBalance = await zkApp.poolBalance.get();
    expect(poolBalance).toEqual(UInt64.from(0));
  });

  describe('publicToSecret', () => {
    it('correctly processes public to secret transfer', async () => {
      await localDeploy();

      const amount = UInt64.from(1_000_000_000);
      const proofHash = Poseidon.hash([Field(1), Field(2)]); 
      
      const initialSenderBalance = await Mina.getBalance(senderAccount);
      const initialPoolBalance = await zkApp.poolBalance.get();

      // Fund sender account if needed
      if (initialSenderBalance.lessThan(amount)) {
        const fundTx = await Mina.transaction(deployerAccount, async () => {
          const update = AccountUpdate.create(senderAccount);
          update.balance.addInPlace(amount);
        });
        await fundTx.prove();
        await fundTx.sign([deployerKey]).send();
      }

      const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);

      const txn = await Mina.transaction(senderAccount, async () => {
        await zkApp.publicToSecret(
          senderAccount,
          proofHash,
          amount,
          signature
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      const finalSenderBalance = await Mina.getBalance(senderAccount);
      const finalPoolBalance = await zkApp.poolBalance.get();

      expect(finalSenderBalance.lessThan(initialSenderBalance)).toEqual(true);
      expect(finalPoolBalance).toEqual(amount);
    });

    // ... rest of the tests remain the same ...
  });

  describe('secretToPublic', () => {
    it('correctly processes secret to public transfer', async () => {
      await localDeploy();

      // Fund the pool with initial balance
      const poolAmount = UInt64.from(2_000_000_000);
      await fundPool(poolAmount);

      const transferAmount = UInt64.from(1_000_000_000);
      const initialRecipientBalance = await Mina.getBalance(recipientAccount);

      const transaction = new TransactionProof({
        sender: senderAccount,
        recipient: recipientAccount,
        amount: transferAmount,
        nonce: Field(1)
      });

      const signature = Signature.create(senderKey, transaction.toFields());
      const hash = Poseidon.hash(transaction.toFields());

      const proof = await TransactionVerifier.verify(
        hash,
        transaction,
        signature
      );

      const txn = await Mina.transaction(senderAccount, async () => {
        await zkApp.secretToPublic(
          proof,
          recipientAccount,
          transferAmount
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      const finalRecipientBalance = await Mina.getBalance(recipientAccount);
      const finalPoolBalance = await zkApp.poolBalance.get();

      expect(finalRecipientBalance.sub(initialRecipientBalance).toString())
        .toEqual(transferAmount.toString());
      expect(finalPoolBalance.toString())
        .toEqual(poolAmount.sub(transferAmount).toString());
    });

    // Helper function to fund the pool
    async function fundPool(amount: UInt64) {
      const proofHash = Poseidon.hash([Field(1)]);
      const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);

      // Fund sender account first
      const fundTx = await Mina.transaction(deployerAccount, async () => {
        const update = AccountUpdate.create(senderAccount);
        update.balance.addInPlace(amount);
      });
      await fundTx.prove();
      await fundTx.sign([deployerKey]).send();

      // Then fund the pool
      const poolTx = await Mina.transaction(senderAccount, async () => {
        await zkApp.publicToSecret(
          senderAccount,
          proofHash,
          amount,
          signature
        );
      });
      await poolTx.prove();
      await poolTx.sign([senderKey]).send();
    }

    // ... rest of the tests remain the same ...
  });
});