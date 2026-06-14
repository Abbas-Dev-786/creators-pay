"use client";

import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";
import { formatAmount } from "@/lib/money";

export default function BuyerOrders() {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    fetch(`/api/orders?address=${address}`)
      .then(res => res.json())
      .then(data => {
        if (data.orders) setOrders(data.orders);
      })
      .finally(() => setLoading(false));
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center py-20 border rounded-lg border-black/10 dark:border-white/10">
          <h2 className="text-xl font-bold mb-4">Connect to view your Purchases</h2>
          <ConnectBar />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-bold mb-8">Your Purchases</h2>
      {loading ? (
        <div>Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 border rounded-lg border-black/10 dark:border-white/10 opacity-70">
          You haven't bought anything yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.id} className="p-4 border rounded-lg border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-semibold text-lg">{order.product.title}</h3>
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
    </div>
  );
}
