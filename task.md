# CreatorPay — Task Checklist

Tracks: **Best x402 + ERC-7710** only. All payments settle via the MetaMask
Facilitator on Base Sepolia. No 1Shot, no agent track. See `plan.md` for rationale.

Each phase ends in a demoable checkpoint. Don't start a phase until the previous
checkpoint passes.

---

## Phase 1 — Make it compile (green build)
- [x] Pin `@metamask/x402`, `@x402/core`, `@x402/fetch` to installed majors; clean reinstall so declared == resolved.
- [x] Add `window.ethereum` typing (global.d.ts) so client files type-check.
- [x] Remove `/api/webhooks/1shot` route and its `@noble/ed25519` usage.
- [x] Fix Prisma drift: webhook referenced `subscription.orderId` + enum `subscription_renewal` (both invalid) — gone with the webhook; confirm enums used elsewhere are valid.
- [x] `npx tsc --noEmit` passes with **zero errors**.
- **Checkpoint:** `npm run build` succeeds.

## Phase 2 — Hero flow: one-time purchase (x402 + ERC-7710)
- [x] Rewrite `/api/x402/product/[id]` using `x402HTTPResourceServer` + `x402ExactEvmErc7710ServerScheme` (delete hand-rolled 402 header/parsing).
- [x] Define payment requirements: scheme `exact`, network `eip155:84532`, `payTo` = creator, `extra.assetTransferMethod = 'erc7710'`, price from product.
- [x] On settled 200: resolve buyer from `result.payer` (not creatorId); write Order + PaymentEvent(`one_time`); return short-TTL signed download URL.
- [x] Verify `CheckoutButton` client flow round-trips against the new server (delegation provider → wrapFetchWithPayment).
- **Checkpoint:** real buyer wallet buys a digital product on Base Sepolia, tx settles, download unlocks.

## Phase 3 — Subscription / recurring (ERC-7715 periodic)
- [x] Add backend session account: `SESSION_PRIVATE_KEY` env + expose its address to client (`NEXT_PUBLIC_SESSION_ACCOUNT` or `/api/session-account`).
- [x] `SubscriptionCheckoutButton`: request `erc20-token-periodic`, `periodAmount` as **bigint**, `to` = session account; POST `context` + `delegationManager` + `from` to backend.
- [x] `/api/subscriptions/create`: store context/delegationManager/grantedFrom; `sessionAccountAddress` = backend session account; set `nextBillingAt`, `currentPeriodIndex = 0`.
- [x] Create `/api/x402/subscription/[id]` x402 resource-server route (price = periodAmount, payTo = creator).
- [x] Rewrite `worker/billing-cron.ts`: **remove all 1Shot `relayer_*`**. For each due sub, build session-account buyer (`createx402DelegationProvider({ account: sessionAccount, parentPermissionContext, from })`) → `fetchWithPayment('/api/x402/subscription/{id}')`.
- [x] Idempotency: write `PaymentEvent` with `periodIndex = currentPeriodIndex`; rely on `@@unique([subscriptionId, periodIndex])`; advance `nextBillingAt` and `currentPeriodIndex` only on settled success; set `past_due` on failure.
- **Checkpoint:** subscribe → approve 7715 budget → run cron → one period charges once (re-running cron does NOT double-charge).

## Phase 4 — Metered pay-per-call AI (Venice)
- [x] `AiCheckoutButton`: change `erc20-token-transfer` → `erc20-token-periodic` (session budget), `periodAmount` bigint, `to` = session account.
- [x] `/api/x402/ai/[id]` x402 resource-server route (price = per-message cost).
- [x] `/api/ai/chat`: (a) verify caller owns the session; (b) backend-buyer `fetchWithPayment` settles the micropayment FIRST; (c) only then call Venice; (d) record `AIInvocation` + `PaymentEvent(ai_micro)` with the settled tx; increment `spentAmount` only on confirmed settlement.
- [x] Pick a Venice ZDR model via `/models` traits; server-side `VENICE_API_KEY`.
- **Checkpoint:** each chat message settles a micropayment before its reply appears.

## Phase 5 — Polish + demo
- [x] Implement `BuyerPurchaseHistory` component / page (`/u/[slug]/orders`).
- [x] Implement `CreatorDashboard` listing their product sales / MRR (`/u/[slug]/dashboard`).
- [x] Ensure DB seeding logic creates 3 sample creators, 2 digital downloads, 1 subscription plan, and 1 metered AI product.
- [x] Final UI cleanup (remove placeholder text).
- [x] Record 1-minute demo video showing all three flows on Base Sepolia.
- [x] Record demo per `plan.md` §6. Confirm a Smart Accounts Kit flow is visible in the main flow.
- [x] Checkpoint: full demo recorded; `npm run build` green; happy path reproducible.

---

### Definition of done (qualification)
A buyer completes at least the one-time x402 + ERC-7710 purchase on Base Sepolia
through MetaMask, settled by the Facilitator, visible on-chain — shown in the demo
video's main flow. Subscription + AI are the winning margin on top.
