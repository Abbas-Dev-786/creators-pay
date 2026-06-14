"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { APP_CHAIN, USDC_ADDRESS } from "@/lib/config";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";

export function AiCheckoutButton({ 
  productId,
  budgetAmount, // The amount of budget to authorize
  creatorAddress
}: { 
  productId: string;
  budgetAmount: string;
  creatorAddress: string;
}) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStartSession() {
    if (!walletClient || !address) return alert("Connect wallet first");
    if (typeof window === "undefined" || !window.ethereum) {
      return alert("MetaMask is required to authorize AI Sessions");
    }

    setLoading(true);

    try {
      const wallet7715 = createWalletClient({
        chain: APP_CHAIN,
        transport: custom(window.ethereum as any)
      }).extend(erc7715ProviderActions());

      const estimatedFee = 50000n; // 0.05 USDC buffer
      const totalAmount = BigInt(budgetAmount) + estimatedFee;

      const granted = await wallet7715.requestExecutionPermissions([{
        chainId: APP_CHAIN.id,
        to: process.env.NEXT_PUBLIC_SESSION_ACCOUNT as `0x${string}`,
        permission: {
          type: "erc20-token-periodic",
          data: {
            tokenAddress: USDC_ADDRESS,
            periodAmount: totalAmount,
            periodDuration: 86400,
            justification: "Authorize AI Chat Session Budget",
          },
          isAdjustmentAllowed: true,
        },
        expiry: Math.floor(Date.now() / 1000) + 86400, // 1 day expiry for session
      }]);

      const context = granted[0]?.context;
      if (!context) throw new Error("No permission context returned by wallet");

      // 3. Create the AI Session on the backend
      const res = await fetch("/api/ai/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          buyerAddress: address,
          permissionContext: context,
          budgetAmount,
          grantedFrom: granted[0].from,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start AI session");
      }

      const { sessionId } = await res.json();
      
      // Redirect to the chat page
      const currentPath = window.location.pathname;
      router.push(`${currentPath}/chat?sessionId=${sessionId}`);

    } catch (err: any) {
      console.error(err);
      alert("Failed to start session: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button 
      onClick={handleStartSession} 
      disabled={loading || !isConnected}
      className="w-full sm:w-auto"
    >
      {loading ? "Authorizing Session..." : "Start AI Chat Session"}
    </Button>
  );
}
