import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { x402HTTPResourceServer, HTTPAdapter, HTTPRequestContext } from "@x402/core/server";
import { X402_NETWORK } from "@/lib/config";
import { getResourceServer } from "@/lib/x402/server";
import { createSignedDownloadUrl } from "@/lib/storage/supabase";
import { toX402Price } from "@/lib/money";

class NextHTTPAdapter implements HTTPAdapter {
  constructor(private req: NextRequest) {}
  getHeader(name: string) { return this.req.headers.get(name) || undefined; }
  getMethod() { return this.req.method; }
  getPath() { return this.req.nextUrl.pathname; }
  getUrl() { return this.req.url; }
  getAcceptHeader() { return this.req.headers.get('accept') || '*/*'; }
  getUserAgent() { return this.req.headers.get('user-agent') || ''; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { creator: true, assets: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const payTo = product.creator.payoutAddress || product.creator.walletAddress;

    const resourceServer = await getResourceServer();
    const httpServer = new x402HTTPResourceServer(resourceServer, {
      [`GET /api/x402/product/${id}`]: {
        accepts: [{
          scheme: "exact",
          network: X402_NETWORK,
          price: toX402Price(product.priceAmount),
          payTo: payTo,
          extra: { assetTransferMethod: "erc7710" },
        }],
        description: "Paid digital download",
        mimeType: "application/json",
      }
    });

    const adapter = new NextHTTPAdapter(req);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader('payment-signature'),
      routePattern: `GET /api/x402/product/${id}`
    };

    const processResult = await httpServer.processHTTPRequest(context);

    if (processResult.type === "payment-error") {
      const { status, headers, body } = processResult.response;
      return NextResponse.json(body || { error: "Payment required" }, { status, headers });
    }

    if (processResult.type === "no-payment-required") {
       // Should not happen as we configured the route to require payment
       return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    // payment-verified: we have the payload and requirements. Now settle it.
    const { paymentPayload, paymentRequirements } = processResult;
    const settleResult = await httpServer.processSettlement(paymentPayload, paymentRequirements, undefined, { request: context });

    if (!settleResult.success) {
       const { status, headers, body } = settleResult.response;
       return NextResponse.json(body || { error: "Settlement failed" }, { status, headers });
    }

    // Payment Successful!
    // 1. Record the order and payment event in the database
    // resolve buyer from result.payer (not creatorId)
    const buyerAddress = (settleResult.payer || "unknown").toLowerCase();
    
    // Attempt to find buyer by address, or just fallback (here we'll just link if we can, or store address in txHash for now if not user).
    // Let's find user or use creatorId as fallback per task.md (actually task says "resolve buyer from result.payer (not creatorId)")
    let buyer = await prisma.user.findUnique({ where: { walletAddress: buyerAddress } });
    if (!buyer) {
      // Create shadow user if they don't exist
      buyer = await prisma.user.create({
        data: { walletAddress: buyerAddress, role: "buyer" }
      });
    }

    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        amount: product.priceAmount,
        tokenSymbol: product.priceTokenSymbol,
        txHash: settleResult.transaction,
        status: "succeeded",
        paymentEvents: {
          create: {
            type: "one_time",
            amount: product.priceAmount,
            tokenSymbol: product.priceTokenSymbol,
            facilitatorTxHash: settleResult.transaction,
            status: "succeeded",
          }
        }
      }
    });

    // 2. Generate secure download URL if it's a digital download
    let downloadUrl = null;
    if (product.type === "digital_download" && product.assets.length > 0) {
      const asset = product.assets[0];
      downloadUrl = await createSignedDownloadUrl(asset.storageUrl);
    }

    const headers = new Headers(settleResult.headers as any);
    
    return NextResponse.json({
      success: true,
      orderId: order.id,
      transaction: settleResult.transaction,
      downloadUrl,
      message: "Payment settled successfully",
    }, { headers });
  } catch (err: any) {
    console.error("x402 handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
