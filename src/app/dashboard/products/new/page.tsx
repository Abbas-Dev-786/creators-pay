"use client";

import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="max-w-2xl mx-auto animate-in fade-in-50 duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Product</CardTitle>
          <CardDescription>
            Add a new digital asset, subscription tier, or AI service to your storefront.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <Label>Product Type</Label>
              <RadioGroup 
                value={type} 
                onValueChange={setType} 
                className="flex flex-col sm:flex-row gap-4 pt-2"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-4 flex-1">
                  <RadioGroupItem value="digital_download" id="digital_download" />
                  <Label htmlFor="digital_download" className="cursor-pointer">Digital Download</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-4 flex-1">
                  <RadioGroupItem value="subscription" id="subscription" />
                  <Label htmlFor="subscription" className="cursor-pointer">Subscription</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-4 flex-1">
                  <RadioGroupItem value="ai_service" id="ai_service" />
                  <Label htmlFor="ai_service" className="cursor-pointer">AI Service</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Advanced React Course"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Product Slug</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-muted-foreground text-sm">
                  /p/
                </span>
                <Input
                  id="slug"
                  required
                  type="text"
                  pattern="[a-zA-Z0-9-]+"
                  className="rounded-l-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="advanced-react-course"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will buyers get?"
                className="min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="priceAmount">Price (USDC)</Label>
                <Input
                  id="priceAmount"
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="5.00"
                />
              </div>
              {type === "subscription" && (
                <div className="space-y-2">
                  <Label htmlFor="periodDurationDays">Billing Period (Days)</Label>
                  <Input
                    id="periodDurationDays"
                    required
                    type="number"
                    min="1"
                    value={periodDurationDays}
                    onChange={(e) => setPeriodDurationDays(e.target.value)}
                  />
                </div>
              )}
            </div>

            {type === "digital_download" && (
              <div className="space-y-2">
                <Label htmlFor="file">Upload File</Label>
                <Input
                  id="file"
                  required
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }}
                  className="cursor-pointer"
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/50 pt-6">
            <Button type="submit" className="w-full sm:w-auto ml-auto" disabled={saving}>
              {saving ? "Creating..." : "Create Product"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
