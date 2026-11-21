import { PrismaClient } from "@prisma/client";
import { pesoReportante } from "../src/lib/comunidad";
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
async function main() {
  const vet = await db.user.findUnique({ where: { email: "fase-e-vet@test.local" }, select: { id: true, createdAt: true } });
  if (!vet) { console.log("vet no existe (limpieza corrió)"); return; }
  const [confirmadas, rides, descartadas] = await Promise.all([
    db.routeReport.count({ where: { reporterId: vet.id, estado: "confirmada" } }),
    db.ride.count({ where: { userId: vet.id } }),
    db.routeReport.count({ where: { reporterId: vet.id, estado: "descartada" } }),
  ]);
  const dias = Math.floor((Date.now() - vet.createdAt.getTime()) / 86_400_000);
  console.log({ dias, confirmadas, rides, descartadas, peso: pesoReportante({ diasCuenta: dias, contribucionesConfirmadas: confirmadas, rides, descartadas }) });
}
main().finally(() => db.$disconnect());
