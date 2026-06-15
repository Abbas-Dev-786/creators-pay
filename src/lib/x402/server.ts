import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { FACILITATOR_URL, X402_NETWORK } from "@/lib/config";

/**
 * Shared x402 resource server for CreatorPay.
 *
 * The facilitator's supported payment kinds must be fetched via `initialize()`
 * BEFORE any `processHTTPRequest()` call — otherwise the server has no record
 * that the facilitator supports `exact` on our network and throws
 * "Facilitator does not support exact on eip155:...".
 *
 * That fetch only needs to happen once per process, so we memoize it here and
 * reuse the same registered resource server across all payment routes.
 */
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  X402_NETWORK,
  new x402ExactEvmErc7710ServerScheme()
);

let initPromise: Promise<void> | null = null;

/** Returns the resource server, initializing facilitator support once per process. */
export async function getResourceServer() {
  if (!initPromise) {
    initPromise = resourceServer.initialize().catch((e) => {
      initPromise = null; // let a later request retry if the first fetch failed
      throw e;
    });
  }
  await initPromise;
  return resourceServer;
}

/**
 * Extract a human-readable reason from a `payment-error` HTTP response.
 *
 * When `processHTTPRequest()` rejects a payment (e.g. the facilitator can't
 * verify the ERC-7710 delegation, or the buyer lacks USDC), the real reason is
 * `verifyResult.invalidReason` — but the library encodes it into the base64
 * `PAYMENT-REQUIRED` header (as `.error`), NOT the JSON body, which defaults to
 * `{}`. Returning that empty body is what made the buyer see an opaque "Payment
 * failed". This decodes the header so the actual reason surfaces to the caller.
 */
export function paymentErrorReason(response: {
  headers?: Record<string, string>;
  body?: any;
}): string | undefined {
  // A body that already carries an explicit error (e.g. the 403 abort path) wins.
  if (response.body && typeof response.body === "object" && response.body.error) {
    return response.body.error as string;
  }
  const headers = response.headers || {};
  const headerKey = Object.keys(headers).find(
    (k) => k.toLowerCase() === "payment-required"
  );
  if (!headerKey) return undefined;
  try {
    const decoded = decodePaymentRequiredHeader(headers[headerKey]);
    return (decoded as any)?.error || undefined;
  } catch {
    return undefined;
  }
}
