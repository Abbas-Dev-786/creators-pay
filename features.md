# CreatorPay — Feature Ideas (if there's more time)

> Read this AFTER the core scope in `plan.md` / `task.md` is done and green.
> Judged on: **Best x402 + ERC-7710**. Every idea here is rated by how much it
> moves *that* score, not generic product value.
> Last updated: 2026-06-13

## How to use this list
The core build (one-time + subscription + AI, all Facilitator-settled) is what
*qualifies and wins*. Everything below is **margin**. Spend extra time strictly
top-down: a feature only earns its slot if it either (a) makes the x402/7710
mechanics more *visible* to judges, or (b) makes the demo more *reliable*.
**Reliability beats features** — a flawless 3-flow demo outscores a janky 6-flow one.

Effort: 🟢 hours · 🟡 half-day · 🔴 day+
Impact on x402/7710 judging: ⭐ low · ⭐⭐ medium · ⭐⭐⭐ high

---

## Tier 1 — Highest leverage (do these first if time allows)

### 1. Live payment activity feed ⭐⭐⭐ 🟢
A real-time list showing each x402 payment as it settles: amount, payer, tx hash
(linked to Basescan), scheme (`erc7710`), and which flow it came from. This is the
single best way to make the *protocol mechanics legible on camera* — judges literally
see x402 + 7710 working. Cheap because the data already exists in `PaymentEvent`.

### 2. On-chain verification badges ⭐⭐⭐ 🟢
Next to every order/charge, a "Verified on Base Sepolia ✓" link to the tx + the USDC
`Transfer` event. Proves settlement really happened (not a mocked DB write). Directly
counters the "is this actually on-chain?" judge skepticism.

### 3. Permission/delegation inspector ⭐⭐⭐ 🟡
A small UI panel that decodes and displays the active ERC-7715 grant or ERC-7710
delegation for a subscription/AI session: token, period amount, period length, expiry,
spent-this-period, destination. Shows you understand the *caveat model*, which is the
heart of this track. Pairs naturally with a "Revoke in MetaMask" deep link.

### 4. Spend caps & budget UX for AI sessions ⭐⭐ 🟢
Let the buyer pick a session budget (e.g. $1 / $5 / $10) before granting, and show a
live "budget remaining" meter as messages settle. Makes the metered-payment story
tangible and demonstrates bounded, user-controlled permissions — exactly the 7715 value
prop. Mostly frontend on top of work you've already done.

---

## Tier 2 — Strong polish (do if Tier 1 is done)

### 5. Creator revenue dashboard ⭐ 🟡
Total revenue, per-product breakdown, active subscriber count, MRR estimate. PRD §5.6
already scopes it. Low *track* impact but high "this is a real product" impact for
overall judging. Charts optional — KPIs are enough.

### 6. Email/in-app receipts & billing notifications ⭐ 🟡
On each settled charge, notify buyer + creator (in-app toast minimum; email if a
provider is handy). Makes subscriptions feel production-grade. Good for the "reliable
recurring billing" narrative.

### 7. Subscription lifecycle states ⭐⭐ 🟡
Proper handling of `past_due` (retry with backoff), `expired` (grant lapsed), and
`cancelled` (stop cron + prompt revoke). Demonstrates you thought past the happy path —
judges probe this. Builds on the idempotent cron from core Phase 3.

### 8. Multiple price tiers per subscription ⭐ 🟡
Basic/Pro/Premium plans on one product, each a different `periodAmount`. Shows the
periodic-permission model scales. Modest schema change (you already have
SubscriptionPlan).

### 9. Product preview / paywall teaser ⭐ 🟢
Show a blurred preview or first N% of a digital product before purchase. Classic
Gumroad UX; makes the storefront feel finished. Pure frontend.

---

## Tier 3 — Nice to have / stretch

### 10. Buyer-side "my permissions" management page ⭐⭐ 🟡
One place listing every active grant the buyer made across creators, with spend so far
and a revoke link per grant. Reinforces the user-control story. Higher effort because it
aggregates across sessions/subscriptions.

### 11. Refunds / partial refunds ⭐ 🔴
Creator-initiated USDC transfer back to buyer, recorded as a negative PaymentEvent.
Realistic but adds a whole new on-chain write path and edge cases. Only if everything
else is rock-solid.

### 12. Multi-token support (USDT/PYUSD alongside USDC) ⭐ 🟡
Let creators price in other Facilitator-supported stablecoins. Real value but multiplies
your testing surface; verify token support on the Base Sepolia Facilitator first.

### 13. Discount codes / promotional pricing ⭐ 🟡
Adjust the x402 price requirement per code at the resource-server layer. Neat demo of
dynamic pricing but pulls focus from the core mechanics.

### 14. Analytics events / conversion funnel ⭐ 🟡
Track view → connect → pay drop-off. Useful for a "real startup" pitch, near-zero track
impact.

---

## Explicitly NOT worth it for this hackathon
These look tempting but cost more than they return given your tracks:
- **1Shot relayer / 7702-via-relayer / mainnet** — different track, real money, out of scope.
- **Autonomous agent / A2A coordination** — different track; would dilute focus.
- **Mobile-native app** — MetaMask Connect in the responsive web app is enough.
- **IPFS/decentralized storage migration** — Supabase signed URLs already work; no judge cares.
- **Dispute resolution / escrow** — PRD non-goal; large surface, no track payoff.
- **Tax/invoicing system** — PRD non-goal.
- **Account abstraction beyond the Kit** — the brief says don't.

---

## Suggested decision rule
After the core 3 flows demo cleanly, add features in this order until time runs out:
**1 → 2 → 3 → 4**, then stop and *polish + re-record the demo*. Do not start Tier 2
until Tier 1 is shippable. A feature that isn't in the demo video earns zero points.
