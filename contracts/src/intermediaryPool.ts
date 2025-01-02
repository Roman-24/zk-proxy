import {
    SmartContract,
    method,
    UInt64,
    PublicKey,
    AccountUpdate,
    state,
    State,
  } from 'o1js';
  
  const OWNER = '...'; // Replace securely
  
  export class IntermediaryPool extends SmartContract {
    @state(UInt64) totalPoolAmount = State<UInt64>();
  
    init() {
      super.init();
      this.totalPoolAmount.set(UInt64.from(0)); // Initialize total pool amount to 0
    }
  
    /**
     * Method to deposit funds into the pool.
     * Transfers the specified amount from the sender to this contract.
     */
    @method async deposit(amountToDeposit: UInt64) {
      console.log('Deposit initiated');
  
      amountToDeposit.assertGreaterThan(UInt64.from(0), 'Deposit amount must be positive.');
  
      let senderUpdate = AccountUpdate.create(this.sender.getAndRequireSignatureV2());
      senderUpdate.requireSignature();
  
      senderUpdate.send({ to: this.address, amount: amountToDeposit });
  
      this.account.balance.getAndRequireEquals();
  
      let currentPoolAmount = this.totalPoolAmount.get();
      this.totalPoolAmount.set(currentPoolAmount.add(amountToDeposit));
    }
  
    /**
     * Method to withdraw funds from the pool.
     * Only the owner of the contract can withdraw funds.
     */
    @method async withdraw(amountToWithdraw: UInt64, receiverAddress: PublicKey) {
      console.log('Withdraw initiated');
  
      amountToWithdraw.assertGreaterThan(UInt64.from(0), 'Withdrawal amount must be positive.');
  
      this.sender.getAndRequireSignatureV2().assertEquals(PublicKey.fromBase58(OWNER));
  
      let currentPoolAmount = this.totalPoolAmount.get();
      amountToWithdraw.assertLessThanOrEqual(currentPoolAmount, 'Insufficient pool balance.');
  
      this.send({ to: receiverAddress, amount: amountToWithdraw });
  
      this.totalPoolAmount.set(currentPoolAmount.sub(amountToWithdraw));
    }
  }
  