import type { Express } from "express";

/**
 * Vercel serverless entry — standard Express-on-Vercel pattern with @vercel/node.
 * All /api/* traffic is rewritten here via vercel.json.
 *
 * TEMPORARY RUNTIME BOOT INSTRUMENTATION (SPR-002F) — remove once the
 * production FUNCTION_INVOCATION_FAILED crash is root-caused. Sequential,
 * logged, dynamic imports so the real exception surfaces in Vercel Function
 * logs. No auth/routing/database/business logic is changed — only when each
 * module is loaded and the logging around it.
 */

console.log("[BOOT] STEP 1: Starting api/index.ts");

let app: Express;

try {
  console.log("[BOOT] STEP 2: Loading server/lib/env.ts");
  const { validateEnvironment } = await import("../server/lib/env");

  console.log("[BOOT] STEP 3: Running validateEnvironment()");
  validateEnvironment();

  console.log("[BOOT] STEP 4: Creating database pool + drizzle client (server/db/client.ts)");
  await import("../server/db/client");

  console.log("[BOOT] STEP 5: Importing authRouter");
  await import("../server/authRouter");

  console.log("[BOOT] STEP 6: Importing catalogRouter");
  await import("../server/catalogRouter");

  console.log("[BOOT] STEP 7: Loading server/app.ts");
  const { createApp, attachErrorHandler } = await import("../server/app");

  console.log("[BOOT] STEP 8: Creating Express app (createApp())");
  app = createApp();

  console.log("[BOOT] STEP 9: Attaching error handler");
  attachErrorHandler(app);

  console.log("[BOOT] STEP 10: Startup complete — exporting app");
} catch (error) {
  console.error("[BOOT FAILED]", error);
  console.error(error instanceof Error ? error.stack : new Error(String(error)).stack);
  throw error;
}

export default app;
