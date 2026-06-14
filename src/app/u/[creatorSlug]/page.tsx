import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { formatAmount } from "@/lib/money";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Store, Compass } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  digital_download: "Download",
  ai_service: "AI Agent",
  subscription: "Subscription",
};

export default async function CreatorStorefrontPage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const decodedCreatorSlug = decodeURIComponent(creatorSlug);

  const creator = await prisma.user.findUnique({
    where: { slug: decodedCreatorSlug },
    include: {
      products: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!creator) {
    notFound();
  }

  const products = creator.products;

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8 animate-in fade-in-50 duration-500">
      <div className="mb-12 bg-primary/5 rounded-3xl p-8 sm:p-12 border border-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none hidden sm:block">
          <Store className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
            {creator.displayName}'s Store
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Browse and purchase digital products, subscriptions, and AI agents directly from {creator.displayName}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Compass className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold tracking-tight">Products</h2>
      </div>

      {products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
          <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <CardTitle className="mb-2">No products yet</CardTitle>
          <CardDescription className="max-w-md">
            This creator hasn't listed any products on their storefront yet.
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
                  <Link href={`/u/${creator.slug}/p/${p.slug}`}>
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
