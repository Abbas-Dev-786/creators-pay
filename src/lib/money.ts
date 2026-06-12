import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS, USDC_SYMBOL } from "./config";

/**
 * Money helpers. Internally amounts are base-unit strings (e.g. "5000000" =
 * 5 USDC). These convert to/from human decimals and the x402 "$X.XX" price
 * string the facilitator expects.
 */

export function toBaseUnits(human: string, decimals = USDC_DECIMALS): string {
  return parseUnits(human, decimals).toString();
}

export function fromBaseUnits(base: string, decimals = USDC_DECIMALS): string {
  return formatUnits(BigInt(base), decimals);
}

/** Format base units for display, e.g. "5 USDC". */
export function formatAmount(
  base: string,
  symbol: string = USDC_SYMBOL,
  decimals = USDC_DECIMALS,
): string {
  return `${fromBaseUnits(base, decimals)} ${symbol}`;
}

/**
 * x402 paymentMiddleware expects a USD price string like "$0.10". Our prices are
 * USDC base units; USDC is dollar-pegged so we render the decimal directly.
 */
export function toX402Price(base: string, decimals = USDC_DECIMALS): string {
  return `$${fromBaseUnits(base, decimals)}`;
}
