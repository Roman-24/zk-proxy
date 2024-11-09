import {
    SmartContract,
    method,
    UInt64,
    PublicKey,
    AccountUpdate,
    state,
    State,
    Field,
    Struct,
  } from 'o1js';

  const OWNER = '...'

  export class ProxyReceiveInfo extends Struct({
    senderAddress: PublicKey,
    amount: UInt64,
  }) {}

  export class ProxySendInfo extends Struct({
    receiverAddress: PublicKey,
    amount: UInt64,
  }) {}

  export class BasicTxProxy extends SmartContract {

    events = {
      "proxy-receive": ProxyReceiveInfo,
      "proxy-send": ProxySendInfo
    }

    @state(UInt64) totalProxed = State<UInt64>();

    init() {
      super.init();
      this.totalProxed.set(UInt64.from(0));
    }

    @method async proxyReceive(amount: UInt64, receiverAddress: PublicKey) {
      console.log("proxyReceive");

      let senderUpdate = AccountUpdate.create(this.sender.getAndRequireSignatureV2());
      senderUpdate.requireSignature();
      senderUpdate.send({ to: this, amount });
      this.account.balance.getAndRequireEquals();
  
      this.emitEvent("proxy-receive", new ProxyReceiveInfo({
        senderAddress: this.sender.getAndRequireSignatureV2(), 
        amount
      }));

      await this.proxySend(amount, receiverAddress);
    }

    @method async proxySend(amountToProxy: UInt64, receiverAddress: PublicKey) {
      console.log("proxySend");
      // this.sender.getAndRequireSignature().assertEquals(PublicKey.fromBase58(OWNER));
  
      this.send({to: receiverAddress, amount: amountToProxy });
  
      this.totalProxed.set(this.totalProxed.getAndRequireEquals().add(amountToProxy));
  
      this.emitEvent("proxy-send", new ProxySendInfo({
        receiverAddress,
        amount: amountToProxy
      }));
    }
    
  }
  
  