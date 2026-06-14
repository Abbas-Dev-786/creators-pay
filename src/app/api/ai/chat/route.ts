import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { VENICE_BASE_URL } from "@/lib/config";
import { privateKeyToAccount } from "viem/accounts";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { verifyMessage } from "viem";

const sessionAccount = privateKeyToAccount((process.env.SESSION_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages, buyerAddress, signature } = await req.json();

    if (!sessionId || !messages || !buyerAddress || !signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Load the AI Session
    const session = await prisma.aiSession.findUnique({
      where: { id: sessionId },
      include: { product: true, buyer: true },
    });

    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Invalid or inactive session" }, { status: 400 });
    }

    // 1.5 Verify Ownership
    if (session.buyer.walletAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized address" }, { status: 401 });
    }
    
    const ok = await verifyMessage({
      address: session.buyer.walletAddress as `0x${string}`,
      message: `CreatorPay AI session ${sessionId}`,
      signature,
    });
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized signature" }, { status: 401 });
    }

    // 2. Check budget
    const budget = BigInt(session.budgetAmount);
    const spent = BigInt(session.spentAmount);
    const COST_PER_MESSAGE = BigInt(session.product.priceAmount);

    if (spent + COST_PER_MESSAGE > budget) {
      await prisma.aiSession.update({
        where: { id: sessionId },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "Session budget exhausted" }, { status: 402 });
    }

    // 3. Settle Micropayment FIRST using session account delegation
    const erc7710Client = new x402Erc7710Client({
      delegationProvider: createx402DelegationProvider({
        account: sessionAccount,
        parentPermissionContext: session.permissionContext as `0x${string}`,
        from: (session.grantedFrom || session.sessionAccountAddress) as `0x${string}`,
      }),
    });

    const coreClient = new x402Client().register("eip155:*", erc7710Client);
    const httpClient = new x402HTTPClient(coreClient);
    const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

    let txHash: string;
    let paymentEventId: string | null = null;
    try {
      const payRes = await fetchWithPayment(`${BASE_URL}/api/x402/ai/${sessionId}`);
      if (!payRes.ok) {
        const txt = await payRes.text();
        throw new Error(txt || "Micropayment failed");
      }
      const payData = await payRes.json();
      txHash = payData.transaction;
      
      // Immediately increment spent amount and record the payment event
      await prisma.$transaction(async (tx) => {
        const newSpent = spent + COST_PER_MESSAGE;
        await tx.aiSession.update({
          where: { id: sessionId },
          data: { spentAmount: newSpent.toString() }
        });

        const pe = await tx.paymentEvent.create({
          data: {
            type: "ai_micro",
            amount: COST_PER_MESSAGE.toString(),
            tokenSymbol: session.tokenSymbol,
            facilitatorTxHash: txHash,
            status: "succeeded",
          }
        });
        paymentEventId = pe.id;
      });
    } catch (payErr: any) {
      console.error("Micropayment error:", payErr);
      return NextResponse.json({ error: "Micropayment failed: " + payErr.message }, { status: 402 });
    }

    // 4. Call Venice AI
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Venice API key not configured" }, { status: 500 });
    }

    const systemPrompt = "You are a helpful AI assistant provided by the creator.";
    
    const aiRes = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ]
      })
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("Venice API error:", errTxt);
      return NextResponse.json({ error: "AI service failed" }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices[0].message.content;

    // 5. Record the invocation
    await prisma.aIInvocation.create({
      data: {
        buyerId: session.buyerId,
        productId: session.productId,
        paymentEventId,
        prompt: messages[messages.length - 1].content,
        outputMetadata: aiData.usage || {},
      }
    });

    return NextResponse.json({ reply });

  } catch (err: any) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
