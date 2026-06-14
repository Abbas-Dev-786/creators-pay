"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { APP_CHAIN, USDC_ADDRESS } from "@/lib/config";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
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
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubscribe() {
    if (!walletClient || !address) return alert("Connect wallet first");
    
    // Check if the wallet has window.ethereum
    if (typeof window === "undefined" || !window.ethereum) {
      return alert("MetaMask is required for subscriptions");
    }

    setLoading(true);

    try {
      const wallet7715 = createWalletClient({
        chain: APP_CHAIN,
        transport: custom(window.ethereum as any)
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
      {loading ? "Requesting Permissions..." : "Subscribe with Auto-Renew"}
    </Button>
  );
}
