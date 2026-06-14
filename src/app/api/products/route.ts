import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getServiceSupabase, PRODUCT_BUCKET } from "@/lib/storage/supabase";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const walletAddress = formData.get("walletAddress") as string;
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const priceAmount = formData.get("priceAmount") as string;
    const periodDurationSeconds = formData.get("periodDurationSeconds") as string | null;
    const file = formData.get("file") as File | null;

    if (!walletAddress || !type || !title || !slug || !priceAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const creator = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
    }

    const productMetadata = {};

    // Upload the file FIRST so we never create a digital product without its asset.
    // Path keys on slug (unique per creator) since the product id doesn't exist yet.
    let storagePath: string | null = null;
    if (type === "digital_download" && file) {
      const supabase = getServiceSupabase();
      storagePath = `${creator.id}/${slug}/${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json({ error: "File upload failed" }, { status: 502 });
      }
    }

    // Create the product (+ asset if uploaded) only after the upload succeeded.
    const product = await prisma.product.create({
      data: {
        creatorId: creator.id,
        type: type as any,
        title,
        slug,
        description,
        priceAmount,
        priceTokenSymbol: "USDC",
        metadata: productMetadata,
        ...(storagePath && file
          ? { assets: { create: { storageUrl: storagePath, contentType: file.type } } }
          : {}),
      },
    });

    if (type === "subscription" && periodDurationSeconds) {
      await prisma.subscriptionPlan.create({
        data: {
          productId: product.id,
          periodAmount: priceAmount,
          periodTokenSymbol: "USDC",
          periodDurationSeconds: parseInt(periodDurationSeconds),
        },
      });
    }

    return NextResponse.json({ product });
  } catch (err: any) {
    console.error("Product creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
