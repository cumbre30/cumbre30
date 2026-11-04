import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const email = process.argv[2] ?? 'stats.gps@test.cumbre30.cl';
const u = await db.user.findFirst({ where: { email } });
if (u) {
  await db.session.deleteMany({ where: { userId: u.id } });
  try { await db.ride.deleteMany({ where: { userId: u.id } }); } catch {}
  try { await db.incident.deleteMany({ where: { userId: u.id } }); } catch {}
  try { await db.achievement.deleteMany({ where: { userId: u.id } }); } catch {}
  try { await db.friendship.deleteMany({ where: { OR: [{ userId: u.id }, { friendId: u.id }] } }); } catch {}
  await db.user.delete({ where: { id: u.id } });
  console.log('deleted test user', u.username, '<', email + '>');
} else console.log('no test user found for', email);
await db.$disconnect();
