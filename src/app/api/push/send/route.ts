export const dynamic = "force-dynamic";

// Envío masivo de avisos del parque (Ola 2): lo ejecuta el
// administrador con curl, protegido por PUSH_ADMIN_KEY:
//   curl -X POST https://cumbregeo.cl/api/push/send \
//        -H "x-admin-key: $PUSH_ADMIN_KEY" \
//        -H "Content-Type: application/json" \
//        -d '{"title":"Parquemet","body":"Las luces se encienden a las 20:15","url":"/"}'
// Útil al publicar un aviso operativo nuevo en avisos.json.

import { NextResponse } from "next/server";
import { enviarPush } from "@/lib/push";
import { adminKeysEqual } from "@/lib/adminKey";

export async function POST(req: Request) {
  const adminKey = process.env.PUSH_ADMIN_KEY;
  // C-04: comparación timing-safe de la clave de administración.
  if (!adminKey || !adminKeysEqual(req.headers.get("x-admin-key") ?? "", adminKey)) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    body?: string;
    url?: string;
  } | null;
  if (!body?.title || !body?.body) {
    return NextResponse.json({ error: "Faltan title y body" }, { status: 400 });
  }
  try {
    const r = await enviarPush({ title: body.title, body: body.body, url: body.url ?? "/" });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (String((e as Error)?.message) === "PUSH_NO_CONFIG") {
      return NextResponse.json({ error: "PUSH_NO_CONFIG" }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo enviar" }, { status: 500 });
  }
}
