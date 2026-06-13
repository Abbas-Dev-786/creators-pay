"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";
import { APP_CHAIN } from "@/lib/config";
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
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleBuy() {
    if (!walletClient || !publicClient) return alert("Connect wallet first");
    setLoading(true);
    setResult(null);

    try {
      // Initialize smart account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Stateless7702,
        address: walletClient.account.address,
        signer: walletClient as any,
      });

      // Setup x402 fetch client
      const erc7710Client = new x402Erc7710Client({
        delegationProvider: createx402DelegationProvider({
          account: smartAccount as any,
        }),
      });

      const coreClient = new x402Client().register("eip155:*", erc7710Client);
      const httpClient = new x402HTTPClient(coreClient);
      const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

      // Trigger the purchase flow
      const res = await fetchWithPayment(`/api/x402/product/${productId}`);
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
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
      {loading ? "Processing Payment..." : "Buy Now"}
    </Button>
  );
}
