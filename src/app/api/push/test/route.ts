export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

// Envío de prueba (Ola 2): manda un aviso solo a las suscripciones del
// usuario con sesión - el botón "Probar" de Configuración.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { enviarPush } from "@/lib/push";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  try {
    const r = await enviarPush(
      {
        title: "Cumbre30",
        body: "Aviso de prueba: así te avisaremos del parque (luces, cierres y novedades).",
        url: "/",
      },
      { userId: me.id }
    );
    return NextResponse.json({ ok: true, ...r }, { headers: cors });
  } catch (e) {
    if (String((e as Error)?.message) === "PUSH_NO_CONFIG") {
      return NextResponse.json({ error: "PUSH_NO_CONFIG" }, { status: 503, headers: cors });
    }
    return NextResponse.json({ error: "No se pudo enviar" }, { status: 500, headers: cors });
  }
}
