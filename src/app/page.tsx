import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { formatAmount } from "@/lib/money";
import { ConnectBar } from "@/components/ConnectBar";

export const dynamic = "force-dynamic";

type ProductCard = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priceAmount: string;
  priceTokenSymbol: string;
  creatorSlug: string | null;
  productSlug: string;
};

async function getProducts(): Promise<ProductCard[]> {
  try {
    const products = await prisma.product.findMany({
      include: { creator: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      priceAmount: p.priceAmount,
      priceTokenSymbol: p.priceTokenSymbol,
      creatorSlug: p.creator.slug,
      productSlug: p.slug,
    }));
  } catch {
    // DB not configured yet — render an empty storefront rather than crashing.
    return [];
  }
}

const TYPE_LABEL: Record<string, string> = {
  digital_download: "Download",
  ai_service: "AI",
  subscription: "Subscription",
};

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold">CreatorPay</h1>
          <p className="text-sm opacity-70">
            Sell digital &amp; AI products. Paid via MetaMask smart accounts (x402).
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/orders" className="text-sm underline underline-offset-4">
            My Purchases
          </Link>
          <Link href="/dashboard" className="text-sm underline underline-offset-4">
            Creator Dashboard
          </Link>
          <ConnectBar />
        </div>
      </header>

      {products.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-8 text-center opacity-70">
          No products yet. Configure the database and run{" "}
          <code className="font-geist-mono">npm run db:seed</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/u/${p.creatorSlug}/p/${p.productSlug}`}
              className="rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-black/30 dark:hover:border-white/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide opacity-60">
                  {TYPE_LABEL[p.type] ?? p.type}
                </span>
                <span className="text-sm font-medium">
                  {formatAmount(p.priceAmount, p.priceTokenSymbol)}
                </span>
              </div>
              <h2 className="font-semibold">{p.title}</h2>
              {p.description && (
                <p className="text-sm opacity-70 mt-1 line-clamp-2">
                  {p.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
