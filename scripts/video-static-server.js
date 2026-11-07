// Servidor estático mínimo para build-static (Next export) — solo para
// la grabación del video de demostración. MIME correcto para .mjs/.wasm/.pbf.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = "/home/z/my-project/build-static";
const PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".pbf": "application/vnd.mapbox-vector-tile",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    // Next export: /ruta → /ruta.html si no existe como archivo
    let file = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) file = path.join(ROOT, "index.html");
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const alt = file + ".html";
      if (fs.existsSync(alt)) file = alt;
      else file = path.join(ROOT, "index.html");
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`static server on http://localhost:${PORT}`));
