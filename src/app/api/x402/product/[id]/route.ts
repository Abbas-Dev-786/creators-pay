import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { FACILITATOR_URL, X402_NETWORK } from "@/lib/config";
import { createSignedDownloadUrl } from "@/lib/storage/supabase";

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
    
    // We construct the payment requirements object exactly as the facilitator expects
    const requirements: any = {
      scheme: "exact",
      network: X402_NETWORK,
      maxAmountRequired: product.priceAmount,
      payTo: payTo,
      asset: "", // default asset is usually fine, or specify token address if needed
      extra: { assetTransferMethod: "erc7710" },
    };

    const signatureStr = req.headers.get("payment-signature");

    if (!signatureStr) {
      // Return 402 with PAYMENT-REQUIRED header
      const headerValue = `exact; price="${product.priceAmount}"; network="${X402_NETWORK}"; payTo="${payTo}"; extra="{\\"assetTransferMethod\\":\\"erc7710\\"}"`;
      return NextResponse.json(
        { error: "Payment required" },
        {
          status: 402,
          headers: { "Payment-Required": headerValue },
        }
      );
    }

    // Parse the client's payment payload
    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(signatureStr));
    } catch {
      try {
        payload = JSON.parse(signatureStr);
      } catch {
        return NextResponse.json({ error: "Invalid payment signature format" }, { status: 400 });
      }
    }

    // Settle the payment via the MetaMask Facilitator
    const result = await facilitator.settle(payload, requirements);

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || "Settlement failed" },
        { status: 402 } // 402 is standard for failed payment
      );
    }

    // Payment Successful!
    // 1. Record the order and payment event in the database
    const order = await prisma.order.create({
      data: {
        buyerId: product.creatorId, // Note: In a real app we'd resolve the buyer by the `result.payer` address
        productId: product.id,
        amount: product.priceAmount,
        tokenSymbol: product.priceTokenSymbol,
        txHash: result.transaction,
        status: "succeeded",
        paymentEvents: {
          create: {
            type: "one_time",
            amount: product.priceAmount,
            tokenSymbol: product.priceTokenSymbol,
            facilitatorTxHash: result.transaction,
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

    return NextResponse.json({
      success: true,
      orderId: order.id,
      transaction: result.transaction,
      downloadUrl,
      message: "Payment settled successfully",
    });
  } catch (err: any) {
    console.error("x402 handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
