import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
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
