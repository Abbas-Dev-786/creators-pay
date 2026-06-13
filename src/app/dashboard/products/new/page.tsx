"use client";

import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";

export default function NewProduct() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [type, setType] = useState("digital_download");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [periodDurationDays, setPeriodDurationDays] = useState("30");
  
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Create FormData to upload file and metadata
      const formData = new FormData();
      formData.append("walletAddress", address || "");
      formData.append("type", type);
      formData.append("title", title);
      formData.append("slug", slug);
      formData.append("description", description);
      
      // We store price in base units. Assuming USDC (6 decimals).
      // Converting simple float to integer string:
      const priceBaseUnits = Math.floor(parseFloat(priceAmount) * 1e6).toString();
      formData.append("priceAmount", priceBaseUnits);

      if (type === "subscription") {
        formData.append("periodDurationSeconds", (parseInt(periodDurationDays) * 86400).toString());
      }

      if (type === "digital_download" && file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/products", {
        method: "POST",
        body: formData, // fetch will automatically set multipart/form-data
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create product");
      }

      router.push("/dashboard");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create New Product</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Product Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" value="digital_download" checked={type === "digital_download"} onChange={(e) => setType(e.target.value)} />
              Digital Download
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="subscription" checked={type === "subscription"} onChange={(e) => setType(e.target.value)} />
              Subscription
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="ai_service" checked={type === "ai_service"} onChange={(e) => setType(e.target.value)} />
              AI Service
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            required
            type="text"
            className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Advanced React Course"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Product Slug</label>
          <input
            required
            type="text"
            pattern="[a-zA-Z0-9-]+"
            className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="advanced-react-course"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20 min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will buyers get?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Price (USDC)</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              placeholder="5.00"
            />
          </div>
          {type === "subscription" && (
            <div>
              <label className="block text-sm font-medium mb-1">Billing Period (Days)</label>
              <input
                required
                type="number"
                min="1"
                className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
                value={periodDurationDays}
                onChange={(e) => setPeriodDurationDays(e.target.value)}
              />
            </div>
          )}
        </div>

        {type === "digital_download" && (
          <div>
            <label className="block text-sm font-medium mb-1">Upload File</label>
            <input
              required
              type="file"
              className="w-full border rounded-lg p-2 dark:bg-black dark:border-white/20"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
          </div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </div>
  );
}
