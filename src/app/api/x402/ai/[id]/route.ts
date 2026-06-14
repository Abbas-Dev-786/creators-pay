import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer, HTTPAdapter, HTTPRequestContext } from "@x402/core/server";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
import { FACILITATOR_URL, X402_NETWORK } from "@/lib/config";
import { toX402Price } from "@/lib/money";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  X402_NETWORK,
  new x402ExactEvmErc7710ServerScheme()
);

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
    const { id: sessionId } = await params;
    
    const session = await prisma.aiSession.findUnique({
      where: { id: sessionId },
      include: { 
        product: { include: { creator: true } }
      },
    });

    if (!session || !session.product) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const payTo = session.product.creator.payoutAddress || session.product.creator.walletAddress;
    // For AI product, the priceAmount is the per-message cost
    const priceAmount = session.product.priceAmount;

    const httpServer = new x402HTTPResourceServer(resourceServer, {
      [`GET /api/x402/ai/${sessionId}`]: {
        accepts: [{
          scheme: "exact",
          network: X402_NETWORK,
          price: toX402Price(priceAmount),
          payTo: payTo,
          extra: { assetTransferMethod: "erc7710" },
        }],
        description: "AI microtransaction charge",
        mimeType: "application/json",
      }
    });

    const adapter = new NextHTTPAdapter(req);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader('payment-signature'),
      routePattern: `GET /api/x402/ai/${sessionId}`
    };

    const processResult = await httpServer.processHTTPRequest(context);

    if (processResult.type === "payment-error") {
      const { status, headers, body } = processResult.response;
      return NextResponse.json(body || { error: "Payment required" }, { status, headers });
    }

    if (processResult.type === "no-payment-required") {
       return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const { paymentPayload, paymentRequirements } = processResult;
    const settleResult = await httpServer.processSettlement(paymentPayload, paymentRequirements, undefined, { request: context });

    if (!settleResult.success) {
       const { status, headers, body } = settleResult.response;
       return NextResponse.json(body || { error: "Settlement failed" }, { status, headers });
    }
    
    const headers = new Headers(settleResult.headers as any);
    
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      transaction: settleResult.transaction,
      amount: priceAmount,
      message: "AI payment settled successfully",
    }, { headers });
  } catch (err: any) {
    console.error("x402 AI handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
