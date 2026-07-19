import { Router } from "express";
import { catalogStore } from "../../lib/vercel-catalog/catalogStore";
import { chat } from "../ai/aiService";

export const emiRouter = Router();

const CATALOG_SYSTEM_SCOPE = [
  "You are Emi, Choosify's public shopping assistant.",
  "Answer ONLY using the catalog data provided below (products, brands, categories, deals).",
  "If the question cannot be answered from that catalog data, say you can only help with Choosify catalog questions.",
  "Do not invent products, prices, or brands that are not in the catalog data.",
].join(" ");

function truncateJson(value: unknown, max = 12000): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function extractUserMessage(body: Record<string, unknown>): string | null {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (Array.isArray(body.messages)) {
    const lastUser = [...body.messages]
      .reverse()
      .find(
        (entry): entry is { role: string; content: string } =>
          typeof entry === "object" &&
          entry !== null &&
          (entry as { role?: unknown }).role === "user" &&
          typeof (entry as { content?: unknown }).content === "string",
      );
    if (lastUser?.content.trim()) return lastUser.content.trim();
  }

  return null;
}

async function buildPublicCatalogBlock(): Promise<string> {
  const [products, brands, categories, deals] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listBrands(),
    catalogStore.listCategories(),
    catalogStore.listDeals(),
  ]);

  const liveProducts = products
    .filter((product) => product.status === "live")
    .slice(0, 40)
    .map((product) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      brandId: product.brandId,
      brandName: product.brandName,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      price: product.price,
      originalPrice: product.originalPrice,
      status: product.status,
    }));

  return truncateJson({
    products: liveProducts,
    brands: brands.slice(0, 40).map((brand) => ({
      id: brand.id,
      name: brand.name,
      description: brand.description,
    })),
    categories: categories.slice(0, 40).map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
    })),
    deals: deals.slice(0, 40).map((deal) => ({
      id: deal.id,
      name: deal.name,
      seller: deal.seller,
      category: deal.category,
      status: deal.status,
      discountType: deal.discountType,
      discountValue: deal.discountValue,
      promoCode: deal.promoCode,
      productId: deal.productId,
      brandId: deal.brandId,
      validFrom: deal.validFrom,
      validUntil: deal.validUntil,
    })),
  });
}

/**
 * Public EMI chat — reuses Gemini via aiService.chat, no auth.
 * Rate-limited at /api/emi via aiRateLimit in server/app.ts.
 * Scoped to catalog data only (products, brands, categories, deals).
 *
 * Accepts either `{ message }` or Choosify-Web's `{ messages, pageContext }`.
 * Responds with top-level `{ reply, picks }` for the storefront client.
 */
emiRouter.post("/emi/chat", async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const userMessage = extractUserMessage(body);
    if (!userMessage) {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    const pageContext =
      body.pageContext && typeof body.pageContext === "object"
        ? (body.pageContext as { pathname?: string; title?: string })
        : undefined;

    const catalogBlock = await buildPublicCatalogBlock();
    const scopedMessage = [
      CATALOG_SYSTEM_SCOPE,
      pageContext?.pathname
        ? `User is currently on page: ${pageContext.pathname}${pageContext.title ? ` (${pageContext.title})` : ""}.`
        : "",
      "",
      "Catalog data:",
      catalogBlock,
      "",
      "User question:",
      userMessage,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await chat(
      {
        message: scopedMessage,
        skillId: "buyer_assistant",
        // Catalog-only context — no analytics, trust, moderation, etc.
        contextSources: ["product"],
        conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
        includeMetadata: false,
      },
      { req },
    );

    return res.json({
      reply: result.reply,
      picks: [],
      conversationId: result.conversationId,
      mode: "catalog",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "EMI chat failed",
    });
  }
});
