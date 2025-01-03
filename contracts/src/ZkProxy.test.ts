import {
    Mina,
    PrivateKey,
    PublicKey,
    AccountUpdate,
    Field,
    Signature,
    UInt64,
    Poseidon,
  } from 'o1js';
  import { TransactionVerifier, TransactionProof, ZkProxy } from './zkProxy';
  
  describe('ZkProxy', () => {
    let zkApp: ZkProxy;
    let zkAppPrivateKey: PrivateKey;
    let zkAppAddress: PublicKey;
    let deployerAccount: PublicKey;
    let deployerKey: PrivateKey;
    let senderAccount: PublicKey;
    let senderKey: PrivateKey;
    let recipientAccount: PublicKey;
    let recipientKey: PrivateKey;
  
    beforeAll(async () => {
      console.log('Compiling contracts...');
      console.time('Compilation time');
      await ZkProxy.compile();
      await TransactionVerifier.compile();
      console.timeEnd('Compilation time');
    });
  
    beforeEach(async () => {
      // Set up local blockchain with proofsEnabled
      const Local = await Mina.LocalBlockchain({
        proofsEnabled: true,
        enforceTransactionLimits: false,
      });
      Mina.setActiveInstance(Local);
  
      // Initialize accounts with specific balances
      const initialBalance = UInt64.from(10_000_000_000);
      const feePayerKey = Local.testAccounts[0].key;
      const feePayer = feePayerKey.toPublicKey();
  
      // Generate new keypairs for testing
      deployerKey = PrivateKey.random();
      deployerAccount = deployerKey.toPublicKey();
      senderKey = PrivateKey.random();
      senderAccount = senderKey.toPublicKey();
      recipientKey = PrivateKey.random();
      recipientAccount = recipientKey.toPublicKey();
  
      // Fund accounts
      console.log('Funding test accounts...');
      const fundAccountsTx = await Mina.transaction(feePayer, async () => {
        const feePayerUpdate = AccountUpdate.fundNewAccount(feePayer, 3);
        feePayerUpdate.send({ to: deployerAccount, amount: initialBalance });
        feePayerUpdate.send({ to: senderAccount, amount: initialBalance });
        feePayerUpdate.send({ to: recipientAccount, amount: initialBalance });
      });
      await fundAccountsTx.sign([feePayerKey]).send();
  
      // Deploy ZkProxy contract
      zkAppPrivateKey = PrivateKey.random();
      zkAppAddress = zkAppPrivateKey.toPublicKey();
      zkApp = new ZkProxy(zkAppAddress);
  
      try {
        console.log('Deploying ZkProxy...');
        const deployTx = await Mina.transaction(deployerAccount, async () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy();
        });
        await deployTx.prove();
        await deployTx.sign([deployerKey, zkAppPrivateKey]).send();
        console.log('ZkProxy deployed successfully');
      } catch (error) {
        console.error('Deployment failed:', error);
        throw error;
      }
    });
  
    it('should process deposit correctly', async () => {
      const amount = UInt64.from(1_000_000_000);
      const proofHash = Poseidon.hash([Field(1)]);
      const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);
  
      try {
        // Get initial balances
        const initialSenderBalance = await Mina.getBalance(senderAccount);
        const initialPoolBalance = await zkApp.poolBalance.get();
  
        // Execute deposit
        console.log('Processing deposit...');
        const tx = await Mina.transaction(senderAccount, async () => {
          zkApp.deposit(senderAccount, proofHash, amount, signature);
        });
        await tx.prove();
        await tx.sign([senderKey]).send();
  
        // Verify balances
        const finalPoolBalance = await zkApp.poolBalance.get();
        const finalSenderBalance = await Mina.getBalance(senderAccount);
  
        // Compare as BigInts for accurate comparison
        const initialBalanceValue = BigInt(initialSenderBalance.toString());
        const finalBalanceValue = BigInt(finalSenderBalance.toString());
        
        expect(finalPoolBalance.toString()).toBe(
          initialPoolBalance.add(amount).toString()
        );
        expect(finalBalanceValue < initialBalanceValue).toBe(true);
        
        console.log('Deposit processed successfully');
      } catch (error) {
        console.error('Deposit failed:', error);
        throw error;
      }
    });
  
    it('should process withdrawal correctly', async () => {
      try {
        // Setup: First deposit funds
        const depositAmount = UInt64.from(5_000_000_000);
        const proofHash = Poseidon.hash([Field(1)]);
        const signature = Signature.create(senderKey, [proofHash, ...depositAmount.toFields()]);
        
        const depositTx = await Mina.transaction(senderAccount, async () => {
          zkApp.deposit(senderAccount, proofHash, depositAmount, signature);
        });
        await depositTx.prove();
        await depositTx.sign([senderKey]).send();
  
        // Create withdrawal transaction
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
  
        // Get balances before withdrawal
        const initialRecipientBalance = await Mina.getBalance(recipientAccount);
        const initialPoolBalance = await zkApp.poolBalance.get();
  
        // Process withdrawal
        console.log('Processing withdrawal...');
        const withdrawTx = await Mina.transaction(senderAccount, async () => {
          zkApp.withdraw(proof, recipientAccount, withdrawAmount);
        });
        await withdrawTx.prove();
        await withdrawTx.sign([senderKey]).send();
  
        // Verify final balances
        const finalPoolBalance = await zkApp.poolBalance.get();
        const finalRecipientBalance = await Mina.getBalance(recipientAccount);
        const expectedPoolBalance = depositAmount.sub(withdrawAmount);
  
        expect(finalPoolBalance.toString()).toBe(expectedPoolBalance.toString());
        expect(finalRecipientBalance.toString()).toBe(
          initialRecipientBalance.add(withdrawAmount).toString()
        );
        
        console.log('Withdrawal processed successfully');
      } catch (error) {
        console.error('Withdrawal flow failed:', error);
        throw error;
      }
    });
  
    it('should reject invalid deposits', async () => {
      const invalidAmount = UInt64.from(0);
      const proofHash = Poseidon.hash([Field(1)]);
      const signature = Signature.create(senderKey, [proofHash, ...invalidAmount.toFields()]);
      
      await expect(async () => {
        const tx = await Mina.transaction(senderAccount, async () => {
          zkApp.deposit(senderAccount, proofHash, invalidAmount, signature);
        });
        await tx.prove();
      }).rejects.toThrow();
    });
  });