// ============================================================
// Semilla del LOTE EN PORTUGUÉS de Cultura Ciclista (v4): primeras
// fichas reales y verificables del lote editorial pt. SOLO obras
// reales (títulos localizados vía Open Library language:por);
// año solo cuando es seguro (null si no). La reseña nace EN
// PORTUGUÉS (regla v4: la reseña va en el idioma de la edición).
// Flujo editorial: se crean como BORRADORES (publicado=false) y el
// equipo publica por oleadas tras revisión.
//   · Si el recurso ya existe, la re-corre NO toca publicado ni
//     destacado (el estado editorial es del equipo, no de la
//     semilla); solo refresca el resto de campos.
// Idempotente: match por titulo+tipo.
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//   bun scripts/semilla-cultura-pt.mjs
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const enc = (s) => encodeURIComponent(s);
const ol = (t, a) => `https://openlibrary.org/search?q=${enc(`${t} ${a}`)}`;

const LOTE_PT = [
  { titulo: "Pedalando na modernidade", tipo: "libro", categorias: ["historia", "personas"], anio: "2008", autor: "André Maia Schetino", pais: "Brasil", extra: "História do ciclismo · São Paulo",
    resena: "História do ciclismo paulista por André Maia Schetino: as primeiras corridas, os clubes e os ciclistas que fizeram da bicicleta esporte e paixão urbana no Brasil." },
  { titulo: "A. B. C. do ciclismo", tipo: "libro", categorias: ["historia", "entrenamiento"], anio: "1964", autor: "Abílio Gil Moreira", pais: "Portugal", extra: "Manual clássico · Edição portuguesa",
    resena: "Manual clássico português do ciclismo (1964): técnica, treino e estrada ensinados com a didática da época. Um documento de como se aprendia a pedalar em Portugal." },
  { titulo: "Ciclismo de estrada", tipo: "libro", categorias: ["ruta", "entrenamiento"], anio: "1988", autor: "Bernard Hinault", pais: "França", extra: "Guia técnica · Edição portuguesa do pentacampeão do Tour",
    resena: "O Badger ensina estrada em português: posição, cadência, subidas e descidas pela voz de quem ganhou cinco Tours. Guia técnica com autoridade absoluta." },
  { titulo: "Treinamento de Ciclismo", tipo: "libro", categorias: ["entrenamiento"], anio: "2014", autor: "Natael Noé Santana", pais: "Brasil", extra: "Guia de treino · Edição brasileira",
    resena: "Guia brasileiro de treinamento ciclístico: periodização, intensidades e prática para quem pedala em solo nacional. Treinar com vocabulário e realidade do ciclismo brasileiro." },
];

async function main() {
  let creados = 0;
  let actualizados = 0;
  for (const r of LOTE_PT) {
    const data = {
      titulo: r.titulo,
      tipo: r.tipo,
      idioma: "pt",
      categorias: r.categorias,
      anio: r.anio,
      autor: r.autor,
      pais: r.pais ?? null,
      extra: r.extra,
      urlExterna: ol(r.titulo, r.autor.split(" ")[0]),
      resena: r.resena,
      proveedor: "editorial",
      // destacado NO se toca; publicado solo en CREATE (borrador).
    };
    const previo = await db.culturaRecurso.findFirst({ where: { titulo: r.titulo, tipo: r.tipo } });
    if (previo) {
      delete data.proveedor; // no revertir la ingesta ya aplicada
      await db.culturaRecurso.update({ where: { id: previo.id }, data });
      actualizados++;
    } else {
      await db.culturaRecurso.create({ data: { ...data, publicado: false, destacado: false } });
      creados++;
    }
  }
  const borradores = await db.culturaRecurso.count({ where: { idioma: "pt", publicado: false } });
  console.log(`Lote PT: ${creados} creados, ${actualizados} actualizados → borradores pt: ${borradores} (el equipo publica por oleadas)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
