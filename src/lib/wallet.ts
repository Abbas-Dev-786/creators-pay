/**
 * Wallet provider guards for the ERC-7715 flows.
 *
 * All three checkout flows (one-time, subscription, AI) call MetaMask's
 * `requestExecutionPermissions` (ERC-7715). That method is MetaMask-specific —
 * other injected wallets (Coinbase Wallet, etc.) reject it with an opaque
 * "this request method is not supported" RPC error. If a non-MetaMask provider
 * is active (e.g. Coinbase Wallet won the injected race or auto-reconnected),
 * we want to fail early with an actionable message instead.
 */
export function assertMetaMaskProvider(
  provider: unknown,
): asserts provider is { request: (...args: any[]) => Promise<any> } {
  const p = provider as Record<string, unknown> | null | undefined;
  if (!p) {
    throw new Error("Could not reach your wallet provider. Make sure MetaMask is unlocked.");
  }

  // Coinbase Wallet (and a few others) set `isMetaMask: true` for compat, so an
  // explicit Coinbase/Brave exclusion is required on top of the isMetaMask flag.
  const isCoinbase = Boolean(p.isCoinbaseWallet || p.isCoinbaseBrowser || p.qrUrl);
  const isMetaMask = Boolean(p.isMetaMask) && !isCoinbase;

  if (!isMetaMask) {
    throw new Error(
      "This flow requires MetaMask — it uses MetaMask's ERC-7715 permissions, " +
        "which other wallets (e.g. Coinbase Wallet) don't support. Please disconnect " +
        "and reconnect using MetaMask.",
    );
  }
}
