import { PrismaClient } from "@prisma/client";
import { privateKeyToAccount } from "viem/accounts";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";

const prisma = new PrismaClient();
const sessionAccount = privateKeyToAccount((process.env.SESSION_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`);
const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("NEXT_PUBLIC_APP_URL must be set in production"); })()
    : "http://localhost:3000");

export async function processSubscriptions() {
  console.log("Starting Subscription Billing Cron...");
  
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      nextBillingAt: { lte: new Date() }
    },
    include: {
      plan: true
    }
  });

  if (dueSubscriptions.length === 0) {
    console.log("No subscriptions due for billing.");
    return;
  }

  for (const sub of dueSubscriptions) {
    try {
      console.log(`Processing Subscription ${sub.id}`);

      // Authoritative period to bill — advanced only on confirmed success.
      const periodIndex = sub.currentPeriodIndex;

      const pe = await prisma.paymentEvent.upsert({
        where: {
          subscriptionId_periodIndex: {
            subscriptionId: sub.id,
            periodIndex,
          }
        },
        update: {},
        create: {
          subscriptionId: sub.id,
          periodIndex,
          type: "recurring",
          amount: sub.plan.periodAmount,
          tokenSymbol: sub.plan.periodTokenSymbol,
          status: "pending",
        }
      });

      // Crash recovery: this period already settled on a prior run but the counter
      // wasn't advanced. Don't re-charge — just advance and move on.
      if (pe.status === "succeeded") {
        console.log(`Period ${periodIndex} already succeeded for sub ${sub.id}; advancing counter`);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodIndex: periodIndex + 1,
            nextBillingAt: new Date(Date.now() + sub.plan.periodDurationSeconds * 1000),
          }
        });
        continue;
      }

      const erc7710Client = new x402Erc7710Client({
        delegationProvider: createx402DelegationProvider({
          account: sessionAccount,
          parentPermissionContext: sub.permissionContext as `0x${string}`,
          from: (sub.grantedFrom || sub.sessionAccountAddress) as `0x${string}`,
        }),
      });

      const coreClient = new x402Client().register("eip155:*", erc7710Client);
      const httpClient = new x402HTTPClient(coreClient);
      const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

      let txHash: string;
      try {
        const res = await fetchWithPayment(`${BASE_URL}/api/x402/subscription/${sub.id}`);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Payment failed");
        }
        const data = await res.json();
        txHash = data.transaction;
      } catch (err: any) {
        // Leave the pending row as failed so the SAME period retries next run.
        await prisma.paymentEvent.update({
          where: { id: pe.id },
          data: { status: "failed" }
        });
        throw err;
      }

      // Mark settled and advance counter + nextBillingAt together, atomically.
      await prisma.$transaction([
        prisma.paymentEvent.update({
          where: { id: pe.id },
          data: { facilitatorTxHash: txHash, status: "succeeded" }
        }),
        prisma.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodIndex: periodIndex + 1,
            nextBillingAt: new Date(Date.now() + sub.plan.periodDurationSeconds * 1000),
          }
        }),
      ]);

      console.log(`Successfully billed sub ${sub.id}, tx: ${txHash}`);
    } catch (err: any) {
      console.error(`Failed to process subscription ${sub.id}:`, err);
      // set past_due on failure (counter NOT advanced → same period retries on reactivation)
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "past_due" }
      });
    }
  }

  console.log("Cron run complete.");
}

if (require.main === module) {
  processSubscriptions().then(() => process.exit(0));
}
