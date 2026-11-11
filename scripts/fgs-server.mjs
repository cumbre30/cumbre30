// Servidor estático mínimo para build-static (export de Next.js).
// Uso: node scripts/fgs-server.mjs [root] [port]
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || "build-static");
const PORT = Number(process.argv[3] || 81);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".gpx": "application/gpx+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/") urlPath = "/index.html";
    let file = path.join(ROOT, path.normalize(urlPath));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    let stat = await fs.stat(file).catch(() => null);
    if (stat?.isDirectory()) {
      file = path.join(file, "index.html");
      stat = await fs.stat(file).catch(() => null);
    }
    if (!stat) {
      // rutas de Next (p.ej. /pro) → archivo + ".html"
      const alt = file + ".html";
      const st2 = await fs.stat(alt).catch(() => null);
      if (!st2) {
        res.writeHead(404).end("404");
        return;
      }
      file = alt;
      stat = st2;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(500).end("500");
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`[fgs-server] ${ROOT} en http://127.0.0.1:${PORT}`));
