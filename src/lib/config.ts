import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";

/**
 * Single source of truth for CreatorPay's chain + integration endpoints.
 *
 * Settlement model (locked): the MetaMask x402 Facilitator redeems ALL
 * ERC-7710 / ERC-7715 payments.
 */

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

const CHAINS: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
};

export const APP_CHAIN: Chain = CHAINS[CHAIN_ID] ?? baseSepolia;

/** CAIP-2 network id used by x402 payment requirements (e.g. "eip155:84532"). */
export const X402_NETWORK = `eip155:${APP_CHAIN.id}` as const;

/** MetaMask x402 Facilitator URL by chain. Base Sepolia for the testnet demo. */
const FACILITATOR_URLS: Record<number, string> = {
  [baseSepolia.id]:
    "https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402",
  [base.id]:
    "https://tx-sentinel-base-mainnet.dev-api.cx.metamask.io/platform/v2/x402",
};

export const FACILITATOR_URL =
  process.env.FACILITATOR_URL ?? FACILITATOR_URLS[APP_CHAIN.id];


/**
 * Native USDC on the active chain (6 decimals). Override via env when a chain's
 * canonical USDC differs from this default.
 */
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  USDC_ADDRESSES[APP_CHAIN.id]) as `0x${string}`;

export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = "USDC";

export const VENICE_BASE_URL =
  process.env.VENICE_BASE_URL ?? "https://api.venice.ai/api/v1";

export const SESSION_ACCOUNT = (process.env.NEXT_PUBLIC_SESSION_ACCOUNT ?? "") as `0x${string}`;
