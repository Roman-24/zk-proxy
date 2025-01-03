import { ZkProxy, TransactionVerifier, TransactionProof } from './zkProxy.js';
import { 
  Mina, 
  PrivateKey, 
  PublicKey, 
  UInt64, 
  Signature,
  Field,
  Poseidon,
  AccountUpdate,
  SelfProof,
} from 'o1js';

let proofsEnabled = false;

describe('ZkProxy Integration Tests', () => {
  let zkApp: ZkProxy;
  let deployerAccount: Mina.TestPublicKey;
  let deployerKey: PrivateKey;
  let senderAccount: Mina.TestPublicKey;
  let senderKey: PrivateKey;
  let recipientAccount: Mina.TestPublicKey;
  let recipientKey: PrivateKey;
  
  beforeAll(async () => {
    // Compile contracts
    console.time('Compilation');
    await ZkProxy.compile();
    await TransactionVerifier.compile();
    console.timeEnd('Compilation');
  });

  beforeEach(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    
    [deployerAccount, senderAccount, recipientAccount] = Local.testAccounts;
    deployerKey = deployerAccount.key;
    senderKey = senderAccount.key;
    recipientKey = recipientAccount.key;
    
    // Deploy contract
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ZkProxy(zkAppAddress);
    
    await deployContract(zkApp, deployerKey, zkAppPrivateKey);
  });

  describe('Contract Deployment', () => {
    it('should initialize with correct default values', async () => {
      const nonce = await zkApp.nextNonce.get();
      const poolBalance = await zkApp.poolBalance.get();
      
      expect(nonce).toEqual(Field(1));
      expect(poolBalance).toEqual(UInt64.from(0));
    });
    it('should have correct permissions set', async () => {
      const permissions = zkApp.account.permissions.get();
      expect(permissions.editState).toBeDefined();
      expect(permissions.send).toBeDefined();
      expect(permissions.receive).toBeDefined();
    });
  });

  describe('Deposit Functionality', () => {
    it('should process single deposit correctly', async () => {
      const amount = UInt64.from(1_000_000_000);
      const proofHash = Poseidon.hash([Field(1)]);
      
      const initialBalance = await Mina.getBalance(senderAccount);
      
      await deposit(amount, proofHash, senderKey);
      
      const finalBalance = await Mina.getBalance(senderAccount);
      const poolBalance = await zkApp.poolBalance.get();
      
      expect(poolBalance).toEqual(amount);
      expect(finalBalance.lessThan(initialBalance)).toBeTruthy();
    });

    it('should handle multiple deposits', async () => {
      const amounts = [
        UInt64.from(1_000_000),
        UInt64.from(2_000_000),
        UInt64.from(3_000_000)
      ];
      
      let totalAmount = UInt64.from(0);
      
      for (const amount of amounts) {
        const proofHash = Poseidon.hash([Field(Math.random())]);
        await deposit(amount, proofHash, senderKey);
        totalAmount = totalAmount.add(amount);
      }
      
      const poolBalance = await zkApp.poolBalance.get();
      expect(poolBalance).toEqual(totalAmount);
    });

    it('should fail deposit with invalid signature', async () => {
      const amount = UInt64.from(1_000_000);
      const proofHash = Poseidon.hash([Field(1)]);
      const wrongKey = PrivateKey.random();
      
      await expect(deposit(amount, proofHash, wrongKey))
        .rejects
        .toThrow();
    });
  });

  describe('Withdrawal Functionality', () => {
    beforeEach(async () => {
      // Setup initial pool balance
      const initialAmount = UInt64.from(5_000_000_000);
      await fundPool(initialAmount);
    });

    it('should process valid withdrawal', async () => {
      const withdrawAmount = UInt64.from(1_000_000_000);
      const initialRecipientBalance = await Mina.getBalance(recipientAccount);
      
      const proof = await createWithdrawalProof({
        sender: senderAccount,
        recipient: recipientAccount,
        amount: withdrawAmount,
        nonce: Field(1)
      });
      
      await withdraw(proof, recipientAccount, withdrawAmount, senderKey);
      
      const finalRecipientBalance = await Mina.getBalance(recipientAccount);
      expect(finalRecipientBalance.sub(initialRecipientBalance))
        .toEqual(withdrawAmount);
    });

    it('should prevent double spending', async () => {
      const withdrawAmount = UInt64.from(1_000_000_000);
      const proof = await createWithdrawalProof({
        sender: senderAccount,
        recipient: recipientAccount,
        amount: withdrawAmount,
        nonce: Field(1)
      });
      
      await withdraw(proof, recipientAccount, withdrawAmount, senderKey);
      
      await expect(
        withdraw(proof, recipientAccount, withdrawAmount, senderKey)
      ).rejects.toThrow();
    });

    it('should fail withdrawal exceeding pool balance', async () => {
      const excessiveAmount = UInt64.from(10_000_000_000);
      const proof = await createWithdrawalProof({
        sender: senderAccount,
        recipient: recipientAccount,
        amount: excessiveAmount,
        nonce: Field(1)
      });
      
      await expect(
        withdraw(proof, recipientAccount, excessiveAmount, senderKey)
      ).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple transactions within block limit', async () => {
      console.time('Multiple Transactions');
      const transactionCount = 10;
      const amount = UInt64.from(1_000_000);
      
      const promises = Array(transactionCount).fill(0).map(async (_, i) => {
        const proofHash = Poseidon.hash([Field(i)]);
        await deposit(amount, proofHash, senderKey);
      });
      
      await Promise.all(promises);
      console.timeEnd('Multiple Transactions');
      
      const poolBalance = await zkApp.poolBalance.get();
      expect(poolBalance).toEqual(amount.mul(UInt64.from(transactionCount)));
    });
  });

  describe('Security Tests', () => {
    it('should maintain constant-time operations', async () => {
      const iterations = 5;
      const timings: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await deposit(UInt64.from(1_000_000), Poseidon.hash([Field(i)]), senderKey);
        timings.push(performance.now() - start);
      }
      
      const variance = calculateVariance(timings);
      expect(variance).toBeLessThan(1000); // Max 1s variance
    });
  });
});

