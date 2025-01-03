// TODO: Add tests
/*
import { BasicTxProxy } from './basicTxProxy.js';
import { Mina, PrivateKey, PublicKey, AccountUpdate, UInt64 } from 'o1js';

let proofsEnabled = false;

describe('BasicTxProxy', () => {
    let deployerAccount: Mina.TestPublicKey,
    deployerKey: PrivateKey,
    senderAccount: Mina.TestPublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: BasicTxProxy,
    recipientAccount: Mina.TestPublicKey,
    recipientKey: PrivateKey;

  beforeAll(async () => {
    if (proofsEnabled) await BasicTxProxy.compile();
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
    zkApp = new BasicTxProxy(zkAppAddress);
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

it('generates and deploys the BasicTxProxy smart contract', async () => {
    await localDeploy();

    const balance = await Mina.getBalance(zkAppAddress);
    expect(balance.toString()).toEqual('0');

    const num = await zkApp.totalProxed.get();
    expect(num).toEqual(UInt64.from(0));
  });

  it('correctly proxies a transaction', async () => {
    await localDeploy();

    const amount = UInt64.from(1_000_000_000_000);

    const initialSenderBalance = await Mina.getBalance(senderAccount);
    const initialZkAppBalance = await Mina.getBalance(zkAppAddress);
    const initialTotalProxed = await zkApp.totalProxed.get();
    const initialReciverBalance = await Mina.getBalance(recipientAccount);

    // Check initial balances
    expect(initialSenderBalance.toString()).toEqual(amount.toString());
    expect(initialZkAppBalance.toString()).toEqual('0');
    // Reciver balance is not zero because it is funded in the localDeploy function
    expect(initialReciverBalance.toString()).toEqual(amount.toString());
    expect(initialTotalProxed.toString()).toEqual('0');

    // Send transaction to proxy
    const txn = await Mina.transaction(senderAccount, async () => {
      await zkApp.proxyReceive(amount, recipientAccount);
    });

    await txn.prove();
    await txn.sign([senderKey]).send();

    const finalSenderBalance = await Mina.getBalance(senderAccount);
    const finalZkAppBalance = await Mina.getBalance(zkAppAddress);
    const finalTotalProxed = await zkApp.totalProxed.get();
    const finalReciverBalance = await Mina.getBalance(recipientAccount);

    // Check final balances
    const amountFinal = UInt64.from(2_000_000_000_000);
    expect(finalSenderBalance.toString()).toEqual('0');
    expect(finalZkAppBalance.toString()).toEqual('0');
    expect(finalReciverBalance.toString()).toEqual(amountFinal.toString());
    expect(finalTotalProxed.toString()).toEqual(amount.toString());
  });

});
*/