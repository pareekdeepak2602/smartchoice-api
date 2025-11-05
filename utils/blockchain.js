const { ethers } = require('ethers');
const Payment = require('../../models/payment');

const NETWORK = process.env.NETWORK || 'mainnet';
const BSC_RPC = NETWORK === 'testnet' ? process.env.BSC_RPC_TESTNET : process.env.BSC_RPC_MAINNET;
const WALLET_ADDRESS = (process.env.WALLET_ADDRESS || '').toLowerCase();
const USDT_CONTRACT = process.env.USDT_CONTRACT;
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || 3);

const provider = new ethers.JsonRpcProvider(BSC_RPC);
const usdt = new ethers.Contract(USDT_CONTRACT, [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)'
], provider);

exports.isValidAddress = (addr) => ethers.isAddress(addr);

// Listen for transfers
usdt.on('Transfer', async (from, to, value, event) => {
  try {
    if (to.toLowerCase() !== WALLET_ADDRESS) return;

    const tx = await provider.getTransaction(event.transactionHash);
    if (tx.chainId !== (NETWORK === 'mainnet' ? 56 : 97)) {
      console.warn('Wrong network transaction detected');
      return;
    }

    const receipt = await provider.getTransactionReceipt(event.transactionHash);
    if (receipt.status === 0) {
      console.warn('Transaction failed due to insufficient gas or other error');
      return;
    }

    const valueStr = value.toString();
    const payment = await Payment.findOne({ amountRaw: valueStr, status: 'pending' }).sort({ createdAt: 1 });
    if (!payment) return;

    payment.status = 'detected';
    payment.txHash = event.transactionHash;
    await payment.save();

    // Wait for confirmations
    waitForConfirmations(event.transactionHash, payment._id).catch(console.error);

  } catch (err) {
    console.error('Transfer event handler error:', err);
  }
});

async function waitForConfirmations(txHash, paymentId) {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        const currentBlock = await provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber + 1;
        if (confirmations >= CONFIRMATIONS) {
          await Payment.findByIdAndUpdate(paymentId, { status: 'confirmed' });
          console.log(`Payment ${paymentId} confirmed.`);
          return;
        }
      }
    } catch (err) { console.error(err); }
    await new Promise(r => setTimeout(r, 5000));
  }

  await Payment.findByIdAndUpdate(paymentId, { status: 'failed' });
  console.warn(`Payment ${paymentId} could not be confirmed in time.`);
}

module.exports = { provider, usdt };
