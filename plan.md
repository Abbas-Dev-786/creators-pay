# CreatorPay — Implementation Plan

> Hackathon: MetaMask Smart Accounts Kit × 1Shot API
> **Tracks targeted:** Best x402 + ERC-7710 (primary). Agent track and 1Shot
> relayer bonus are **explicitly out of scope.**
> Last updated: 2026-06-13

---

## 1. The one decision that fixes everything

Dropping the 1Shot track collapses the project's biggest flaw (a split settlement
rail). **Every payment now settles through the MetaMask x402 Facilitator. Nothing
uses the 1Shot relayer.** One rail, on Base Sepolia (84532).

- Facilitator (Base Sepolia): `https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402`
- Chain: Base Sepolia, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6dp)
- Stack stays: Next.js 15 App Router, `@metamask/smart-accounts-kit`,
  `@metamask/x402`, `@x402/core`, `@x402/fetch`, viem, wagmi, Prisma + Supabase.

---

## 2. The three payment flows (all → Facilitator)

### Flow A — One-time digital purchase  (ERC-7715 grant → backend redeems ERC-7710)
The hero flow. Follows the **recurring-payments** + **seller-endpoint-setup** skills
(same 7715 machinery as B/C, but redeemed once, synchronously).

> **Why not direct browser ERC-7710?** MetaMask refuses to let a dApp sign an open
> ERC-7710 root delegation for its own (internal) account — it throws *"External
> signature requests cannot sign delegations for internal accounts."* The
> `createx402DelegationProvider({ account: smartAccount })` / **delegation-payments**
> flow only works for accounts you control via a **local private key** (backend /
> agents). A browser MetaMask buyer must therefore go through ERC-7715, which still
> redeems an ERC-7710 delegation under the hood — so the track fit is unchanged.

- **Server** (`/api/x402/product/[id]`): protect with the official resource server.
  Build it from `x402HTTPResourceServer` + `x402ExactEvmErc7710ServerScheme`
  (both are installed/exported). It emits the real 402 `accepts[]` body and
  verifies/settles the `PAYMENT-SIGNATURE` through the Facilitator. The shared
  resource server (`src/lib/x402/server.ts`) MUST be `initialize()`-d once before
  `processHTTPRequest()` or the facilitator-supported-kinds map is empty and it
  throws *"Facilitator does not support exact on eip155:84532."*
- **Grant (client, `CheckoutButton`)**: wallet extended with
  `erc7715ProviderActions()`; `requestExecutionPermissions([{ type:
  'erc20-token-periodic', data: { tokenAddress, periodAmount: <price + fee buffer,
  bigint>, periodDuration, justification }, isAdjustmentAllowed: true }])`,
  **`to` = backend SESSION ACCOUNT**, short expiry (one-time). POST `context` +
  `grantedFrom` to `/api/orders/create`.
- **Redeem (backend, `/api/orders/create`)**: session account buyer
  `createx402DelegationProvider({ account: sessionAccount, parentPermissionContext:
  context, from: grantedFrom })` → `x402Erc7710Client` →
  `x402Client().register('eip155:*', client)` → `fetchWithPayment('/api/x402/
  product/{id}')` (one shot). The product route settles via the Facilitator, writes
  Order + PaymentEvent(`one_time`), and returns the short-TTL signed download URL,
  which this route relays to the client. On 200, show download link.

### Flow B — Subscription / recurring  (ERC-7715 periodic budget)
Follows the **recurring-payments** skill. Subscription = recurring; one mechanism.

- **Grant (client, `SubscriptionCheckoutButton`)**: wallet extended with
  `erc7715ProviderActions()`; `requestExecutionPermissions([{ type:
  'erc20-token-periodic', data: { tokenAddress, periodAmount: <bigint>,
  periodDuration, justification }, isAdjustmentAllowed: true }])`.
  **`to` = our backend SESSION ACCOUNT address** (NOT a 1Shot target). Send
  `context`, `delegationManager`, `from` to the backend.
- **Charge (backend cron, `worker/billing-cron.ts` — REWRITTEN)**: for each due
  subscription, build a buyer client with the session account:
  `createx402DelegationProvider({ account: sessionAccount, parentPermissionContext:
  context, from })` → `x402Erc7710Client` → `fetchWithPayment('/api/x402/
  subscription/{id}')`. That endpoint is itself an x402 resource-server route;
  the Facilitator redeems the periodic permission and transfers `periodAmount` to
  the creator. Mark the period paid idempotently.

### Flow C — Metered pay-per-call AI  (ERC-7715 budget, charge per message)
Same 7715 machinery as Flow B, but the charge fires **synchronously per message,
before the AI responds** (fixes the old "deliver-then-maybe-bill" hole).

