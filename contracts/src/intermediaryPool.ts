import {
    SmartContract,
    method,
    UInt64,
    PublicKey,
    AccountUpdate,
    state,
    State,
  } from 'o1js';
  
  const OWNER = '...'; // Replace with the actual owner's PublicKey in Base58 format
  
  export class IntermediaryPool extends SmartContract {
    // State variable to track the total pool amount
    @state(UInt64) totalPoolAmount = State<UInt64>();
  
    /**
     * Initialization function to set up the contract state.
     * This runs only during the first deployment of the zkApp.
     */
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
  
      // Create an account update for the sender and require their signature
      let senderUpdate = AccountUpdate.create(this.sender.getAndRequireSignatureV2());
      senderUpdate.requireSignature();
  
      // Transfer the deposit amount to the contract
      senderUpdate.send({ to: this.address, amount: amountToDeposit });
  
      // Optionally, you can enforce checks on the contract's balance
      this.account.balance.getAndRequireEquals();
  
      // Update the total pool amount state
      let currentPoolAmount = this.totalPoolAmount.get();
      this.totalPoolAmount.set(currentPoolAmount.add(amountToDeposit));
    }
  
    /**
     * Method to withdraw funds from the pool.
     * Only the owner of the contract can withdraw funds.
     */
    @method async withdraw(amountToWithdraw: UInt64, receiverAddress: PublicKey) {
      console.log('Withdraw initiated');
  
      // Ensure the sender is the contract owner
      this.sender.getAndRequireSignatureV2().assertEquals(PublicKey.fromBase58(OWNER));
  
      // Transfer the specified amount to the receiver's address
      this.send({ to: receiverAddress, amount: amountToWithdraw });
  
      // Update the total pool amount state
      let currentPoolAmount = this.totalPoolAmount.get();
      this.totalPoolAmount.set(currentPoolAmount.sub(amountToWithdraw));
    }
  }
  