import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";

/**
 * One-time purchase settlement.
 *
 * The buyer cannot sign a raw ERC-7710 delegation from their MetaMask account
 * (the extension blocks "external signature requests ... for internal accounts").
 * Instead the buyer grants an ERC-7715 periodic permission to our backend session
 * account, and here that session account redeems it ONCE — exactly the same buyer
 * construction the billing cron uses for subscriptions — against the existing
 * x402 product resource route, which verifies/settles via the Facilitator and
 * returns the signed download URL.
 */
export async function POST(req: NextRequest) {
  // Loop back to THIS server (handles dev ports like :3001) — fall back to the
  // configured public URL only when an absolute origin isn't available.
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  try {
    const { productId, permissionContext, grantedFrom } = await req.json();

    if (!productId || !permissionContext || !grantedFrom) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sessionKey = process.env.SESSION_PRIVATE_KEY;
    if (!sessionKey) {
      return NextResponse.json({ error: "Server session account not configured" }, { status: 500 });
    }
    const sessionAccount = privateKeyToAccount(sessionKey as `0x${string}`);

    // ---- TEMP DEBUG: inspect the granted delegation the facilitator simulates ----
    try {
      const { decodeAbiParameters } = await import("viem");
      console.log("\n========== ORDER DEBUG ==========");
      console.log("productId      :", productId);
      console.log("grantedFrom    :", grantedFrom);
      console.log("sessionAccount :", sessionAccount.address);
      console.log("ctx typeof     :", typeof permissionContext, "len:", (permissionContext || "").length);
      console.log("ctx prefix     :", String(permissionContext).slice(0, 12));
      // ERC-7710 permissionContext = ABI-encoded Delegation[]
      const DELEGATION = {
        type: "tuple[]",
        components: [
          { name: "delegate", type: "address" },
          { name: "delegator", type: "address" },
          { name: "authority", type: "bytes32" },
          { name: "caveats", type: "tuple[]", components: [
            { name: "enforcer", type: "address" },
            { name: "terms", type: "bytes" },
            { name: "args", type: "bytes" },
          ] },
          { name: "salt", type: "uint256" },
          { name: "signature", type: "bytes" },
        ],
      } as const;
      const [delegations] = decodeAbiParameters([DELEGATION], permissionContext as `0x${string}`);
      (delegations as any[]).forEach((d, i) => {
        console.log(`-- delegation[${i}] delegator=${d.delegator} delegate=${d.delegate} caveats=${d.caveats.length}`);
        d.caveats.forEach((c: any, j: number) =>
          console.log(`     caveat[${j}] enforcer=${c.enforcer} terms=${c.terms}`));
      });
      console.log("=================================\n");
    } catch (dbgErr: any) {
      console.log("ORDER DEBUG decode failed:", dbgErr?.message, "| raw ctx:", String(permissionContext).slice(0, 80));
    }
    // ---- END TEMP DEBUG ----

    const erc7710Client = new x402Erc7710Client({
      delegationProvider: createx402DelegationProvider({
        account: sessionAccount,
        parentPermissionContext: permissionContext as `0x${string}`,
        from: grantedFrom as `0x${string}`,
      }),
    });

    const coreClient = new x402Client().register("eip155:*", erc7710Client);
    const httpClient = new x402HTTPClient(coreClient);
    const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

    let res: Response;
    try {
      res = await fetchWithPayment(`${BASE_URL}/api/x402/product/${productId}`);
    } catch (payErr: any) {
      // wrapFetchWithPayment throws if it can't build/redeem the delegation payment
      // (bad permission context, scheme not registered, facilitator rejects the sign, ...).
      console.error("orders/create: payment build/redeem threw:", payErr);
      return NextResponse.json(
        { error: "Payment could not be completed", message: payErr?.message || String(payErr) },
        { status: 402 }
      );
    }

    const data = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      // Surface the real settlement reason logged by the x402/product route
      // (errorReason/errorMessage) instead of an opaque "Payment failed".
      console.error("orders/create: x402 product returned", res.status, JSON.stringify(data));
      return NextResponse.json(
        {
          error: data.error || "Payment failed",
          message: data.message,
          upstreamStatus: res.status,
        },
        { status: res.status || 402 }
      );
    }

    // The resource route already wrote the Order + PaymentEvent and minted the
    // signed download URL — just relay its result to the buyer.
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Order create error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
