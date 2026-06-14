import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { formatAmount } from "@/lib/money";
import { CheckoutButton } from "./CheckoutButton";
import { SubscriptionCheckoutButton } from "./SubscriptionCheckoutButton";
import { AiCheckoutButton } from "./AiCheckoutButton";

export const dynamic = "force-dynamic";

const AI_SESSION_MESSAGE_COUNT = 50n;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; productSlug: string }>;
}) {
  const { creatorSlug, productSlug } = await params;
  
  const decodedCreatorSlug = decodeURIComponent(creatorSlug);
  const decodedProductSlug = decodeURIComponent(productSlug);

  const product = await prisma.product.findUnique({
    where: {
      creatorId_slug: {
        creatorId: (
          await prisma.user.findUnique({ where: { slug: decodedCreatorSlug } })
        )?.id || "",
        slug: decodedProductSlug,
      },
    },
    include: {
      creator: true,
      plan: true,
    },
  });

  if (!product) {
    notFound();
  }

  const isSubscription = product.type === "subscription";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-wider uppercase opacity-60">
          {product.type.replace('_', ' ')}
        </span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
      <p className="text-xl opacity-80 mb-6">By {product.creator.displayName}</p>
      
      <div className="bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-2">
          {formatAmount(product.priceAmount, product.priceTokenSymbol)}
          {isSubscription && <span className="text-base font-normal opacity-70"> / {(product.plan?.periodDurationSeconds || 0) / 86400} days</span>}
        </h2>
        <div className="mt-6">
          {product.type === "ai_service" ? (
            <AiCheckoutButton
              productId={product.id}
              budgetAmount={(BigInt(product.priceAmount) * AI_SESSION_MESSAGE_COUNT).toString()}
              creatorAddress={product.creator.payoutAddress || product.creator.walletAddress}
            />
          ) : isSubscription ? (
            <SubscriptionCheckoutButton
              productId={product.id}
              periodAmount={product.priceAmount}
              periodDurationSeconds={product.plan?.periodDurationSeconds || 0}
              creatorAddress={product.creator.payoutAddress || product.creator.walletAddress}
            />
          ) : (
            <CheckoutButton 
              productId={product.id} 
              priceAmount={product.priceAmount} 
              type={product.type} 
              creatorAddress={product.creator.payoutAddress || product.creator.walletAddress}
            />
          )}
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <h3 className="text-lg font-semibold mb-2">Description</h3>
        <p className="whitespace-pre-wrap">{product.description}</p>
      </div>
    </div>
  );
}
