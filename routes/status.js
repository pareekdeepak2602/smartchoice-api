import express from "express";
import { ethers } from "ethers";
import { getProvider, getChainInfo } from "../utils/bscUtils.js";
import { buildResponse } from "../utils/responseBuilder.js";

const router = express.Router();

// Helper function to safely serialize BigInt values
function safeSerialize(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }));
}

// Public health check endpoint (no auth required)
router.get("/health", async (req, res) => {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const expectedChainId =
      process.env.NETWORK === "main"
        ? Number(process.env.CHAIN_ID_MAIN || 56)
        : Number(process.env.CHAIN_ID_TEST || 97);

    // Check if connected to correct network
    if (chainId !== expectedChainId) {
      return res.status(500).json(
        buildResponse("network_mismatch", "Connected to wrong network", {
          expected: expectedChainId,
          actual: chainId
        })
      );
    }

    // Check system wallet connectivity
    const wallet = new ethers.Wallet(process.env.SYSTEM_PRIVATE_KEY, provider);
    const { usdt } = getChainInfo();
    const token = new ethers.Contract(
      usdt,
      ["function balanceOf(address) view returns (uint256)"],
      wallet
    );

    const systemBalance = await token.balanceOf(wallet.address);
    const formattedBalance = ethers.formatUnits(systemBalance, 18);

    const responseData = {
      network: process.env.NETWORK,
      chainId: chainId,
      systemWallet: wallet.address,
      systemBalance: formattedBalance,
      timestamp: new Date().toISOString(),
      status: "operational"
    };

    res.json(buildResponse("success", "Service is healthy", responseData));
    
  } catch (err) {
    console.error("❌ Health check error:", err.message);
    res.status(500).json(
      buildResponse("error", "Service is unhealthy", {
        error: err.message,
        timestamp: new Date().toISOString(),
        status: "unhealthy"
      })
    );
  }
});

// Simple ping endpoint
router.get("/ping", (req, res) => {
  res.json(
    buildResponse("success", "pong", {
      timestamp: new Date().toISOString(),
      service: "blockchain-service",
      version: "1.0.0"
    })
  );
});

// Detailed status endpoint
router.get("/status", async (req, res) => {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const expectedChainId =
      process.env.NETWORK === "main"
        ? Number(process.env.CHAIN_ID_MAIN || 56)
        : Number(process.env.CHAIN_ID_TEST || 97);

    const { usdt } = getChainInfo();
    const wallet = new ethers.Wallet(process.env.SYSTEM_PRIVATE_KEY, provider);
    
    const token = new ethers.Contract(
      usdt,
      [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ],
      wallet
    );

    const [systemBalance, decimals, blockNumber, feeData] = await Promise.all([
      token.balanceOf(wallet.address),
      token.decimals(),
      provider.getBlockNumber(),
      provider.getFeeData()
    ]);

    const formattedBalance = ethers.formatUnits(systemBalance, decimals);
    
    // Convert BigInt gas prices to strings
    const gasPrice = feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : null;
    const maxFeePerGas = feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : null;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : null;

    const responseData = {
      service: "blockchain-withdrawal-service",
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    };

    res.json(buildResponse("success", "Service status retrieved", responseData));
    
  } catch (err) {
    console.error("❌ Status check error:", err.message);
    res.status(500).json(
      buildResponse("error", "Failed to get service status", {
        error: err.message,
        timestamp: new Date().toISOString(),
        status: "degraded"
      })
    );
  }
});

export default router;