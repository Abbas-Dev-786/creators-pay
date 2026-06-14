"use client";

import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";
import { formatAmount } from "@/lib/money";

// shadcn UI imports
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, Package, Plus, ExternalLink, PackageOpen, Wallet } from "lucide-react";

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

  // 1. Loading State with Skeletons
  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in-50 duration-500">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Disconnected State
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
        <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <Wallet className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Connect to your Seller Hub</h2>
        <p className="text-muted-foreground max-w-[400px]">
          Connect your Web3 wallet to manage your products, track revenue, and view your subscribers.
        </p>
        <div className="pt-4">
          <ConnectBar />
        </div>
      </div>
    );
  }

  // 3. Setup Profile State
  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Setup your Creator Profile</CardTitle>
            <CardDescription>
              Create your public storefront to start selling digital products, subscriptions, and AI services.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateProfile}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  required
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Satoshi Nakamoto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Storefront URL Slug</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-muted-foreground text-sm">
                    creatorpay.com/u/
                  </span>
                  <Input
                    id="slug"
                    required
                    type="text"
                    pattern="[a-zA-Z0-9-]+"
                    title="Only letters, numbers, and hyphens"
                    className="rounded-l-none"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="satoshi"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutAddress">Payout Address</Label>
                <Input
                  id="payoutAddress"
                  required
                  type="text"
                  className="font-mono text-sm"
                  value={payoutAddress}
                  onChange={(e) => setPayoutAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your earnings (USDC payments) will be settled to this address automatically via x402.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating Profile..." : "Launch Storefront"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // 4. Main Dashboard State
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {profile.displayName}</h2>
        <p className="text-muted-foreground">
          Here's what's happening in your Seller Dashboard today.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatAmount(profile.totalRevenue || "0", "USDC")}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile.activeSubscribers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Current active plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile.products?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Items in your store</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Your Products</h3>
            <p className="text-sm text-muted-foreground">Manage and view your storefront items.</p>
          </div>
          <Link href="/dashboard/products/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          </Link>
        </div>

        {(!profile.products || profile.products.length === 0) ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
            <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <PackageOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No products yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              You haven't added any digital downloads, subscriptions, or AI services to your store.
            </p>
            <Link href="/dashboard/products/new">
              <Button variant="secondary" className="gap-2">
                <Plus className="h-4 w-4" />
                Create your first product
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.products.map((p: any) => (
              <Card key={p.id} className="flex flex-col transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg mb-1 line-clamp-1">{p.title}</CardTitle>
                      <CardDescription className="capitalize">
                        {p.type.replace('_', ' ')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-xl font-semibold">
                    {formatAmount(p.priceAmount, p.priceTokenSymbol)} {p.priceTokenSymbol}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t">
                  <Link href={`/u/${profile.slug}/p/${p.slug}`} className="w-full">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View Store Page
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
