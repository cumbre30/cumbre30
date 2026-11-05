import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

// ============================================================
// DELETE /api/auth/account — baja definitiva de la cuenta.
// Exigida por Google Play (eliminación de cuenta desde la app y
// desde la web: /eliminar-cuenta). El schema tiene onDelete:
// Cascade en todas las relaciones del User, así que una sola
// eliminación borra sesiones, rides, códigos de reset y amistades.
// ============================================================

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  await db.user.delete({ where: { id: user.id } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
