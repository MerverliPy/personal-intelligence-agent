// ---------------------------------------------------------------------------
// PWA static assets route (PIA-MUR-D-004-IMPL commit 8)
// ---------------------------------------------------------------------------
// Serves the PWA shell assets that live in apps/web/public/:
//   - /manifest.webmanifest
//   - /sw.js
//   - /icon-192.png
//   - /icon-512.png
//   - /apple-touch-icon.png
//   - /maskable-icon-512.png
//
// We hand-roll a tiny static-file route because the PIA API does not
// depend on @fastify/static (which would pull in a new runtime
// dependency). The assets are immutable (they're versioned by content
// hash when we ship to production); for now we send a short
// Cache-Control. No auth required; no tenant scope; read-only.
//
// Public paths are validated against an allow-list so a malicious
// request cannot escape the public/ directory.
// ---------------------------------------------------------------------------
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const ASSETS: Record<string, { file: string; contentType: string }> = {
  '/manifest.webmanifest': { file: 'manifest.webmanifest', contentType: 'application/manifest+json' },
  '/sw.js': { file: 'sw.js', contentType: 'application/javascript; charset=utf-8' },
  '/icon-192.png': { file: 'icon-192.png', contentType: 'image/png' },
  '/icon-512.png': { file: 'icon-512.png', contentType: 'image/png' },
  '/apple-touch-icon.png': { file: 'apple-touch-icon.png', contentType: 'image/png' },
  '/maskable-icon-512.png': { file: 'maskable-icon-512.png', contentType: 'image/png' },
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From apps/api/src/routes/ to apps/web/public/ is three levels up + web/public.
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', '..', 'web', 'public');

const pwaAssetsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  for (const [route, meta] of Object.entries(ASSETS)) {
    app.get(route, async (_request, reply) => {
      const filePath = path.join(PUBLIC_DIR, meta.file);
      try {
        const data = await fs.readFile(filePath);
        // Use raw response so Fastify does not try to JSON-encode the
        // buffer. Setting content-type and content-length via
        // reply.header avoids the onSend hook's default-JSON path.
        reply.raw.setHeader('content-type', meta.contentType);
        reply.raw.setHeader('content-length', String(data.length));
        reply.raw.setHeader('cache-control', 'public, max-age=3600');
        reply.raw.statusCode = 200;
        reply.raw.end(data);
        // Returning reply.send() with no payload signals Fastify the
        // response is already sent (avoids double-send).
        return reply;
      } catch {
        reply.raw.setHeader('content-type', 'text/plain; charset=utf-8');
        reply.raw.statusCode = 404;
        reply.raw.end('Not found');
        return reply;
      }
    });
  }
};

export default pwaAssetsRoutes;
