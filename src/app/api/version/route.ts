// Ruta dinámica: solo el deploy web la sirve (el export del APK
// excluye /api por completo — scripts/build-apk.mjs).
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { APP_VERSION, APP_VERSION_CODE, APK_FILE_NAME } from "@/lib/appVersion";

// Fuente de «última versión» para el chequeo de actualizaciones del
// APK (lib/actualizacion.ts, v1.12.4). Route handler y no archivo
// estático: vive compilado dentro del deploy, así que siempre está
// en sincronía con appVersion.ts (fuente única) y no depende del
// servido de public/. El APK lo consulta con CORS abierto (el
// WebView corre en otro origen). En el export estático del APK esta
// ruta no existe (export-web.sh excluye src/app/api) y no se usa:
// el APK consulta la web desplegada, nunca su propio bundle.

const URL_DESCARGA =
  "https://github.com/cumbre30/cumbre30/releases/latest/download/cumbre30-latest.apk";

export async function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      code: APP_VERSION_CODE,
      apk: APK_FILE_NAME,
      url: URL_DESCARGA,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
