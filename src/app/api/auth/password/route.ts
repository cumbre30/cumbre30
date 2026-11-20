export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/password - crea la contraseña inicial de una
// cuenta recién creada vía Google. Exige sesión (cookie web o
// Bearer del APK): solo el dueño puede fijarla. Solo funciona
// mientras la cuenta no tenga contraseña (passwordHash vacío);
// cambiar una existente es /api/me/password (Cuenta → Gestionar).
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const me = await getSessionUser(req);
    if (!me) return NextResponse.json({ error: "Sin sesión." }, { status: 401, headers: cors });

    const body = (await req.json()) as { password?: string };
    const password = body.password ?? "";
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400, headers: cors }
      );
    }

    const user = await db.user.findUnique({ where: { id: me.id }, select: { id: true, passwordHash: true } });
    if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401, headers: cors });
    if (user.passwordHash !== "") {
      return NextResponse.json(
        { error: "Tu cuenta ya tiene una contraseña: cámbiala en Cuenta → Gestionar." },
        { status: 409, headers: cors }
      );
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[auth/password] error real:", e);
    return NextResponse.json(
      { error: "No pudimos guardar la contraseña. Intenta de nuevo." },
      { status: 500, headers: cors }
    );
  }
}
