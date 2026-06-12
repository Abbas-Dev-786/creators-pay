import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key. Used to mint
 * short-TTL signed download URLs for paid assets (F7). NEVER expose the
 * service-role key or this client to the browser.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const PRODUCT_BUCKET =
  process.env.SUPABASE_PRODUCT_BUCKET ?? "product-files";

let cached: ReturnType<typeof createClient> | null = null;

export function getServiceSupabase() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service credentials missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  if (!cached) {
    cached = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return cached;
}

/** Default signed-URL lifetime for paid downloads. */
export const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Mint a short-TTL signed URL for a private storage object. Call only after a
 * verified, succeeded Order for the asset's product.
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign download URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
