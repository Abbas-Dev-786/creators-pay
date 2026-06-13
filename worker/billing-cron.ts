import { PrismaClient } from "@prisma/client";
import { decodeDelegations } from "@metamask/smart-accounts-kit/utils";
import { encodeFunctionData, erc20Abi } from "viem";

// We use relative paths for the cron script as it runs via tsx
import { RELAYER_URL, APP_CHAIN, USDC_ADDRESS } from "../src/lib/config";

const prisma = new PrismaClient();

const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/api/webhooks/1shot";

/** Convert delegation bigints / Uint8Arrays into JSON-safe shapes. */
function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return Array.from(value).map(v => v.toString(16).padStart(2, '0')).join(''); // fallback bytesToHex
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v);
    return out;
  }
  return value;
}

export async function processSubscriptions() {
  console.log("Starting Subscription Billing Cron...");
  
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      nextBillingAt: { lte: new Date() }
    },
    include: {
      plan: { include: { product: { include: { creator: true } } } },
    }
  });

  if (dueSubscriptions.length === 0) {
    console.log("No subscriptions due for billing.");
    return;
  }

  // Get Capabilities
  const rpcReq = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "relayer_getCapabilities", params: [String(APP_CHAIN.id)]
    })
  });
  const caps = (await rpcReq.json()).result[String(APP_CHAIN.id)];

  for (const sub of dueSubscriptions) {
    try {
      console.log(`Processing Subscription ${sub.id}`);
      const decodedDelegations = decodeDelegations(sub.permissionContext).map(toRelayerJson);
      
      const workAmount = BigInt(sub.plan.periodAmount);
      // We start with a mock fee of 0.01 USDC to get a valid estimation
      const mockFeeAmount = 10000n; 
      
      const creatorAddress = sub.plan.product.creator.payoutAddress || sub.plan.product.creator.walletAddress;

      const getBundle = (feeAmount: bigint) => ({
        chainId: String(APP_CHAIN.id),
        transactions: [
          {
            permissionContext: decodedDelegations,
            executions: [
              {
                target: USDC_ADDRESS,
                value: "0",
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [caps.feeCollector, feeAmount],
                })
              },
              {
                target: USDC_ADDRESS,
                value: "0",
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [creatorAddress as `0x${string}`, workAmount],
                })
              }
            ]
          }
        ]
      });

      // 1. Estimate
      let sendParams = getBundle(mockFeeAmount);
      const estReq = await fetch(RELAYER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "relayer_estimate7710Transaction", params: [sendParams] })
      });
      let estimate = (await estReq.json()).result;

      if (!estimate.success) {
        throw new Error("Estimate failed: " + estimate.error);
      }

      // 2. Adjust fee if needed
      const requiredFee = BigInt(estimate.requiredPaymentAmount);
      if (requiredFee !== mockFeeAmount) {
        sendParams = getBundle(requiredFee);
        const estReq2 = await fetch(RELAYER_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "relayer_estimate7710Transaction", params: [sendParams] })
        });
        estimate = (await estReq2.json()).result;
        if (!estimate.success) throw new Error("Re-estimate failed: " + estimate.error);
      }

      // 3. Send
      const sendReq = await fetch(RELAYER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "relayer_send7710Transaction", params: [{
            ...sendParams,
            context: estimate.context,
            destinationUrl: WEBHOOK_URL,
            memo: `sub-${sub.id}`
          }]
        })
      });

      const sendRes = await sendReq.json();
      if (sendRes.error) throw new Error("Send failed: " + sendRes.error.message);

      console.log(`Successfully dispatched bill for ${sub.id}, taskId: ${sendRes.result}`);

    } catch (err: any) {
      console.error(`Failed to process subscription ${sub.id}:`, err);
    }
  }

  // Process AI Sessions
  console.log("Processing AI Sessions...");
  const activeAiSessions = await prisma.aiSession.findMany({
    where: { status: "active" },
    include: { product: { include: { creator: true } } }
  });

  for (const session of activeAiSessions) {
    try {
      const spent = BigInt(session.spentAmount);
      if (spent === 0n) continue;

      console.log(`Settling AI Session ${session.id} for amount ${spent}`);
      const decodedDelegations = decodeDelegations(session.permissionContext).map(toRelayerJson);
      
      const mockFeeAmount = 10000n;
      const creatorAddress = session.product.creator.payoutAddress || session.product.creator.walletAddress;

      const getBundle = (feeAmount: bigint) => ({
        chainId: String(APP_CHAIN.id),
        transactions: [
          {
            permissionContext: decodedDelegations,
            executions: [
              {
                target: USDC_ADDRESS,
                value: "0",
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [caps.feeCollector, feeAmount],
                })
              },
              {
                target: USDC_ADDRESS,
                value: "0",
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [creatorAddress as `0x${string}`, spent],
                })
              }
            ]
          }
        ]
      });

      // 1. Estimate
      let sendParams = getBundle(mockFeeAmount);
      const estReq = await fetch(RELAYER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "relayer_estimate7710Transaction", params: [sendParams] })
      });
      let estimate = (await estReq.json()).result;

      if (!estimate.success) throw new Error("Estimate failed: " + estimate.error);

      // 2. Adjust fee if needed
      const requiredFee = BigInt(estimate.requiredPaymentAmount);
      if (requiredFee !== mockFeeAmount) {
        sendParams = getBundle(requiredFee);
        const estReq2 = await fetch(RELAYER_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "relayer_estimate7710Transaction", params: [sendParams] })
        });
        estimate = (await estReq2.json()).result;
        if (!estimate.success) throw new Error("Re-estimate failed: " + estimate.error);
      }

      // 3. Send
      const sendReq = await fetch(RELAYER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "relayer_send7710Transaction", params: [{
            ...sendParams,
            context: estimate.context,
            destinationUrl: WEBHOOK_URL,
            memo: `ai-${session.id}`
          }]
        })
      });

      const sendRes = await sendReq.json();
      if (sendRes.error) throw new Error("Send failed: " + sendRes.error.message);

      console.log(`Successfully dispatched settlement for AI session ${session.id}, taskId: ${sendRes.result}`);

      // Reset spent amount to 0 after settlement
      await prisma.aiSession.update({
        where: { id: session.id },
        data: { spentAmount: "0" }
      });

    } catch (err: any) {
      console.error(`Failed to process AI session ${session.id}:`, err);
    }
  }

  console.log("Cron run complete.");
}

// Run immediately if executed directly
if (require.main === module) {
  processSubscriptions().then(() => process.exit(0));
}
