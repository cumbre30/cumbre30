import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const u = await db.user.findFirst({ where: { email: 'test.nav@cumbre30.cl' } });
if (u) {
  await db.session.deleteMany({ where: { userId: u.id } });
  await db.ride?.deleteMany?.({ where: { userId: u.id } }).catch?.(()=>{});
  try { await db.ride.deleteMany({ where: { userId: u.id } }); } catch {}
  try { await db.incident.deleteMany({ where: { userId: u.id } }); } catch {}
  try { await db.achievement.deleteMany({ where: { userId: u.id } }); } catch {}
  await db.user.delete({ where: { id: u.id } });
  console.log('deleted test user', u.username);
} else console.log('no test user found');
await db.$disconnect();
