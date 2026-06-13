import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { VENICE_BASE_URL } from "@/lib/config";

const COST_PER_MESSAGE = 10000n; // 0.01 USDC (assuming 6 decimals)

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages } = await req.json();

    if (!sessionId || !messages) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Load the AI Session
    const session = await prisma.aiSession.findUnique({
      where: { id: sessionId },
      include: { product: true },
    });

    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Invalid or inactive session" }, { status: 400 });
    }

    // 2. Check budget
    const budget = BigInt(session.budgetAmount);
    const spent = BigInt(session.spentAmount);

    if (spent + COST_PER_MESSAGE > budget) {
      // Mark session as exhausted
      await prisma.aiSession.update({
        where: { id: sessionId },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "Session budget exhausted" }, { status: 402 });
    }

    // 3. Call Venice AI
    // We get the API key from environment variables
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

    // 4. Deduct the cost from the budget
    const newSpent = spent + COST_PER_MESSAGE;
    await prisma.aiSession.update({
      where: { id: sessionId },
      data: {
        spentAmount: newSpent.toString(),
      }
    });

    // We can also record the invocation
    await prisma.aIInvocation.create({
      data: {
        buyerId: session.buyerId,
        productId: session.productId,
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
