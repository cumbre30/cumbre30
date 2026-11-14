// ============================================================
// GET /api/apk - descarga directa del APK Android de Cumbre30.
// Sirve el archivo desde download/ (fuera de public/) para que
// nunca quede embebido dentro del build estático del propio APK.
// export-web.sh mueve src/app/api fuera del export estático, así
// que esta ruta solo existe en el servidor web (dev/prod Node).
//
// v1.3.6: ya NO hay nombre hardcodeado (causaba que el botón de
// la app sirviera para siempre la 1.3.3). Orden de búsqueda:
//   1. APK_FILE_NAME declarado en src/lib/appVersion.ts
//   2. El *.apk más reciente por fecha de modificación en
//      apk-store/ o download/ (fallback a prueba de olvidos).
// ============================================================

import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { APK_FILE_NAME } from "@/lib/appVersion";

export const dynamic = "force-dynamic"; // nunca estático: binario grande desde disco
export const runtime = "nodejs";

const APK_DIRS = [
  path.join(process.cwd(), "apk-store"),
  path.join(process.cwd(), "download"),
];

/** Devuelve el APK a servir: primero el declarado, si no el más reciente que exista. */
async function resolveApk(): Promise<{ file: string; p: string } | null> {
  const errors: string[] = [];

  // 1) El nombre declarado en appVersion.ts, en cada carpeta candidata.
  for (const dir of APK_DIRS) {
    const p = path.join(dir, APK_FILE_NAME);
    try {
      await stat(p);
      return { file: APK_FILE_NAME, p };
    } catch (e) {
      errors.push(`${p}: ${(e as Error)?.message ?? "error"}`);
    }
  }

  // 2) Fallback: el *.apk más reciente por mtime (evita servir versiones viejas).
  let best: { file: string; p: string; mtime: number } | null = null;
  for (const dir of APK_DIRS) {
    try {
      const entries = await readdir(dir);
      for (const f of entries) {
        if (!f.toLowerCase().endsWith(".apk")) continue;
        const p = path.join(dir, f);
        try {
          const s = await stat(p);
          if (!best || s.mtimeMs > best.mtime) best = { file: f, p, mtime: s.mtimeMs };
        } catch (e) {
          errors.push(`${p}: ${(e as Error)?.message ?? "error"}`);
        }
      }
    } catch (e) {
      errors.push(`${dir}: ${(e as Error)?.message ?? "error"}`);
    }
  }
  if (best) return { file: best.file, p: best.p };
  if (errors.length) console.error("[/api/apk] sin APK disponible:", errors.join(" | "));
  return null;
}

/**
 * En producción (Vercel) el APK de ~54 MB no viaja dentro de la función
 * serverless: se hospeda en GitHub Releases y esta ruta redirige ahí
 * (APK_DOWNLOAD_URL). Sin la variable, redirige por defecto al asset
 * cumbre30-latest.apk del Release "latest" del repo cumbre30/cumbre30 —
 * el workflow build-apk.yml lo regenera en cada tag v*, así que la
 * descarga siempre sirve la versión vigente sin tocar código ni envs.
 */
export async function GET() {
  const remote =
    process.env.APK_DOWNLOAD_URL ||
    "https://github.com/cumbre30/cumbre30/releases/latest/download/cumbre30-latest.apk";
  if (remote) {
    return new Response(null, {
      status: 302,
      headers: { Location: remote, "Cache-Control": "no-store" },
    });
  }
  const apk = await resolveApk();
  if (!apk) {
    return new Response(JSON.stringify({ error: "APK no disponible" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const buf = await readFile(apk.p);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${apk.file}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "APK no legible", detail: (e as Error)?.message ?? "error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
