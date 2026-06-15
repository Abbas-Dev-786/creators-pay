"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";
import { formatAmount } from "@/lib/money";
import { USDC_ADDRESS } from "@/lib/config";

export default function BuyerOrders() {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: ethBalance } = useBalance({ address });
  const { data: usdcRawBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/orders?address=${address}`).then((res) => res.json()),
      fetch(`/api/subscriptions?address=${address}`).then((res) => res.json())
    ])
      .then(([ordersData, subsData]) => {
        if (ordersData.orders) setOrders(ordersData.orders);
        if (subsData.subscriptions) setSubscriptions(subsData.subscriptions);
      })
      .finally(() => setLoading(false));
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center py-20 border rounded-lg border-black/10 dark:border-white/10">
          <h2 className="text-xl font-bold mb-4">Connect to view your Dashboard</h2>
          <ConnectBar />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 border-b pb-6 border-black/10 dark:border-white/10 gap-4">
        <h2 className="text-3xl font-bold">Your Dashboard</h2>
        <div className="md:text-right bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold opacity-70 mb-2 uppercase tracking-wider">Wallet Balance</p>
          <div className="flex gap-6 items-center">
            <div>
              <p className="font-bold text-xl">{ethBalance ? `${Number(formatUnits(ethBalance.value, ethBalance.decimals)).toFixed(4)} ${ethBalance.symbol}` : "0 ETH"}</p>
            </div>
            <div className="w-px h-8 bg-black/10 dark:bg-white/10"></div>
            <div>
              <p className="font-bold text-xl">{usdcRawBalance !== undefined ? formatAmount(usdcRawBalance.toString(), "USDC") : "0 USDC"}</p>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4 mt-8">One-time Purchases</h3>
      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-black/10 dark:bg-white/10 rounded"></div>
              <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 border rounded-lg border-black/10 dark:border-white/10 opacity-70">
          You haven't bought anything yet.
        </div>
      ) : (
        <div className="grid gap-4 mb-12">
          {orders.map((order) => (
            <div key={order.id} className="p-4 border rounded-xl border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:border-black/20 dark:hover:border-white/20 transition-colors">
              <div>
                <h4 className="font-semibold text-lg">{order.product.title}</h4>
                <p className="text-sm opacity-70">by {order.product.creator.displayName}</p>
                <p className="text-xs opacity-50 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="sm:text-right">
                <p className="font-bold text-lg">{formatAmount(order.amount, order.tokenSymbol)}</p>
                <Link href={`/u/${order.product.creator.slug}/p/${order.product.slug}`} className="text-sm text-blue-500 hover:text-blue-600 underline">
                  View Product
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-xl font-bold mb-4 mt-8">Active Subscriptions</h3>
      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-black/10 dark:bg-white/10 rounded"></div>
              <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-10 border rounded-lg border-black/10 dark:border-white/10 opacity-70">
          No active subscriptions.
        </div>
      ) : (
        <div className="grid gap-4">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="p-4 border rounded-xl border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:border-black/20 dark:hover:border-white/20 transition-colors">
              <div>
                <h4 className="font-semibold text-lg">{sub.plan.product.title}</h4>
                <p className="text-sm opacity-70">by {sub.plan.product.creator.displayName}</p>
                <p className="text-xs opacity-50 mt-1">Next billing: {new Date(sub.nextBillingAt).toLocaleDateString()}</p>
              </div>
              <div className="sm:text-right flex flex-col sm:items-end">
                <p className="font-bold text-lg">
                  {formatAmount(sub.plan.periodAmount, sub.plan.periodTokenSymbol)} /{" "}
                  {sub.plan.periodDurationSeconds === 2592000 ? "month" : sub.plan.periodDurationSeconds === 86400 ? "day" : `${sub.plan.periodDurationSeconds}s`}
                </p>
                <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  sub.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  sub.status === 'past_due' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {sub.status.replace("_", " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
