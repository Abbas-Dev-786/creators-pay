import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const { productId, buyerAddress, permissionContext } = await req.json();

    if (!productId || !buyerAddress || !permissionContext) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { plan: true },
    });

    if (!product || product.type !== "subscription" || !product.plan) {
      return NextResponse.json({ error: "Invalid product for subscription" }, { status: 400 });
    }

    // Ensure the buyer has a user record
    let buyer = await prisma.user.findUnique({
      where: { walletAddress: buyerAddress.toLowerCase() },
    });

    if (!buyer) {
      buyer = await prisma.user.create({
        data: {
          walletAddress: buyerAddress.toLowerCase(),
        },
      });
    }

    // Create a new order first to link the subscription to
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        amount: product.plan.periodAmount,
        tokenSymbol: product.plan.periodTokenSymbol,
        status: "pending",
      },
    });

    // Create the active subscription record
    // We set nextBillingAt to now, meaning the cron job will process the first charge immediately
    const subscription = await prisma.subscription.create({
      data: {
        buyerId: buyer.id,
        planId: product.plan.id,
        permissionContext: permissionContext,
        sessionAccountAddress: buyerAddress.toLowerCase(), // In production, this would be a dedicated session key
        status: "active",
        nextBillingAt: new Date(),
        expiry: new Date(Date.now() + 365 * 86400 * 1000), // 1 year expiry
      },
    });

    return NextResponse.json({ success: true, subscriptionId: subscription.id });
  } catch (err: any) {
    console.error("Subscription creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
