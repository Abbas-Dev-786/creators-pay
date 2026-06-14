The three payment flows match plan.md and are real, not stubbed:

- One-time (Flow A): /api/x402/product/[id] uses x402HTTPResourceServer + x402ExactEvmErc7710ServerScheme, resolves buyer from settleResult.payer, prices via
  toX402Price(). ✅
- Subscription (Flow B): worker/billing-cron.ts has zero 1Shot refs, uses createx402DelegationProvider + fetchWithPayment, and has real periodIndex
  idempotency. ✅
- AI metered (Flow C): /api/ai/chat does verifyMessage ownership check → fetchWithPayment settles before calling Venice → increments spentAmount only after.  
  ✅
