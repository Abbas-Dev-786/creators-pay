"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { APP_CHAIN, RELAYER_URL, USDC_ADDRESS } from "@/lib/config";
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
      // 1. Get Relayer Capabilities to find the target address
      const rpcReq = await fetch(RELAYER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "relayer_getCapabilities",
          params: [String(APP_CHAIN.id)]
        })
      });
      const rpcRes = await rpcReq.json();
      if (rpcRes.error) throw new Error(rpcRes.error.message);
      
      const caps = rpcRes.result[String(APP_CHAIN.id)];
      const targetAddress = caps.targetAddress;

      // 2. Request ERC-7715 Permissions from the wallet
      const wallet7715 = createWalletClient({
        chain: APP_CHAIN,
        transport: custom(window.ethereum as any)
      }).extend(erc7715ProviderActions());

      // Let's ask for the exact budget amount plus a bit for relayer fees
      const estimatedFee = 50000n; // 0.05 USDC buffer
      const totalAmount = BigInt(budgetAmount) + estimatedFee;

      const granted = await wallet7715.requestExecutionPermissions([{
        chainId: APP_CHAIN.id,
        to: targetAddress,
        permission: {
          type: "erc20-token-transfer",
          data: {
            tokenAddress: USDC_ADDRESS,
            maxAmount: totalAmount.toString(),
            justification: "Authorize AI Chat Session Budget",
          },
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
