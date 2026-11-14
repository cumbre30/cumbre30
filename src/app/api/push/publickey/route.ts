export const dynamic = "force-dynamic";

// Clave pública VAPID para el cliente (PushManager.subscribe). Sin
// claves configuradas responde 503: el cliente muestra "no disponible".

import { NextResponse } from "next/server";
import { vapidPublica } from "@/lib/push";

export async function GET() {
  const publicKey = vapidPublica();
  if (!publicKey) return NextResponse.json({ error: "PUSH_NO_CONFIG" }, { status: 503 });
  return NextResponse.json({ publicKey });
}
