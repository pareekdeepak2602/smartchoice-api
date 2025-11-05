import express from "express";
import { ethers } from "ethers";
import { verifyHMAC } from "../utils/hmacAuth.js";
import { getProvider, getChainInfo, validateAddress } from "../utils/bscUtils.js";
import { buildResponse } from "../utils/responseBuilder.js";

const router = express.Router();

router.post("/", verifyHMAC, async (req, res) => {
  const { toAddress, amount } = req.body;

  // --- 1️⃣ Validate recipient address format
  if (!validateAddress(toAddress)) {
    return res.json(buildResponse("invalid_input", "Invalid recipient address"));
  }

  try {
    // --- 2️⃣ Initialize provider and chain info
    const provider = getProvider();
    const { usdt } = getChainInfo();

    // Ethers v6 returns chainId as BigInt → convert to number
    const { chainId } = await provider.getNetwork();
    const numericChainId = Number(chainId);

    const expectedChainId =
      process.env.NETWORK === "main"
        ? Number(process.env.CHAIN_ID_MAIN || 56) // BSC Mainnet
        : Number(process.env.CHAIN_ID_TEST || 97); // BSC Testnet

    if (numericChainId !== expectedChainId) {
      return res.json(
        buildResponse(
          "network_mismatch",
          `Connected to wrong network (expected chainId=${expectedChainId}, got=${numericChainId})`
        )
      );
    }

    // --- 3️⃣ Setup wallet and USDT contract
    const wallet = new ethers.Wallet(process.env.SYSTEM_PRIVATE_KEY, provider);
    const token = new ethers.Contract(
      usdt,
      [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address,uint256) returns (bool)"
      ],
      wallet
    );

    // --- 4️⃣ Check if recipient exists on the same network
    let recipientActive = true;
    try {
      await token.balanceOf(toAddress);
    } catch (err) {
      recipientActive = false;
    }

    if (!recipientActive) {
      return res.json(
        buildResponse(
          "network_mismatch",
          "Recipient address not reachable or not active on this BSC network"
        )
      );
    }

    // --- 5️⃣ Check system wallet balance (optional but recommended)
    const systemBalance = await token.balanceOf(wallet.address);
    const value = ethers.parseUnits(amount, 18);

    if (systemBalance < value) {
      return res.json(
        buildResponse("insufficient_funds", "System wallet has insufficient USDT balance", {
          available: ethers.formatUnits(systemBalance, 18),
          required: amount
        })
      );
    }

    // --- 6️⃣ Perform the transfer
    const tx = await token.transfer(toAddress, value);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      return res.json(
        buildResponse("failed", "Withdraw transaction failed", { txHash: tx.hash })
      );
    }

    // --- ✅ Success
    res.json(
      buildResponse("success", "Withdrawal successful", {
        txHash: tx.hash,
        toAddress,
        amount,
        network: process.env.NETWORK,
        chainId: numericChainId,
        providerReceipt: receipt
      })
    );
  } catch (err) {
    console.error("❌ Withdraw error:", err.message);
    res.status(500).json(
      buildResponse("error", "Withdrawal failed", { error: err.message })
    );
  }
});

export default router;
