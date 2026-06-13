import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const creator = await prisma.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      include: {
        products: true,
      },
    });

    if (!creator) return NextResponse.json({ creator: null });

    // Calculate revenue
    const orders = await prisma.order.findMany({
      where: {
        product: { creatorId: creator.id },
        status: "succeeded",
      },
    });
    const totalRevenueUnits = orders.reduce((acc, order) => acc + BigInt(order.amount), 0n);

    // Calculate active subscribers
    const activeSubscribers = await prisma.subscription.count({
      where: {
        plan: { product: { creatorId: creator.id } },
        status: "active",
      },
    });

    return NextResponse.json({
      creator: {
        ...creator,
        totalRevenue: totalRevenueUnits.toString(),
        activeSubscribers,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, displayName, slug, payoutAddress } = body;

    if (!walletAddress || !displayName || !slug || !payoutAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const creator = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: {
        role: "both",
        displayName,
        slug,
        payoutAddress,
      },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        role: "both",
        displayName,
        slug,
        payoutAddress,
      },
    });

    return NextResponse.json({ creator });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
