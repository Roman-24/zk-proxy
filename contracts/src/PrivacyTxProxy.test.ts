// privacyTxProxy.test.ts
/*
import { PrivacyTxProxy, TransactionVerifier, TransactionProof } from './privacyTxProxy';
import {
    Mina,
    PrivateKey,
    PublicKey,
    AccountUpdate,
    UInt64,
    Signature,
    Field,
    Poseidon,
} from 'o1js';

describe('PrivacyTxProxy', () => {
    let proofsEnabled = false;
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
        await PrivacyTxProxy.compile();
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
            await zkApp.deploy({});
        });
        await txn.prove();
        await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }
    async function mintBalance(pubkey: PublicKey, amount: UInt64) {
        const tx = await Mina.transaction(deployerAccount, async () => {
            AccountUpdate.createSigned(deployerAccount).send({
                to: pubkey,
                amount
            });
        });
        await tx.prove();
        await tx.sign([deployerKey]).send();
    }

    it('generates and deploys the ProxyContract', async () => {
        await localDeploy();

        const balance = await Mina.getBalance(zkAppAddress);
        expect(balance.toString()).toBe('0');

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

            if (initialSenderBalance.lessThan(amount)) {
                await mintBalance(senderAccount, amount);
            }

            const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);

            const txn = await Mina.transaction(senderAccount, async () => {
                zkApp.publicToSecret(
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

            expect(finalSenderBalance.lessThan(initialSenderBalance)).toBeTruthy();
            expect(finalPoolBalance).toEqual(amount);
        });
    });

    describe('secretToPublic', () => {
        it('correctly processes secret to public transfer', async () => {
            await localDeploy();

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
                zkApp.secretToPublic(
                    proof,
                    recipientAccount,
                    transferAmount
                );
            });

            await txn.prove();
            await txn.sign([senderKey]).send();

            const finalRecipientBalance = await Mina.getBalance(recipientAccount);
            const finalPoolBalance = await zkApp.poolBalance.get();

            expect(finalRecipientBalance.sub(initialRecipientBalance)).toEqual(transferAmount);
            expect(finalPoolBalance).toEqual(poolAmount.sub(transferAmount));
        });

        async function fundPool(amount: UInt64) {
            const proofHash = Poseidon.hash([Field(1)]);
            const signature = Signature.create(senderKey, [proofHash, ...amount.toFields()]);

            await mintBalance(senderAccount, amount);

            const poolTx = await Mina.transaction(senderAccount, async () => {
                zkApp.publicToSecret(
                    senderAccount,
                    proofHash,
                    amount,
                    signature
                );
            });
            await poolTx.prove();
            await poolTx.sign([senderKey]).send();
        }
    });
});
*/