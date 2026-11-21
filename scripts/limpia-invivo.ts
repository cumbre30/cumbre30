// Limpieza del PostgreSQL de desarrollo: elimina los usuarios semilla
// del ensayo in-vivo del muro (muro-invivo-*, dbg-*, debug-x) y con
// ellos, por cascada, sus rutas, experiencias y sesiones.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5433/cumbre30" } } });

async function main(): Promise<void> {
  const u = await db.user.findMany({
    where: { OR: [{ email: { startsWith: "muro-invivo-" } }, { email: { startsWith: "dbg-" } }, { email: "debug-x@test.local" }] },
    select: { id: true },
  });
  for (const x of u) await db.user.delete({ where: { id: x.id } });
  console.log("limpieza:", u.length, "usuarios de prueba eliminados");
  await db.$disconnect();
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