// Helper functions
async function deployContract(
  zkApp: ZkProxy, 
  deployerKey: PrivateKey, 
  zkAppPrivateKey: PrivateKey
) {
  const tx = await Mina.transaction(deployerKey.toPublicKey(), async () => {
    AccountUpdate.fundNewAccount(deployerKey.toPublicKey());
    zkApp.deploy({});
  });
  await tx.prove();
  await tx.sign([deployerKey, zkAppPrivateKey]).send();
}

async function deposit(
  amount: UInt64, 
  proofHash: Field, 
  senderKey: PrivateKey
) {
  const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);
  const tx = await Mina.transaction(senderKey.toPublicKey(), async () => {
    zkApp.deposit(senderKey.toPublicKey(), proofHash, amount, signature);
  });
  await tx.prove();
  await tx.sign([senderKey]).send();
}

async function withdraw(
  proof: SelfProof<Field, TransactionProof>,
  recipient: PublicKey,
  amount: UInt64,
  senderKey: PrivateKey
) {
  const tx = await Mina.transaction(senderKey.toPublicKey(), async () => {
    zkApp.withdraw(proof, recipient, amount);
  });
  await tx.prove();
  await tx.sign([senderKey]).send();
}

async function createWithdrawalProof(params: {
  sender: PublicKey;
  recipient: PublicKey;
  amount: UInt64;
  nonce: Field;
}): Promise<SelfProof<Field, TransactionProof>> {
  const transaction = new TransactionProof(params);
  // We need a private key to create a signature, not a public key
  const senderPrivateKey = PrivateKey.random(); // This is just for testing
  const signature = Signature.create(senderPrivateKey, transaction.toFields());
  const hash = Poseidon.hash(transaction.toFields());
  
  return await TransactionVerifier.verify(hash, transaction, signature);
}

async function fundPool(amount: UInt64) {
  const senderKey = PrivateKey.random(); // Create a random private key for testing
  const proofHash = Poseidon.hash([Field(1)]);
  const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);
  
  await deposit(amount, proofHash, senderKey);
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b) / numbers.length;
  return Math.sqrt(
    numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length
  );
}