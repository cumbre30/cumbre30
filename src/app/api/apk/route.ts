// ============================================================
// GET /api/apk — descarga directa del APK Android de Cumbre30.
// Sirve el archivo desde download/ (fuera de public/) para que
// nunca quede embebido dentro del build estático del propio APK.
// export-web.sh mueve src/app/api fuera del export estático, así
// que esta ruta solo existe en el servidor web (dev/prod Node).
// ============================================================

import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic"; // nunca estático: binario grande desde disco
export const runtime = "nodejs";

const APK_PATH = path.join(process.cwd(), "download", "Cumbre30-v1.2-debug.apk");
const APK_NAME = "Cumbre30-v1.2-debug.apk";

export async function GET() {
  try {
    const buf = await readFile(APK_PATH);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${APK_NAME}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "APK no disponible" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
