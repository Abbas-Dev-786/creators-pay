"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { switchChain } from "wagmi/actions";
import { createWalletClient, custom } from "viem";
import { APP_CHAIN, USDC_ADDRESS } from "@/lib/config";
import { wagmiConfig } from "@/providers/AppProvider";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { assertMetaMaskProvider } from "@/lib/wallet";
import Button from "@/components/Button";

export function SubscriptionCheckoutButton({
  productId,
  periodAmount,
  periodDurationSeconds,
  creatorAddress
}: {
  productId: string;
  periodAmount: string;
  periodDurationSeconds: number;
  creatorAddress: string;
}) {
  const { address, isConnected, chainId, connector } = useAccount();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const wrongNetwork = isConnected && chainId !== APP_CHAIN.id;

  async function handleSubscribe() {
    if (!isConnected || !address || !connector) return alert("Please connect your wallet first.");

    setLoading(true);

    try {
      // Ensure the wallet is on the right network before requesting permissions.
      if (chainId !== APP_CHAIN.id) {
        await switchChain(wagmiConfig, { chainId: APP_CHAIN.id });
      }

      // Use the connected wallet's own provider (EIP-6963), not window.ethereum,
      // which another installed extension (e.g. Flow) may have taken over.
      const provider = await connector.getProvider();
      assertMetaMaskProvider(provider);

      const wallet7715 = createWalletClient({
        chain: APP_CHAIN,
        transport: custom(provider as any)
      }).extend(erc7715ProviderActions());

      const estimatedFee = 50000n; // 0.05 USDC in 6 decimals
      const workAmount = BigInt(periodAmount);
      const totalAmount = workAmount + estimatedFee;

      const granted = await wallet7715.requestExecutionPermissions([{
        chainId: APP_CHAIN.id,
        to: process.env.NEXT_PUBLIC_SESSION_ACCOUNT as `0x${string}`,
        permission: {
          type: "erc20-token-periodic",
          data: {
            tokenAddress: USDC_ADDRESS,
            periodAmount: totalAmount,
            periodDuration: periodDurationSeconds,
            justification: "Subscription payment + gas fee to CreatorPay",
          },
          isAdjustmentAllowed: true,
        },
        expiry: Math.floor(Date.now() / 1000) + 365 * 86400, // 1 year
      }]);

      const context = granted[0]?.context;
      if (!context) throw new Error("No permission context returned by wallet");

      // 3. Send the context to our backend to start the subscription
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          buyerAddress: address,
          permissionContext: context,
          grantedFrom: granted[0].from,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start subscription");
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert("Subscription failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-lg">
        <p className="font-semibold">Subscription Active!</p>
        <p className="text-sm opacity-80 mt-1">You will be billed automatically.</p>
      </div>
    );
  }

  return (
    <Button
      onClick={handleSubscribe}
      disabled={loading || !isConnected}
      className="w-full sm:w-auto"
    >
      {loading
        ? "Requesting Permissions..."
        : !isConnected
          ? "Connect wallet to subscribe"
          : wrongNetwork
            ? `Switch to ${APP_CHAIN.name} & Subscribe`
            : "Subscribe with Auto-Renew"}
    </Button>
  );
}
