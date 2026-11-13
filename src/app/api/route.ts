import { NextResponse } from "next/server";

// Estáctica para compatibilizar `output: export` (empaquetado APK con Capacitor).
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}
