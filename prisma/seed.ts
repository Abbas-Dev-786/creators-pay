import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 6-decimal USDC base units.
const usdc = (whole: string) => {
  const [int, frac = ""] = whole.split(".");
  return (int + frac.padEnd(6, "0").slice(0, 6)).replace(/^0+(?=\d)/, "");
};

async function main() {
  const creator = await prisma.user.upsert({
    where: { walletAddress: "0x1111111111111111111111111111111111111111" },
    update: {},
    create: {
      walletAddress: "0x1111111111111111111111111111111111111111",
      role: "creator",
      displayName: "Alice Codes",
      slug: "alice",
      payoutAddress: "0x1111111111111111111111111111111111111111",
    },
  });

  // 1. Digital download
  await prisma.product.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "react-patterns-ebook" } },
    update: {},
    create: {
      creatorId: creator.id,
      type: "digital_download",
      title: "Advanced React Patterns (eBook)",
      slug: "react-patterns-ebook",
      description: "120-page PDF on production React architecture.",
      priceAmount: usdc("5"),
      priceTokenSymbol: "USDC",
      metadata: { storagePath: "alice/react-patterns-ebook.pdf" },
      assets: {
        create: {
          storageUrl: "alice/react-patterns-ebook.pdf",
          contentType: "application/pdf",
        },
      },
    },
  });

  // 2. AI service (pay-per-call)
  await prisma.product.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "ai-course-assistant" } },
    update: {},
    create: {
      creatorId: creator.id,
      type: "ai_service",
      title: "AI Course Assistant",
      slug: "ai-course-assistant",
      description: "Ask my React course assistant anything. 0.10 USDC per question.",
      priceAmount: usdc("0.10"),
      priceTokenSymbol: "USDC",
      metadata: {
        // Resolved to a concrete ZDR model at call time via /models/traits.
        modelTrait: "default_reasoning",
        systemPrompt:
          "You are a helpful teaching assistant for an advanced React course. Answer concisely with code examples.",
      },
    },
  });

  // 3. Subscription
  const subProduct = await prisma.product.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "pro-membership" } },
    update: {},
    create: {
      creatorId: creator.id,
      type: "subscription",
      title: "Pro Membership",
      slug: "pro-membership",
      description: "Monthly access to all premium templates and office hours.",
      priceAmount: usdc("5"),
      priceTokenSymbol: "USDC",
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { productId: subProduct.id },
    update: {},
    create: {
      productId: subProduct.id,
      periodAmount: usdc("5"),
      periodTokenSymbol: "USDC",
      periodDurationSeconds: 30 * 24 * 60 * 60,
    },
  });

  console.log("Seed complete: creator @alice with 3 products.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
