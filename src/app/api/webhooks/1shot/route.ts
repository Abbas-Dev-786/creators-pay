import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import * as ed from "@noble/ed25519";
import crypto from "crypto";
import stringify from "safe-stable-stringify";
import { RELAYER_JWKS_URL } from "@/lib/config";

// Setup sha512 for ed25519 verification
ed.hashes.sha512 = (m: Uint8Array) =>
  new Uint8Array(crypto.createHash("sha512").update(Buffer.from(m)).digest());

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

let jwksCache: { fetchedAt: number; keys: Map<string, Uint8Array> } | null = null;
const JWKS_TTL_MS = 10 * 60_000;

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function getJwks(force = false): Promise<Map<string, Uint8Array>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(RELAYER_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as Jwks;
  const map = new Map<string, Uint8Array>();
  for (const k of keys) {
    if (k.kty === "OKP" && k.crv === "Ed25519") map.set(k.kid, base64urlToBytes(k.x));
  }
  jwksCache = { fetchedAt: Date.now(), keys: map };
  return map;
}

export async function verifyRelayerWebhook(body: Record<string, unknown>): Promise<boolean> {
  const sigB64 = body.signature as string | undefined;
  const keyId = body.keyId as string | undefined;
  if (!sigB64 || !keyId) return false;

  let keys = await getJwks();
  let pub = keys.get(keyId);
  if (!pub) {
    keys = await getJwks(true); // force refresh on miss (key rotation)
    pub = keys.get(keyId);
    if (!pub) return false;
  }

  const { signature: _omit, ...rest } = body; // canonicalize without signature
  const message = new TextEncoder().encode(stringify(rest) as string);
  const sig = new Uint8Array(Buffer.from(sigB64, "base64"));
  return ed.verify(sig, message, pub);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // 1. Verify Signature
    const ok = await verifyRelayerWebhook(body);
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Process the event payload
    const data = body.data as {
      id: string;
      status: number;
      memo?: string;
      hash?: string;
    };

    console.log("1Shot Webhook Event:", body.type, "TaskId:", data.id, "Status:", data.status);

    // Only process terminal states (200 Success or 500 Reverted)
    if (data.status === 200 || data.status === 500) {
      // The memo field contains our internal Subscription ID (or Order ID)
      if (data.memo?.startsWith("sub-")) {
        const subscriptionId = data.memo.replace("sub-", "");
        
        // Find the subscription to mark the billing as complete or failed
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: { plan: true },
        });

        if (subscription) {
          if (data.status === 200) {
            // Update the next billing date
            const newNextBilling = new Date(
              Date.now() + subscription.plan.periodDurationSeconds * 1000
            );

            await prisma.subscription.update({
              where: { id: subscriptionId },
              data: {
                status: "active",
                nextBillingAt: newNextBilling,
              },
            });
            
            // Record payment event
            await prisma.paymentEvent.create({
              data: {
                orderId: subscription.orderId,
                type: "subscription_renewal",
                amount: subscription.plan.periodAmount,
                tokenSymbol: subscription.plan.periodTokenSymbol,
                facilitatorTxHash: data.hash, // from 1Shot
                status: "succeeded",
              }
            });
            
          } else if (data.status === 500) {
            // Handle failure
            await prisma.subscription.update({
              where: { id: subscriptionId },
              data: {
                status: "past_due",
              },
            });
            // Record failed payment event
            await prisma.paymentEvent.create({
              data: {
                orderId: subscription.orderId,
                type: "subscription_renewal",
                amount: subscription.plan.periodAmount,
                tokenSymbol: subscription.plan.periodTokenSymbol,
                facilitatorTxHash: data.hash,
                status: "failed",
              }
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
