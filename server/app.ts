import express, { type Express } from "express";
import dotenv from "dotenv";
import compression from "compression";
import { messagingRouter, handleMetaWebhookPost } from "./messagingHub";
import { logisticsRouter } from "./logisticsRouter";
import { catalogRouter } from "./catalogRouter";
import { operationsRouter } from "./operationsRouter";
import { bookingRouter } from "./booking/bookingRouter";
import { authRouter } from "./authRouter";
import { paymentsRouter } from "./payments/paymentsRouter";
import { commercePaymentsRouter } from "./payments/commercePaymentsRouter";
import { escrowRouter } from "./escrow/escrowRouter";
import { adsRouter } from "./ads/adsRouter";
import { cashbookRouter } from "./cashbook/cashbookRouter";
import { referenceIdRouter } from "./referenceIds/referenceIdRouter";
import { commerceRouter } from "./commerceRouter";
import { conversationRouter } from "./messaging/conversations/conversationRouter";
import { bootstrapConversationEventSubscribers } from "./messaging/conversations/conversationEvents";
import { ensureConversationMemoryHydrated } from "./messaging/conversations/conversationMemoryBackend";
import { getAnalyticsSummary } from "./operations/analyticsService";
import { Logger } from "./lib/logger";
import { validateEnvironment } from "./lib/env";
import { createHelmetMiddleware } from "./lib/helmetConfig";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestTimingMiddleware } from "./middleware/requestTiming";
import { createCorsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import {
  JSON_BODY_LIMIT,
  RAW_BODY_LIMIT,
  URLENCODED_BODY_LIMIT,
  payloadTooLargeHandler,
} from "./middleware/payloadLimits";
import {
  adminRateLimit,
  aiRateLimit,
  authRateLimit,
  catalogReadRateLimitMiddleware,
  messagingRateLimit,
  publicApiRateLimit,
  searchRateLimitMiddleware,
} from "./middleware/rateLimit";
import { analyticsRouter } from "./analytics/analyticsRouter";
import { moderationRouter } from "./moderation/moderationRouter";
import { searchRouter } from "./search/searchRouter";
import { communicationRouter } from "./communication/communicationRouter";
import { aiRouter } from "./ai/aiRouter";
import { emiRouter } from "./emi/emiRouter";
import { healthRouter } from "./routes/health";
import { diagnosticsRouter } from "./routes/diagnostics";
import { dashboardSearchRouter } from "./dashboardSearch/dashboardSearchRouter";
import { entitlementsRouter } from "./entitlements/entitlementsRouter";
import { partnerApplicationRouter } from "./partnerApplications/partnerApplicationRouter";
import { navAttentionRouter } from "./dashboard/navAttentionRouter";
import { backfillLegacyPartnerEntitlementsSnapshot } from "./entitlements/entitlementPersistence";

dotenv.config();
validateEnvironment();
ensureConversationMemoryHydrated();
bootstrapConversationEventSubscribers();
void backfillLegacyPartnerEntitlementsSnapshot();

void import('./partnerApplications/partnerApplicationService')
  .then(async ({ ensureLegacyPendingApplicationsProvisioned }) => {
    const result = await ensureLegacyPendingApplicationsProvisioned();
    console.log(
      `[PartnerOnboarding] Legacy pending provision — linked=${result.linked} provisioned=${result.provisioned} skipped=${result.skipped}`,
    );
    if (result.errors.length) {
      console.warn('[PartnerOnboarding] Legacy pending gaps:', result.errors.slice(0, 20));
    }
  })
  .catch((error) => {
    console.warn(
      '[PartnerOnboarding] Legacy pending provision skipped:',
      error instanceof Error ? error.message : String(error),
    );
  });

// Ensure Choosify User ID schema + idempotent backfill on boot (non-blocking failure).
void import('./auth/choosifyUserId')
  .then(async ({ ensureChoosifyUserIdSchema, backfillChoosifyUserIds }) => {
    await ensureChoosifyUserIdSchema();
    const result = await backfillChoosifyUserIds();
    console.log(
      `[ChoosifyUserId] Backfill complete — total=${result.totalUsers} assigned=${result.assigned} preserved=${result.alreadyHadId} duplicates=${result.duplicatesDetected.length}`,
    );
  })
  .catch((error) => {
    console.warn(
      '[ChoosifyUserId] Boot backfill skipped:',
      error instanceof Error ? error.message : String(error),
    );
  });

/**
 * Fully configured Express app with all middleware and API routers.
 * Does not start listening or attach Socket.IO — those stay in server.ts for local dev.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestTimingMiddleware);
  app.use(createHelmetMiddleware());
  app.use(compression());
  app.use(healthRouter);
  app.use(diagnosticsRouter);

  // Meta webhooks need the raw body for signature verification (before JSON parser)
  app.post(
    "/api/webhooks/meta",
    express.raw({ type: "application/json", limit: RAW_BODY_LIMIT }),
    handleMetaWebhookPost,
  );

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: URLENCODED_BODY_LIMIT }));
  app.use(payloadTooLargeHandler);
  app.use(createCorsMiddleware());

  // Rate limiting — specific policies before public fallback.
  // Strict auth bucket applies only to credential/session-mutation endpoints.
  // Authenticated reads (/auth/me, impersonation status/history, directory) use
  // the admin policy so a valid session is not flushed by login-tier limits.
  const AUTH_STRICT_PATH =
    /^\/api\/v1\/auth\/(login|register|seller-register|partner-apply|upgrade-to-seller|refresh|logout|dev-login|password-reset-request|change-password)(\/|$)/i;
  app.use("/api/v1/auth", (req, res, next) => {
    if (AUTH_STRICT_PATH.test(req.originalUrl.split("?")[0] || "")) {
      return authRateLimit(req, res, next);
    }
    return adminRateLimit(req, res, next);
  });
  app.use("/api/messaging", messagingRateLimit);
  app.use("/api/conversations", messagingRateLimit);
  app.use("/api/messages", messagingRateLimit);
  app.use("/api/agents", messagingRateLimit);
  app.use("/api/admin", adminRateLimit);
  app.use("/api/ai", aiRateLimit);
  app.use("/api/emi", aiRateLimit);
  app.use("/api/v1/catalog/products", searchRateLimitMiddleware);
  app.use("/api/v1/catalog", catalogReadRateLimitMiddleware);
  app.use("/api/v1/conversations", messagingRateLimit);
  app.use("/api/v1/support", messagingRateLimit);
  app.use("/api/v1/seller/social-inbox", messagingRateLimit);
  // Auth already has its own policy — do not double-count under the public bucket.
  app.use("/api", (req, res, next) => {
    const path = (req.originalUrl || req.url || "").split("?")[0] || "";
    if (path.startsWith("/api/v1/auth")) return next();
    return publicApiRateLimit(req, res, next);
  });

  app.use("/api", analyticsRouter);
  app.use("/api", moderationRouter);
  app.use("/api", searchRouter);
  app.use("/api", communicationRouter);
  app.use("/api", aiRouter);
  app.use("/api", emiRouter);
  app.use("/api", messagingRouter);
  app.use("/api", logisticsRouter);
  app.use("/api/v1", catalogRouter);
  app.use("/api/v1", dashboardSearchRouter);
  app.use("/api/v1", commerceRouter);
  app.use("/api/v1", commercePaymentsRouter);
  app.use("/api/v1", escrowRouter);
  app.use("/api/v1", adsRouter);
  app.use("/api/v1", cashbookRouter);
  app.use("/api/v1", referenceIdRouter);
  app.use("/api/v1", operationsRouter);
  app.use("/api/v1", bookingRouter);
  app.use("/api/v1", paymentsRouter);
  app.use("/api/v1", authRouter);
  app.use("/api/v1", partnerApplicationRouter);
  app.use("/api/v1", navAttentionRouter);
  app.use("/api/v1", entitlementsRouter);
  app.use("/api/v1", conversationRouter);

  app.get("/api/admin/stats", async (_req, res) => {
    const summary = getAnalyticsSummary("30d");
    res.json({
      totalUsers: 48291,
      activeUsers: 14032,
      sellers: 1847,
      creators: 342,
      products: 94520,
      revenue: summary.orders.revenue,
      engagement: summary.orders.total > 0 ? 12.4 : 0,
      pendingModeration: summary.reviews.pending,
      storefrontOrders: summary.orders.total,
      newLeads: summary.leads.new,
      activeShipments: summary.shipments.pending,
    });
  });

  app.post("/api/products", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "POST",
      path: "/api/products",
      payloadKeys: Object.keys(req.body || {}),
    });
    res.status(201).json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products",
      productId: "prod_" + Math.random().toString(36).substring(2, 11),
      product: req.body,
    });
  });

  app.put("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PUT",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {}),
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body,
    });
  });

  app.patch("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PATCH",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {}),
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body,
    });
  });

  return app;
}

/** Attach the shared error handler last (after optional SPA middleware in local server). */
export function attachErrorHandler(app: Express): void {
  app.use(errorHandler);
}
