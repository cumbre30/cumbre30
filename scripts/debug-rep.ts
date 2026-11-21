import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
async function main() {
  const ruta = await db.route.findFirst({ where: { nombre: "Ruta comunidad" }, select: { id: true } });
  if (!ruta) { console.log("sin ruta (limpieza)"); return; }
  const reps = await db.routeReport.findMany({ where: { routeId: ruta.id }, select: { motivo: true, peso: true, estado: true, reporterId: true, clasificacion: true } });
  const log = await db.moderationLog.findFirst({ where: { targetId: ruta.id, accion: "autohide" }, select: { detalle: true } });
  console.log(JSON.stringify({ reps, log: log?.detalle }, null, 1));
}
main().finally(() => db.$disconnect());
