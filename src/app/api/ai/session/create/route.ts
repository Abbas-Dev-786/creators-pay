import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const { productId, buyerAddress, permissionContext, budgetAmount } = await req.json();

    if (!productId || !buyerAddress || !permissionContext || !budgetAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.type !== "ai_service") {
      return NextResponse.json({ error: "Invalid product for AI session" }, { status: 400 });
    }

    let buyer = await prisma.user.findUnique({
      where: { walletAddress: buyerAddress.toLowerCase() },
    });

    if (!buyer) {
      buyer = await prisma.user.create({
        data: { walletAddress: buyerAddress.toLowerCase() },
      });
    }

    // Create the AI Session record
    const aiSession = await prisma.aiSession.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        permissionContext,
        sessionAccountAddress: buyerAddress.toLowerCase(),
        budgetAmount: budgetAmount,
        status: "active",
      },
    });

    return NextResponse.json({ success: true, sessionId: aiSession.id });
  } catch (err: any) {
    console.error("AI session creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
