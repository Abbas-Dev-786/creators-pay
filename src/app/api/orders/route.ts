import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        buyer: { walletAddress: address.toLowerCase() },
        status: "succeeded"
      },
      include: {
        product: {
          include: { creator: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
