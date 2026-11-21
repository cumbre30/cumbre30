// ============================================================
// In-vivo Fase F · semillas: usuario con sesión + ruta pública cerca
// del punto de geolocalización del ensayo. Imprime { token, rutaId }.
// Ejecutar: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cumbre30 \
//   npx tsx scripts/invivo-fase-f-seed.ts
// ============================================================
import { PrismaClient } from "@prisma/client";
import { POST as CREAR_RUTA } from "../src/app/api/routes/route";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

function req(method: string, path: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function main(): Promise<void> {
  await db.user.deleteMany({ where: { email: { startsWith: "fase-f-vivo" } } });
  const user = await db.user.create({ data: { email: "fase-f-vivo@test.local", username: "faseFVivo", passwordHash: "x" } });
  const token = "tok-vivo-F-" + Date.now();
  await db.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 86_400_000) } });

  const creada = await CREAR_RUTA(req("POST", "/api/routes", token, {
    nombre: "Ruta Vivo F pública",
    modalidad: "pavimento",
    coords: [
      { lat: -33.4372, lon: -70.6418 },
      { lat: -33.4360, lon: -70.6395 },
      { lat: -33.4348, lon: -70.6372 },
    ],
    ele: { gainM: 120, lossM: 100, minEle: 500, maxEle: 620 },
    eleFuente: "gpx",
  }));
  const d = (await creada.json()) as Record<string, unknown>;
  if (creada.status !== 200 || typeof d.id !== "string") {
    console.error("FALLO al crear ruta pública:", creada.status, d);
    process.exit(1);
  }
  console.log(JSON.stringify({ token, rutaId: d.id }));
}

main().finally(() => db.$disconnect());
