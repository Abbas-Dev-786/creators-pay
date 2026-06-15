"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { switchChain } from "wagmi/actions";
import { createWalletClient, custom } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { APP_CHAIN, USDC_ADDRESS } from "@/lib/config";
import { wagmiConfig } from "@/providers/AppProvider";
import Button from "@/components/Button";

export function CheckoutButton({
  productId,
  priceAmount,
  type,
  creatorAddress
}: {
  productId: string;
  priceAmount: string;
  type: string;
  creatorAddress: string;
}) {
  const { address, isConnected, chainId, connector } = useAccount();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const wrongNetwork = isConnected && chainId !== APP_CHAIN.id;

  async function handleBuy() {
    if (!isConnected || !address || !connector) return alert("Please connect your wallet first.");
    setLoading(true);
    setResult(null);

    try {
      // Ensure the wallet is on the right network before requesting permissions.
      if (chainId !== APP_CHAIN.id) {
        await switchChain(wagmiConfig, { chainId: APP_CHAIN.id });
      }

      // Use the connected wallet's own provider (EIP-6963), not window.ethereum,
      // which another installed extension may have taken over.
      const provider = await connector.getProvider();
      if (!provider) throw new Error("Could not reach your wallet provider.");

      const wallet7715 = createWalletClient({
        chain: APP_CHAIN,
        transport: custom(provider as any),
      }).extend(erc7715ProviderActions());

      // MetaMask refuses to sign a raw ERC-7710 delegation for its own account
      // ("External signature requests cannot sign delegations for internal
      // accounts"). So instead of building a delegation client in the browser, we
      // request a scoped ERC-7715 permission for exactly this purchase (+ a small
      // buffer for the facilitator's gas fee, also pulled from the budget) granted
      // to our backend session account, which redeems it once via the Facilitator.
      const estimatedFee = 50000n; // 0.05 USDC in 6 decimals
      const totalAmount = BigInt(priceAmount) + estimatedFee;

      const granted = await wallet7715.requestExecutionPermissions([{
        chainId: APP_CHAIN.id,
        to: process.env.NEXT_PUBLIC_SESSION_ACCOUNT as `0x${string}`,
        permission: {
          type: "erc20-token-periodic",
          data: {
            tokenAddress: USDC_ADDRESS,
            periodAmount: totalAmount,
            periodDuration: 86400,
            justification: "One-time purchase on CreatorPay",
          },
          isAdjustmentAllowed: true,
        },
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour to complete the purchase
      }]);

      const context = granted[0]?.context;
      if (!context) throw new Error("No permission context returned by wallet");

      // Hand the granted permission to the backend, which settles the purchase as
      // the session account and returns the signed download URL.
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          buyerAddress: address,
          permissionContext: context,
          grantedFrom: granted[0].from,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");

      setResult(data);
    } catch (err: any) {
      console.log(err);
      alert("Purchase failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    if (result.downloadUrl) {
      return (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-lg">
          <p className="font-semibold mb-2">Purchase Successful!</p>
          <a href={result.downloadUrl} className="underline" target="_blank" rel="noreferrer">
            Download your file here
          </a>
        </div>
      );
    }
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-lg">
        <p className="font-semibold">Purchase Successful!</p>
      </div>
    );
  }

  return (
    <Button
      onClick={handleBuy}
      disabled={loading || !isConnected}
      className="w-full sm:w-auto"
    >
      {loading
        ? "Processing Payment..."
        : !isConnected
          ? "Connect wallet to buy"
          : wrongNetwork
            ? `Switch to ${APP_CHAIN.name} & Buy`
            : "Buy Now"}
    </Button>
  );
}
