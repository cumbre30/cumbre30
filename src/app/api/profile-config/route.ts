export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Remote Config de los techos del Perfil Ciclista (v1.13.17): permite
// recalibrar los denominadores de los 6 ejes (25 m/km · 1100 m/h ·
// 90 km · 36 · 52 km/h · 20 km off-road) con telemetría real SIN
// publicar release. La escritura queda en el dueño del proyecto con
// la misma clave de /api/licencia (x-admin-key, comparación timing
// safe); la lectura es pública: no es dato personal y PerfilTab la
// puede usar para mostrar metodología.
//
//   GET /api/profile-config            → techos vigentes (BD + defaults)
//   PUT /api/profile-config            → lote parcial de claves
//        -H "x-admin-key: $ADMIN_KEY"  {"techoOffroad": 15}

import { NextResponse } from "next/server";
import { adminKeysEqual } from "@/lib/adminKey";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { asegurarTablaConfig, cargarTechos, guardarTechos, TECHO_DEFAULTS, TECHO_RANGOS } from "@/lib/profileConfig";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  try {
    const techos = await cargarTechos();
    return NextResponse.json({ techos, defaults: TECHO_DEFAULTS, rangos: TECHO_RANGOS }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No pudimos leer la configuración." }, { status: 500, headers: cors });
  }
}

export async function PUT(req: Request) {
  const cors = corsHeaders(req);
  const adminKey = process.env.ADMIN_KEY ?? "";
  if (!adminKey || !adminKeysEqual(req.headers.get("x-admin-key") ?? "", adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: cors });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400, headers: cors });
    }
    await asegurarTablaConfig();
    const res = await guardarTechos(body);
    if (!res) {
      return NextResponse.json(
        { error: "Ninguna clave válida. Claves: " + Object.keys(TECHO_DEFAULTS).join(", ") },
        { status: 400, headers: cors }
      );
    }
    const techos = await cargarTechos();
    return NextResponse.json({ ok: true, guardado: res.guardado, rechazado: res.rechazado, techos }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No pudimos guardar la configuración." }, { status: 500, headers: cors });
  }
}
