// ============================================================
// Web Push (Ola 2) — avisos del parque en la web (luces, cierres,
// incidentes). Solo servidor. La tabla PushSub se crea de forma
// idempotente (mismo patrón que Constancia): si el deploy llega
// antes que `prisma db push`, el primer envío se autorrepara.
// ============================================================

import { db } from "@/lib/db";
import webpush from "web-push";
import { asegurarTablaPush } from "@/lib/pushTabla";

export type PushPayload = { title: string; body: string; url?: string };

/** ¿Hay claves VAPID en el entorno? */
export function vapidConfigurado(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

/** Clave pública para el cliente (PushManager.subscribe). */
export function vapidPublica(): string | null {
  return vapidConfigurado() ? process.env.VAPID_PUBLIC_KEY! : null;
}

function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  if (!vapidConfigurado()) return null;
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
    subject: process.env.VAPID_SUBJECT || "mailto:contacto@cumbregeo.cl",
  };
}

/** Envía el payload a todas las suscripciones (o solo a las de un
 *  usuario con opts.userId) y elimina los endpoints caducados
 *  (404/410 que devuelve el servicio de push del navegador). */
export async function enviarPush(
  payload: PushPayload,
  opts?: { userId?: string }
): Promise<{ enviados: number; caducados: number }> {
  const cfg = vapid();
  if (!cfg) throw new Error("PUSH_NO_CONFIG");
  await asegurarTablaPush();

  const subs = (await db.$queryRawUnsafe<{ endpoint: string; p256dh: string; auth: string }[]>(
    opts?.userId
      ? `SELECT endpoint, "p256dh", auth FROM "PushSub" WHERE "userId" = $1`
      : `SELECT endpoint, "p256dh", auth FROM "PushSub"`,
    ...(opts?.userId ? [opts.userId] : [])
  )) as { endpoint: string; p256dh: string; auth: string }[];

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  let enviados = 0;
  let caducados = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 3600 }
        );
        enviados++;
      } catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) {
          try {
            await db.$executeRawUnsafe(`DELETE FROM "PushSub" WHERE endpoint = $1`, s.endpoint);
            caducados++;
          } catch {
            /* limpieza best-effort */
          }
        }
      }
    })
  );
  return { enviados, caducados };
}
