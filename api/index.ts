import { createApp, attachErrorHandler } from "../server/app";

/**
 * Vercel serverless entry — standard Express-on-Vercel pattern with @vercel/node.
 * All /api/* traffic is rewritten here via vercel.json.
 *
 * Static imports (not dynamic) so Vercel's Node File Trace packages server/**
 * (and its transitive deps) into the Function at /var/task.
 */
const app = createApp();
attachErrorHandler(app);

export default app;
