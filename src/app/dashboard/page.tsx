"use client";

import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import Button from "@/components/Button";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";
import { formatAmount } from "@/lib/money";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    fetch(`/api/creators?address=${address}`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.creator) {
          setProfile(data.creator);
        } else {
          setPayoutAddress(address); // default payout address
        }
      })
      .finally(() => setLoading(false));
  }, [address, isConnected]);

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          displayName,
          slug,
          payoutAddress,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to create profile");
      }
      const data = await res.json();
      setProfile(data.creator);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (!isConnected) {
    return (
      <div className="text-center py-20 border rounded-lg border-black/10 dark:border-white/10">
        <h2 className="text-xl font-bold mb-4">Connect to view Dashboard</h2>
        <ConnectBar />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6">Setup Creator Profile</h2>
        <form onSubmit={handleCreateProfile} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Display Name</label>
            <input
              required
              type="text"
              className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Satoshi Nakamoto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug (URL)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 rounded-l-lg bg-gray-50 dark:bg-white/5 dark:border-white/20 text-sm">
                /u/
              </span>
              <input
                required
                type="text"
                pattern="[a-zA-Z0-9-]+"
                title="Only letters, numbers, and hyphens"
                className="flex-1 border rounded-r-lg p-2 dark:bg-black dark:border-white/20"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="satoshi"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payout Address</label>
            <input
              required
              type="text"
              className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20 font-mono text-sm"
              value={payoutAddress}
              onChange={(e) => setPayoutAddress(e.target.value)}
            />
            <p className="text-xs opacity-70 mt-1">This is where your x402 payments will be sent.</p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Profile"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-8">Welcome back, {profile.displayName}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="p-6 border rounded-lg border-black/10 dark:border-white/10">
          <h3 className="text-sm font-medium opacity-70 mb-1">Total Revenue</h3>
          <p className="text-3xl font-bold">{formatAmount(profile.totalRevenue || "0", "USDC")}</p>
        </div>
        <div className="p-6 border rounded-lg border-black/10 dark:border-white/10">
          <h3 className="text-sm font-medium opacity-70 mb-1">Active Subscribers</h3>
          <p className="text-3xl font-bold">{profile.activeSubscribers || 0}</p>
        </div>
        <div className="p-6 border rounded-lg border-black/10 dark:border-white/10">
          <h3 className="text-sm font-medium opacity-70 mb-1">Products</h3>
          <p className="text-3xl font-bold">{profile.products?.length || 0}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Your Products</h3>
        <Link href="/dashboard/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      {(!profile.products || profile.products.length === 0) ? (
        <div className="text-center py-20 border rounded-lg border-black/10 dark:border-white/10 opacity-70">
          You haven't created any products yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.products.map((p: any) => (
            <div key={p.id} className="p-4 border rounded-lg border-black/10 dark:border-white/10">
              <h4 className="font-semibold">{p.title}</h4>
              <p className="text-sm opacity-70 mb-2">{p.type.replace('_', ' ')}</p>
              <div className="flex gap-2">
                <Link href={`/u/${profile.slug}/p/${p.slug}`} className="text-sm underline text-blue-500 hover:text-blue-600">
                  View Page
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
