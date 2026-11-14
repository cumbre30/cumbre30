// Tabla PushSub: DDL idempotente compartido por las rutas de push.
// Separado de lib/push.ts para que el import de web-push (solo
// servidor pesado) quede solo donde se envía; aquí igual da lo mismo,
// pero mantener un solo punto de creación evita divergencias.

import { db } from "@/lib/db";

/** CREATE TABLE IF NOT EXISTS (espejo del modelo PushSub de Prisma). */
export async function asegurarTablaPush(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PushSub" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "endpoint" TEXT NOT NULL,
       "p256dh" TEXT NOT NULL,
       "auth" TEXT NOT NULL,
       "userId" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PushSub_endpoint_key" ON "PushSub"("endpoint")`
  );
}
