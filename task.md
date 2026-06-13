# CreatorPay — Task Checklist

Tracks: **Best x402 + ERC-7710** only. All payments settle via the MetaMask
Facilitator on Base Sepolia. No 1Shot, no agent track. See `plan.md` for rationale.

Each phase ends in a demoable checkpoint. Don't start a phase until the previous
checkpoint passes.

---

## Phase 1 — Make it compile (green build)
- [ ] Pin `@metamask/x402`, `@x402/core`, `@x402/fetch` to installed majors; clean reinstall so declared == resolved.
- [ ] Add `window.ethereum` typing (global.d.ts) so client files type-check.
- [ ] Remove `/api/webhooks/1shot` route and its `@noble/ed25519` usage.
- [ ] Fix Prisma drift: webhook referenced `subscription.orderId` + enum `subscription_renewal` (both invalid) — gone with the webhook; confirm enums used elsewhere are valid.
- [ ] `npx tsc --noEmit` passes with **zero errors**.
- **Checkpoint:** `npm run build` succeeds.

## Phase 2 — Hero flow: one-time purchase (x402 + ERC-7710)
- [ ] Rewrite `/api/x402/product/[id]` using `x402HTTPResourceServer` + `x402ExactEvmErc7710ServerScheme` (delete hand-rolled 402 header/parsing).
- [ ] Define payment requirements: scheme `exact`, network `eip155:84532`, `payTo` = creator, `extra.assetTransferMethod = 'erc7710'`, price from product.
- [ ] On settled 200: resolve buyer from `result.payer` (not creatorId); write Order + PaymentEvent(`one_time`); return short-TTL signed download URL.
- [ ] Verify `CheckoutButton` client flow round-trips against the new server (delegation provider → wrapFetchWithPayment).
- **Checkpoint:** real buyer wallet buys a digital product on Base Sepolia, tx settles, download unlocks.

## Phase 3 — Subscription / recurring (ERC-7715 periodic)
- [ ] Add backend session account: `SESSION_PRIVATE_KEY` env + expose its address to client (`NEXT_PUBLIC_SESSION_ACCOUNT` or `/api/session-account`).
- [ ] `SubscriptionCheckoutButton`: request `erc20-token-periodic`, `periodAmount` as **bigint**, `to` = session account; POST `context` + `delegationManager` + `from` to backend.
- [ ] `/api/subscriptions/create`: store context/delegationManager/grantedFrom; `sessionAccountAddress` = backend session account; set `nextBillingAt`, `currentPeriodIndex = 0`.
- [ ] Create `/api/x402/subscription/[id]` x402 resource-server route (price = periodAmount, payTo = creator).
- [ ] Rewrite `worker/billing-cron.ts`: **remove all 1Shot `relayer_*`**. For each due sub, build session-account buyer (`createx402DelegationProvider({ account: sessionAccount, parentPermissionContext, from })`) → `fetchWithPayment('/api/x402/subscription/{id}')`.
- [ ] Idempotency: write `PaymentEvent` with `periodIndex = currentPeriodIndex`; rely on `@@unique([subscriptionId, periodIndex])`; advance `nextBillingAt` and `currentPeriodIndex` only on settled success; set `past_due` on failure.
- **Checkpoint:** subscribe → approve 7715 budget → run cron → one period charges once (re-running cron does NOT double-charge).

## Phase 4 — Metered pay-per-call AI (Venice)
- [ ] `AiCheckoutButton`: change `erc20-token-transfer` → `erc20-token-periodic` (session budget), `periodAmount` bigint, `to` = session account.
- [ ] `/api/x402/ai/[id]` x402 resource-server route (price = per-message cost).
- [ ] `/api/ai/chat`: (a) verify caller owns the session; (b) backend-buyer `fetchWithPayment` settles the micropayment FIRST; (c) only then call Venice; (d) record AIInvocation + PaymentEvent(`ai_micro`) with the settled tx; increment `spentAmount` only on confirmed settlement.
- [ ] Pick a Venice ZDR model via `/models` traits; server-side `VENICE_API_KEY`.
- **Checkpoint:** each chat message settles a micropayment before its reply appears.

## Phase 5 — Polish + demo
- [ ] Order/subscription history pages show txs, next billing, status.
- [ ] Surface MetaMask permission revocation guidance on cancel; set sub `cancelled`.
- [ ] Seed script: one creator with one product of each type for the demo.
- [ ] Error/empty/loading states on all three checkout buttons.
- [ ] Record demo per `plan.md` §6. Confirm a Smart Accounts Kit flow is visible in the main flow.
- **Checkpoint:** full demo recorded; `npm run build` green; happy path reproducible.

---

### Definition of done (qualification)
A buyer completes at least the one-time x402 + ERC-7710 purchase on Base Sepolia
through MetaMask, settled by the Facilitator, visible on-chain — shown in the demo
video's main flow. Subscription + AI are the winning margin on top.
