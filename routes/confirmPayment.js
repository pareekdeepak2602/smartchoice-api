import express from "express";
import { ethers } from "ethers";
import { getProvider, getChainInfo } from "../utils/bscUtils.js";
import { verifyHMAC } from "../utils/hmacAuth.js";
import { buildResponse } from "../utils/responseBuilder.js";

const router = express.Router();

router.post("/", verifyHMAC, async (req, res) => {
  const { txHash, toAddress, amount } = req.body;
  const provider = getProvider();
  const { usdt } = getChainInfo(); // should be the USDT contract address

  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx)
      return res.json(buildResponse("not_found", "Transaction not found", { txHash }));

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status === 0)
      return res.json(buildResponse("failed", "Transaction failed", { txHash }));

    // decode Transfer events
    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ]);

    let matched = false;
    for (const log of receipt.logs) {
      // Check USDT contract address match
      if (log.address.toLowerCase() === usdt.toLowerCase()) {
        try {
          const parsed = iface.parseLog(log);
          const to = parsed.args.to.toLowerCase();
          const valueRaw = parsed.args.value;

          // Try decoding as 18-decimal token first, then 6
          const val18 = parseFloat(ethers.formatUnits(valueRaw, 18)).toFixed(6);
          const val6 = parseFloat(ethers.formatUnits(valueRaw, 6)).toFixed(6);
          const amt = parseFloat(amount).toFixed(6);

          console.log(`→ Found transfer to ${to}, val18=${val18}, val6=${val6}, expected=${amt}`);

          if (to === toAddress.toLowerCase() && (val18 === amt || val6 === amt)) {
            matched = true;
            break;
          }
        } catch (err) {
          console.error("Error parsing log:", err.message);
        }
      }
    }

    if (!matched)
      return res.json(buildResponse("mismatch", "No matching USDT transfer found", { txHash }));

    return res.json(
      buildResponse("success", "Payment verified successfully", {
        txHash,
        toAddress,
        amount,
        network: process.env.NETWORK,
        blockNumber: receipt.blockNumber,
      })
    );

  } catch (e) {
    console.error("Blockchain query error:", e);
    res.status(500).json(buildResponse("error", "Blockchain query failed", { error: e.message }));
  }
});

export default router;
