export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/existe - validador previo de la pantalla de
// acceso (petición del usuario): dado un correo, el cliente
// decide si mostrar el formulario de iniciar sesión (sin las
// casillas de Términos/edad, que solo aplican al CREAR cuenta)
// o derivar a «Crear cuenta». La vinculación por correo ya es
// la misma cuenta: Google y contraseña leen los mismos datos.
// Respuesta mínima (existe/tieneContrasena) con rate limit para
// no convertirla en un enumerator de cuentas sin freno.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asegurarColumnasUsuario } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    // Rate limit (C-01): 10 consultas por minuto por IP y correo.
    const limited = guard(req, "existe", email, 10, 60_000, cors);
    if (limited) return limited;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400, headers: cors });
    }

    // Autorreparo v1.13.17 (el SELECT de User incluye las columnas nuevas).
    await asegurarColumnasUsuario();

    const user = await db.user.findUnique({ where: { email }, select: { passwordHash: true } });
    return NextResponse.json(
      { existe: Boolean(user), tieneContrasena: Boolean(user && user.passwordHash) },
      { headers: cors }
    );
  } catch {
    return NextResponse.json({ error: "No pudimos validar el correo. Intenta de nuevo." }, { status: 500, headers: cors });
  }
}
