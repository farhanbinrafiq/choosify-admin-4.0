import { createApp, attachErrorHandler } from "../server/app";

/**
 * Vercel serverless entry — standard Express-on-Vercel pattern with @vercel/node.
 * All /api/* traffic is rewritten here via vercel.json.
 */
const app = createApp();
attachErrorHandler(app);

export default app;
