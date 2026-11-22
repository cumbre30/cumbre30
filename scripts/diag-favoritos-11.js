// Consulta puntual: cuántos favoritos recaen sobre los 11 recursos
// fuera de es/en/pt (solo diagnóstico local, no toca datos).
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const TITULOS = [
  "The Rider",
  "Ladri di biciclette (Ladrón de bicicletas)",
  "Les Triplettes de Belleville",
  "Le gamin au vélo (El niño con la bici)",
  "A Sunday in Hell",
  "Stars and Water Carriers",
  "The Impossible Hour",
  "Beijing Bicycle",
  "Wadjda",
  "Wonderful Losers: A Different World",
  "Tour de France: Unchained",
];

(async () => {
  try {
    const r = await db.culturaRecurso.findMany({
      where: { titulo: { in: TITULOS } },
      select: { titulo: true, destacado: true, _count: { select: { favoritos: true } } },
    });
    console.log("encontrados:", r.length, "de", TITULOS.length);
    let fav = 0;
    let dest = 0;
    for (const x of r) {
      fav += x._count.favoritos;
      if (x.destacado) dest++;
      console.log(`  ${x.destacado ? "[destacado]" : "[          ]"} fav=${x._count.favoritos} · ${x.titulo}`);
    }
    console.log("total favoritos sobre los 11:", fav, "· destacados entre los 11:", dest);
  } catch (e) {
    console.error("ERROR COMPLETO:", e.message);
  } finally {
    await db.$disconnect();
  }
})();
