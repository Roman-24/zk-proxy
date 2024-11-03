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

    @method async proxyReceive(amount: UInt64) {
      let senderUpdate = AccountUpdate.create(this.sender.getAndRequireSignatureV2());
      senderUpdate.requireSignature();
      senderUpdate.send({ to: this, amount });
      this.account.balance.getAndRequireEquals();
  
      this.totalProxed.set(this.totalProxed.getAndRequireEquals().add(amount));
      this.emitEvent("proxy-receive", new ProxyReceiveInfo({
        senderAddress: this.sender.getAndRequireSignatureV2(), 
        amount
      }));

      this.proxySend();
    }

    @method async proxySend() {
      // this.sender.getAndRequireSignature().assertEquals(PublicKey.fromBase58(OWNER));
      const amount = this.account.balance.getAndRequireEquals();
  
      this.send({to: this.sender.getAndRequireSignatureV2(), amount });
  
      this.totalProxed.set(new UInt64(0));
  
      this.emitEvent("proxy-send", amount);
    }
    
  }
  
  