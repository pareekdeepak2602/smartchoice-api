import { ethers } from "ethers";

export function getProvider() {
  const { NETWORK, RPC_URL_MAIN, RPC_URL_TEST } = process.env;
  return new ethers.JsonRpcProvider(NETWORK === "main" ? RPC_URL_MAIN : RPC_URL_TEST);
}

export function getChainInfo() {
  const { NETWORK, CHAIN_ID_MAIN, CHAIN_ID_TEST, USDT_ADDRESS_MAIN, USDT_ADDRESS_TEST } = process.env;
  return NETWORK === "main"
    ? { chainId: Number(CHAIN_ID_MAIN), usdt: USDT_ADDRESS_MAIN }
    : { chainId: Number(CHAIN_ID_TEST), usdt: USDT_ADDRESS_TEST };
}

export function validateAddress(address) {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}
