import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { formatAmount } from "@/lib/money";

// shadcn UI
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Store, Compass } from "lucide-react";

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
  creatorName: string | null;
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
      creatorName: p.creator.displayName,
    }));
  } catch {
    return [];
  }
}

const TYPE_LABEL: Record<string, string> = {
  digital_download: "Download",
  ai_service: "AI Agent",
  subscription: "Subscription",
};

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8 animate-in fade-in-50 duration-500">
      
      {/* Hero Section */}
      <div className="mb-12 bg-primary/5 rounded-3xl p-8 sm:p-12 border border-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none hidden sm:block">
          <Store className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Decentralized Creator Economy</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
            Discover amazing digital products and AI experiences.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Support creators directly. Paid via MetaMask smart accounts using gasless x402 micropayments.
          </p>
          <div className="flex gap-4">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Start Selling <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/orders">
                My Purchases
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Compass className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold tracking-tight">Marketplace</h2>
      </div>

      {products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
          <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <CardTitle className="mb-2">No products found</CardTitle>
          <CardDescription className="max-w-md">
            The marketplace is currently empty. Configure your database and run 
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted font-mono text-xs">npm run db:seed</code>
            to populate some test products.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-primary/50 group">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <Badge variant={p.type === 'ai_service' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {TYPE_LABEL[p.type] ?? p.type}
                  </Badge>
                  <div className="text-lg font-bold">
                    {formatAmount(p.priceAmount, p.priceTokenSymbol)} <span className="text-sm font-normal text-muted-foreground">{p.priceTokenSymbol}</span>
                  </div>
                </div>
                <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
                  {p.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  by <span className="font-medium text-foreground">{p.creatorName || 'Unknown'}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {p.description}
                  </p>
                )}
              </CardContent>
              <CardFooter className="pt-0">
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/u/${p.creatorSlug}/p/${p.productSlug}`}>
                    View Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
