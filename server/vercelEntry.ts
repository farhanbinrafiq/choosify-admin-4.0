import { createApp, attachErrorHandler } from "./app";

/**
 * Vercel serverless entry source — bundled by `npm run build` into api/index.js
 * so server/** is inlined inside the Function (no runtime /var/task/server/* imports).
 */
const app = createApp();
attachErrorHandler(app);

export default app;
