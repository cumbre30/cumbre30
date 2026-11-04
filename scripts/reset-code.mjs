// Soporte Cumbre30 — imprime el código de restablecimiento vigente
// de un correo para entregarlo al ciclista (WhatsApp/correo) tras
// verificar su identidad.
//   node scripts/reset-code.mjs <email>
// Requiere DATABASE_URL (lee .env del proyecto).
import { PrismaClient } from '@prisma/client';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.error('Uso: node scripts/reset-code.mjs <correo-del-ciclista>');
  process.exit(1);
}
const db = new PrismaClient();
const reset = await db.passwordReset.findFirst({
  where: { email, used: false, expiresAt: { gt: new Date() } },
  orderBy: { createdAt: 'desc' },
});
if (!reset) {
  console.log(`Sin código vigente para ${email}. El ciclista debe solicitarlo en la app (¿Olvidaste tu contraseña?).`);
} else {
  const min = Math.max(1, Math.round((reset.expiresAt.getTime() - Date.now()) / 60000));
  console.log(`Código para ${email}: ${reset.code} (vence en ~${min} min, intentos fallidos: ${reset.attempts})`);
}
await db.$disconnect();
