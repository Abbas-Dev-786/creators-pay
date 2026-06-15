import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { x402HTTPResourceServer, HTTPAdapter, HTTPRequestContext } from "@x402/core/server";
import { X402_NETWORK } from "@/lib/config";
import { getResourceServer, paymentErrorReason } from "@/lib/x402/server";
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
    const { id: subscriptionId } = await params;
    
    // We are processing a subscription charge. The ID is the subscription ID.
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { 
        plan: { include: { product: { include: { creator: true } } } }
      },
    });

    if (!subscription || !subscription.plan || !subscription.plan.product) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const payTo = subscription.plan.product.creator.payoutAddress || subscription.plan.product.creator.walletAddress;

    const resourceServer = await getResourceServer();
    const httpServer = new x402HTTPResourceServer(resourceServer, {
      [`GET /api/x402/subscription/${subscriptionId}`]: {
        accepts: [{
          scheme: "exact",
          network: X402_NETWORK,
          price: toX402Price(subscription.plan.periodAmount),
          payTo: payTo,
          extra: { assetTransferMethod: "erc7710" },
        }],
        description: "Recurring subscription charge",
        mimeType: "application/json",
      }
    });

    const adapter = new NextHTTPAdapter(req);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader('payment-signature'),
      routePattern: `GET /api/x402/subscription/${subscriptionId}`
    };

    const processResult = await httpServer.processHTTPRequest(context);

    if (processResult.type === "payment-error") {
      const { status, headers } = processResult.response;
      // Real reason lives in the PAYMENT-REQUIRED header, not the `{}` body.
      const reason = paymentErrorReason(processResult.response);
      if (reason) console.error("x402 subscription payment rejected:", reason);
      return NextResponse.json(
        { error: reason || "Payment required", message: reason },
        { status, headers }
      );
    }

    if (processResult.type === "no-payment-required") {
       return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    // payment-verified: we have the payload and requirements. Now settle it.
    const { paymentPayload, paymentRequirements } = processResult;
    const settleResult = await httpServer.processSettlement(paymentPayload, paymentRequirements, undefined, { request: context });

    if (!settleResult.success) {
       const { status, headers } = settleResult.response;
       // The library defaults the 402 settlement-failure body to `{}`; surface the
       // real on-chain reason (e.g. insufficient_funds) so the cron sees why it failed.
       console.error("x402 subscription settlement failed:", settleResult.errorReason, settleResult.errorMessage);
       return NextResponse.json(
         { error: settleResult.errorReason || "Settlement failed", message: settleResult.errorMessage },
         { status, headers }
       );
    }

    // Payment Successful! The cron job will record the PaymentEvent and update the subscription.
    // We just return success and the txHash.
    
    const headers = new Headers(settleResult.headers as any);
    
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      transaction: settleResult.transaction,
      message: "Subscription payment settled successfully",
    }, { headers });
  } catch (err: any) {
    console.error("x402 subscription handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
