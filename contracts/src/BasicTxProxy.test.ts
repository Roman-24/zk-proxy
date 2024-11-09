// TODO: Add tests
import { BasicTxProxy } from './BasicTxProxy.js';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, UInt64 } from 'o1js';

let proofsEnabled = false;

describe('BasicTxProxy', () => {
    let deployerAccount: Mina.TestPublicKey,
    deployerKey: PrivateKey,
    senderAccount: Mina.TestPublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: BasicTxProxy,
    reciverAccount: Mina.TestPublicKey,
    reciverKey: PrivateKey;

  beforeAll(async () => {
    if (proofsEnabled) await BasicTxProxy.compile();
  });

  beforeEach(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    
    [deployerAccount, senderAccount, reciverAccount] = Local.testAccounts;
    deployerKey = deployerAccount.key;
    senderKey = senderAccount.key;
    reciverKey = reciverAccount.key;

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

  /*
  it('correctly proxies a transaction', async () => {
    await localDeploy();

    const amount = UInt64.from(1_000_000_000);

    const initialSenderBalance = await Mina.getBalance(senderAccount);
    const initialZkAppBalance = await Mina.getBalance(zkAppAddress);
    const initialTotalProxed = await zkApp.totalProxed.get();
    const initialReciverBalance = await Mina.getBalance(reciverAccount);

    // Send transaction to proxy
    const txn = await Mina.transaction(senderAccount, async () => {
      await zkApp.proxyReceive(amount, reciverAccount);
    });

    await txn.prove();
    await txn.sign([senderKey]).send();

    const finalSenderBalance = await Mina.getBalance(senderAccount);
    const finalZkAppBalance = await Mina.getBalance(zkAppAddress);
    const finalReciverBalance = await Mina.getBalance(reciverAccount);
    // Check balances
    expect(initialSenderBalance.sub(finalSenderBalance).toString()).toEqual("0");
    expect(finalZkAppBalance.sub(initialZkAppBalance).toString()).toEqual("0");
    expect(finalReciverBalance.sub(initialReciverBalance).toString()).toEqual(amount.toString());
  });
  */

});
