import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiHandler, hostedHeaders } from "./server/api.ts";
import { isPublicMode } from "./server/publicMode.ts";

/**
 * Where the server listens. Local defaults are unchanged (127.0.0.1:5182,
 * strict, no extra hosts). The hosted container sets JEV_HOST=0.0.0.0 and
 * JEV_ALLOWED_HOSTS=jev.effortlessinnovations.com. Foreign Host headers still
 * get Vite's 403; there is no "allow all" switch.
 */
const listenHost = process.env.JEV_HOST?.trim() || "127.0.0.1";
const listenPort = (() => {
  const n = Number(process.env.JEV_PORT);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 5182;
})();
const extraAllowedHosts = (process.env.JEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter((h) => h && h !== "true");
const listen = {
  port: listenPort,
  strictPort: true,
  host: listenHost,
  cors: false,
  ...(extraAllowedHosts.length ? { allowedHosts: extraAllowedHosts } : {}),
};

/** Hosted copy (read-only keys or public mode): add CSP and friends to every response, page and API. */
function hostedSecurityHeaders() {
  const hosted =
    isPublicMode(process.env) ||
    /^(1|true|yes)$/i.test((process.env.JEV_READONLY_KEYS ?? "").trim());
  const headers = hostedHeaders();
  return (_req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (hosted) for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    next();
  };
}

function workshopApi(): Plugin {
  // One handler, registered for both `vite` (dev) and `vite preview` (hosted),
  // so the CSRF / JSON-only / 2 MiB / allowedHosts gates are identical in both.
  // The handler lives in server/api.ts so the tests can mount it too.
  const handler = createApiHandler();
  return {
    name: "talk-to-jev-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    // Registered directly (not returned as a post hook) so it runs before
    // preview's static / SPA fallback handler. Security headers go first so
    // they cover the static files too. Not added to `vite dev`, which needs
    // inline scripts for hot reload.
    configurePreviewServer(server) {
      server.middlewares.use(hostedSecurityHeaders());
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), workshopApi()],
  optimizeDeps: {
    include: ["mammoth", "turndown", "pdfjs-dist"],
  },
  server: { ...listen },
  preview: { ...listen },
});
