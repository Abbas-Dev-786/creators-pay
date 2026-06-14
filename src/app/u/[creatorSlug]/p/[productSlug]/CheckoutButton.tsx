"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { getWalletClient, getPublicClient, switchChain } from "wagmi/actions";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";
import { APP_CHAIN } from "@/lib/config";
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
  const { isConnected, chainId } = useAccount();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const wrongNetwork = isConnected && chainId !== APP_CHAIN.id;

  async function handleBuy() {
    if (!isConnected) return alert("Please connect your wallet first.");
    setLoading(true);
    setResult(null);

    try {
      // Make sure the wallet is on the right chain BEFORE we ask for a client.
      // (A connected wallet on the wrong network is the usual cause of the
      // misleading "connect wallet" error — useWalletClient returns undefined
      // for an unconfigured chain even though the account is connected.)
      if (chainId !== APP_CHAIN.id) {
        await switchChain(wagmiConfig, { chainId: APP_CHAIN.id });
      }

      // Fetch fresh clients AFTER the switch so we never read a stale value.
      const walletClient = await getWalletClient(wagmiConfig, { chainId: APP_CHAIN.id });
      const publicClient = getPublicClient(wagmiConfig, { chainId: APP_CHAIN.id });
      if (!walletClient || !publicClient) {
        throw new Error("Could not reach your wallet. Make sure MetaMask is unlocked.");
      }

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