- **Grant (client, `AiCheckoutButton`)**: `requestExecutionPermissions` with
  `type: 'erc20-token-periodic'` (a per-session budget). **`to` = session account.**
  NOTE: the current `erc20-token-transfer` type is invalid — must change.
- **Per message (`/api/ai/chat`)**: verify the caller owns the session, then
  backend-as-buyer does `fetchWithPayment('/api/x402/ai/{id}')` (price = per-message
  cost) which the Facilitator settles → only then call Venice → return reply.
  No DB-counter "settle later", no resetting spent before confirmation.

---

## 3. Backend session-account model (the missing piece)

Flows B and C need the backend to sign delegations on the user's behalf within the
granted budget. For the hackathon: a **single app-wide session key** in env
(`SESSION_PRIVATE_KEY`), its address is what every 7715 grant delegates `to`.

- Expose the address to the client via `NEXT_PUBLIC_SESSION_ACCOUNT` (or a tiny
  `/api/session-account` route) so grants target the right account.
- Threat model (documented, acceptable for hackathon): the key can spend **only**
  within each user's granted periodic budget, only to the scoped destination, only
  until expiry. It custodies no funds and holds no user keys.

---

## 4. Changes vs. current code (the drift + bugs to fix)

| # | Where | Fix |
|---|-------|-----|
| 1 | `package.json` | Pin `@metamask/x402` and `@x402/core`/`@x402/fetch` to the actually-installed majors; reinstall clean so declared = resolved. |
| 2 | `/api/x402/product/[id]` | Replace hand-rolled 402 with `x402HTTPResourceServer` + `x402ExactEvmErc7710ServerScheme`. |
| 3 | `worker/billing-cron.ts` | Delete all 1Shot `relayer_*` JSON-RPC. Rebuild as backend-buyer `fetchWithPayment` via session account. |
| 4 | `AiCheckoutButton` | `erc20-token-transfer` → `erc20-token-periodic`; `periodAmount` as bigint. |
| 5 | `SubscriptionCheckoutButton` | `periodAmount` must be bigint, not string; `to` = session account. |
| 6 | `/api/webhooks/1shot` | Remove (no 1Shot). Subscription state advances from the cron's own settle result, not a webhook. |
| 7 | `/api/x402/product` order | `buyerId` must resolve from `result.payer`, not `product.creatorId`. |
| 8 | Idempotency | Cron sets `periodIndex` so `@@unique([subscriptionId, periodIndex])` actually prevents double-charge. |
| 9 | `/api/ai/chat` | Add caller→session ownership check; settle-per-call before Venice. |
| 10 | Types | Add `window.ethereum` typing; clear remaining `tsc --noEmit` errors. App must build green. |

---

## 5. Data model touch-ups (Prisma)

- `Subscription`: keep `permissionContext`, `delegationManager`, `grantedFrom`;
  ensure `sessionAccountAddress` = the backend session account (not the buyer).
- Add `periodIndex` write path; add a `currentPeriodIndex` counter on Subscription.
- `PaymentEvent`: extend enum so subscription + ai events are representable
  (current enum is `one_time | recurring | ai_micro` — map to these, don't invent
  `subscription_renewal`).
- `AiSession.status` should use its own enum or reuse cleanly; settle-per-call means
  `spentAmount` only increments on confirmed settlement.

---

## 6. Demo script (what the video must show — this is the grading surface)

1. Creator connects wallet, creates a digital product + a subscription + an AI product.
2. Buyer one-time purchase → MetaMask ERC-7715 permission prompt → backend session
   account redeems once → Facilitator settles → download unlocks. **Show the tx.**
3. Buyer subscribes → MetaMask ERC-7715 periodic-permission prompt (human-readable
   budget) → approve. Trigger one billing cycle live → charge settles.
4. Buyer opens AI chat → each message shows a micropayment settling before the reply.
5. Order history shows txs. Briefly show MetaMask's permission view (revocable).

Qualification bar = a working Smart Accounts Kit flow in the main flow. Step 2 alone
clears it; 3 and 4 are the winning margin.

---

## 7. Out of scope (do not build)
- 1Shot relayer, 7702-via-1Shot upgrade, mainnet. (Buyers upgrade to smart accounts
  via the Kit's own 7702 path if needed — no relayer.)
- Autonomous agent / A2A.
- Tax, disputes, multi-chain, advanced analytics.

---

## 8. Sequencing (see task.md)
Phase 1 green build → Phase 2 hero one-time flow end-to-end → Phase 3 subscription
→ Phase 4 AI metered → Phase 5 polish + demo. Each phase ends with a working,
demoable checkpoint so we always have something to film.
