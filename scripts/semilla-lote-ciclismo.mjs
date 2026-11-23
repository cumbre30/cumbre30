// ============================================================
// Semilla del LOTE CICLISMO de Cultura Ciclista (v4): cosecha de
// dos fuentes pedidas por el equipo editorial —
//   · Buscalibre «Ciclismo general y cicloturismo» (cosecha vía
//     índice de búsqueda: el sitio está detrás de un CAPTCHA
//     humano que no se automatiza) → 10 libros en español,
//     enlazados a Buscalibre Chile por la política v4.2.
//   · Amazon Best Sellers de ciclismo (node 16544, top ~80) →
//     25 libros en inglés, enlazados a Amazon por la política v4.2.
// Reglas v4 respetadas:
//   · SOLO obras reales; autor y año verificados (Open Library o
//     el listado de origen); año null cuando no es seguro.
//   · La reseña nace EN EL IDIOMA DE LA EDICIÓN (es/es, en/en) y
//     es texto propio de Cumbre30 — nunca copiado de proveedores.
//   · Se crean como BORRADORES (publicado=false, destacado=false):
//     el equipo publica por oleadas tras revisión editorial.
//   · Idempotente: match por titulo+tipo; el re-run NO toca
//     publicado/destacado ni el proveedor ya aplicado.
// Uso (local):  DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//               node scripts/semilla-lote-ciclismo.mjs
// Uso (Neon):   DATABASE_URL_NEON=$(cat /tmp/neonurl) \
//               node scripts/semilla-lote-ciclismo.mjs --neon
// ============================================================
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const enc = (s) => encodeURIComponent(s);
const buscalibre = (t, a) => `https://www.buscalibre.cl/libros/search?q=${enc(`${t} ${a}`)}`;
const amazon = (t, a) => `https://www.amazon.com/s?k=${enc(`${t} ${a}`)}`;

// ---------- reseñas y categorías propias del lote (editorial Cumbre30) ----------
// clave: rank EN (Amazon) o prefijo de slug ES (Buscalibre)
const EDITORIAL = {
  // ---- Buscalibre «Ciclismo general y cicloturismo» (es) ----
  "cicloturismo-bikepacking": {
    categorias: ["ruta", "aventura"],
    extra: "Guía · 12 rutas circulares de 3-4 etapas por España · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Doce rutas circulares por toda España, seleccionadas entre los mejores viajes de Juanjo Alonso, pensadas para pedalearse en tres o cuatro etapas sin apoyo. Bikepacking práctico: carga ligera, itinerario cerrado y la geografía peninsular como escenario.",
  },
  "viajar-en-bici": {
    categorias: ["aventura", "ruta"],
    extra: "Manual práctico de cicloturismo de alforjas · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "El manual práctico del cicloturismo clásico con alforjas: equipaje, planificación, etapas y rutina de viaje explicados por quienes las han llevado lejos. La entrada más directa para quien quiere salir a pedalear con lo puesto.",
  },
  "ciclomontanismo": {
    categorias: ["mtb", "aventura"],
    extra: "Viajar en bicicleta por las montañas · Referente del género en español · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Técnica, material y actitud para viajar en bicicleta por la montaña, del referente del género en español. El libro que convirtió el ciclomontañismo en una disciplina con método propio.",
  },
  "crea-tu-entrenamiento": {
    categorias: ["entrenamiento"],
    extra: "Guía de entrenamiento · Independently Published · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Sesiones de intervalos diseñadas en torno a la agenda real de quien trabaja y pedalea, con sesiones cortas y progresiones accesibles. Entrenamiento por intervalos explicado sin jerga para ciclistas con poco tiempo.",
  },
  "manual-de-la-bicicleta": {
    categorias: ["entrenamiento"],
    extra: "Edición española · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Manual general de técnica y mecánica de la bicicleta en su edición española: elegir la máquina, cuidarla y sacar todo su partido. El ABC del ciclista, del manual al camino.",
  },
  "guia-general-del-ciclismo": {
    categorias: ["historia", "entrenamiento"],
    extra: "Guía rigurosamente documentada para competición y cicloturismo · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Una guía manejable, clara y precisa del ciclismo en todas sus formas, de la competición al cicloturismo, rigurosamente documentada por su autor francés. Referencia clásica del deporte en español.",
  },
  "curso-de-mountain-bike": {
    categorias: ["mtb", "entrenamiento"],
    extra: "Método progresivo de los autores italianos · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Curso progresivo de técnica en montaña, del control básico al terreno técnico, con el método de Dossena y Orler. Aprendizaje estructurado para pasar del camino al sendero sin sustos.",
  },
  "ciclismo-entrenamiento-avanzado": {
    categorias: ["entrenamiento"],
    extra: "Del entrenador coautor de Training and Racing with a Power Meter · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Entrenamiento avanzado de la mano de Hunter Allen, el entrenador que codificó el trabajo con medidores de potencia. Periodización, datos y planificación para ciclistas que compiten.",
  },
  "manual-de-reparacion-de-bicicletas": {
    categorias: ["entrenamiento"],
    extra: "Manual clásico de mecánica (edición mexicana) · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Manual clásico de mecánica en español, con el paso a paso de ajuste y reparación de la bicicleta. Referencia veterana que sigue resolviendo la avería esencial sin taller.",
  },
  "ciclismo-para-ninos": {
    categorias: ["aventura", "personas"],
    extra: "Introducción al ciclismo para lectores pequeños · Categoría Buscalibre «Ciclismo general y cicloturismo»",
    resena: "Introducción al ciclismo pensada para los más pequeños y sus familias: seguridad, técnica básica y juego sobre dos ruedas. La puerta de entrada al pedaleo en la biblioteca.",
  },
  // ---- Amazon Best Sellers ciclismo (en) ----
  1: {
    categorias: ["ruta", "aventura"],
    extra: "National Geographic · Best seller Amazon ciclismo #1 (nota 4.8, 168 valoraciones)",
    resena: "National Geographic's curated atlas of the world's ultimate rides, from alpine passes to coastal classics, told with the eye of a veteran travel writer. A bucket list you can actually ride.",
  },
  2: {
    categorias: ["ruta", "aventura"],
    extra: "Lonely Planet · Best seller Amazon ciclismo #2 (nota 4.8)",
    resena: "Two hundred rides across two continents, from Patagonian gravel to Canadian rail trails, in Lonely Planet's practical itinerary format. The regional companion to the Epic Bike Rides series already in the library.",
  },
  5: {
    categorias: ["personas", "entrenamiento"],
    extra: "Memorias · Best seller Amazon ciclismo #5 (nota 4.5)",
    resena: "The memoir of the washed-up lawyer who became an ultraman at forty: sobriety, plant-based fueling and midlife reinvention. The best-known 'it's never too late' story in endurance sport.",
  },
  7: {
    categorias: ["aventura", "personas"],
    extra: "Crónica de viaje · Best seller Amazon ciclismo #7 (nota 4.5)",
    resena: "Sara Dykman pedaled 10,201 miles alongside the monarch butterfly migration, round trip from Mexico to Canada and back. Adventure writing that turns a migration into a moving border of habitat and people.",
  },
  8: {
    categorias: ["personas", "historia"],
    extra: "Ensayo de viaje · Best seller Amazon ciclismo #8 (nota 4.3)",
    resena: "The Talking Heads founder rides a folding bike through the world's cities and writes what he sees: urbanism, music, politics, strangers. Travel essays at the pace of a bicycle.",
  },
  13: {
    categorias: ["aventura", "personas"],
    extra: "Memorias de viaje · Best seller Amazon ciclismo #13 (nota 4.5)",
    resena: "A lawyer quits the job that fit and rides from Oregon to Patagonia, asking what a life is for along the way. The modern American bike-travel memoir that found a huge readership.",
  },
  15: {
    categorias: ["entrenamiento"],
    extra: "Joe Friel · Guía de entrenamiento · Best seller Amazon ciclismo #15 (nota 4.3)",
    resena: "The coach behind the Training Bible adapts intensity, recovery and strength work to the aging athlete, with evidence instead of folklore. The training manual for the library's masters riders.",
  },
  16: {
    categorias: ["mtb", "entrenamiento"],
    extra: "Mecánica MTB, 7ª edición · Best seller Amazon ciclismo #16 (nota 4.8)",
    resena: "The world's best-selling mountain bike repair guide, updated for modern MTB standards and suspension service. Zinn's exploded diagrams keep any rider wrenching at home.",
  },
  17: {
    categorias: ["entrenamiento", "personas"],
    extra: "Psicología deportiva · Best seller Amazon ciclismo #17 (nota 4.5)",
    resena: "A sport psychologist and a coach tackle the mental game endurance athletes actually face: anxiety, self-talk, motivation. Evidence-based mental training with a no-nonsense voice.",
  },
  18: {
    categorias: ["personas", "historia"],
    extra: "Biografía · Best seller Amazon ciclismo #18 (nota 4.4)",
    resena: "The first major biography of the Slovenian who re-ruled the Tour, tracking the rise from a small cycling family to five yellow jerseys. Contemporary canon for the library's history shelf.",
  },
  25: {
    categorias: ["ruta", "aventura"],
    extra: "Crónica de viaje · Best seller Amazon ciclismo #25 (nota 4.2)",
    resena: "A bicycle journey down Europe's great river, from the Alps to the North Sea, through castles, industry and villages. Travel writing that shows how a river organizes a continent.",
  },
  29: {
    categorias: ["historia", "personas"],
    extra: "Fotografía de ciclismo en ruta · Best seller Amazon ciclismo #29 (nota 4.4)",
    resena: "The Flemish photographer's years of road-race imagery: rain, mud, faces at the limit. The sport's brutal beauty in photographs, from the library's visual shelf.",
  },
  30: {
    categorias: ["entrenamiento", "personas"],
    extra: "Psicología del rendimiento · Best seller Amazon ciclismo #30 (nota 4.4)",
    resena: "Fitzgerald builds the case that racing is decided in the brain, retelling famous endurance moments through psychobiology. Sports psychology for riders, told as stories.",
  },
  51: {
    categorias: ["historia", "ruta"],
    extra: "Fotografía · Best seller Amazon ciclismo #51 (nota 4.8)",
    resena: "A photographer's pilgrimage to the sport's legendary climbs — Alpe d'Huez, Stelvio, Ventoux — with portraits of the riders who made them famous. Coffee-table cycling at its heaviest.",
  },
  53: {
    categorias: ["aventura", "personas"],
    extra: "Memorias · Best seller Amazon ciclismo #53 (nota 4.8)",
    resena: "A scientist quits alcohol and bikes across America counting birds: a bicycle big year of rehab and discovery. Nature, addiction and adventure in one saddlebag.",
  },
  56: {
    categorias: ["ruta", "aventura"],
    extra: "Crónica + fotografía · Best seller Amazon ciclismo #56 (nota 4.9)",
    resena: "A designer quits Amsterdam and rides to Singapore through a year of landscapes, documented with unhurried photography and route notes. The long, slow journey as a book object.",
  },
  58: {
    categorias: ["personas"],
    extra: "Memorias · Best seller Amazon ciclismo #58 (nota 4.6)",
    resena: "The retired pro's funny, frank memoir of the domestic racing grind: watts, contracts and chasing the pro dream just short of it. Gaimon is the library's comic voice.",
  },
  59: {
    categorias: ["entrenamiento"],
    extra: "Nutrición deportiva, 2ª edición · Best seller Amazon ciclismo #59 (nota 4.5)",
    resena: "The endurance athlete's guide to body composition: fueling, timing and seasonality rather than crash diets. The nutrition companion to the library's training shelf.",
  },
  60: {
    categorias: ["entrenamiento"],
    extra: "Salud cardiovascular · Best seller Amazon ciclismo #60 (nota 4.5)",
    resena: "What extreme endurance can do to the heart — arrhythmias, athlete's heart — examined with cardiologists, plus how to train and test smarter. The library's health check for hard riders.",
  },
  64: {
    categorias: ["aventura", "personas"],
    extra: "Crónica de viaje · Best seller Amazon ciclismo #64 (nota 4.7)",
    resena: "The Rush drummer rides alone through West Africa between tour legs, writing about biking, music and being a stranger. An odd, beloved book by a rock legend who really pedaled.",
  },
  68: {
    categorias: ["personas", "historia"],
    extra: "Memorias · Best seller Amazon ciclismo #68 (nota 4.5)",
    resena: "An American teenager rides the Belgian kermesse circuit in the late eighties: mud, contracts and the unglamorous pro life. The antithesis of the heroic cycling memoir.",
  },
  71: {
    categorias: ["aventura", "personas"],
    extra: "Memorias · Best seller Amazon ciclismo #71 (nota 4.7)",
    resena: "The Southern storyteller turns a really long bike ride into a story about grief, promises and love. An easy-riding memoir about the miles between people.",
  },
  73: {
    categorias: ["ruta", "aventura"],
    extra: "Lonely Planet · Best seller Amazon ciclismo #73 (nota 4.7)",
    resena: "Europe's classic and hidden rides in itinerary form, from Norwegian fjords to the Dolomites, with the usual Lonely Planet practical detail. The continent-sized companion to the series.",
  },
  76: {
    categorias: ["historia"],
    extra: "Historia cultural · Best seller Amazon ciclismo #76 (nota 4.2)",
    resena: "A sweeping cultural history of the bicycle — music, war, climate, class — by a critic who rides. Rosen makes two wheels the lens for two centuries.",
  },
  80: {
    categorias: ["entrenamiento"],
    extra: "Guía para ciclistas +40 · Best seller Amazon ciclismo #80 (nota 4.5)",
    resena: "A bike-fitter's guide to the over-forty rider: physiology, fit, testing and honest advice on aging fast. The technical manual for the library's masters shelf.",
  },
};

// ---------- normalización del lote desde la cosecha curada ----------
const PREFIJOS_ES = Object.keys(EDITORIAL).filter(k => isNaN(Number(k)));
const cand = JSON.parse(fs.readFileSync(new URL("./data/lote-ciclismo-candidatos.json", import.meta.url)));
const lote = [];
for (const c of cand) {
  const es = c.idioma === "es";
  let ed = null;
  if (es) {
    const slug = (c.url_buscalibre || "").replace("https://www.buscalibre.cl/libro-", "");
    ed = EDITORIAL[PREFIJOS_ES.find(k => slug.startsWith(k))] || null;
  } else {
    ed = EDITORIAL[Number((c.fuente.match(/#(\d+)/) || [])[1])] || null;
  }
  if (!ed) { console.error("SIN EDICIONAL:", c.titulo); process.exit(1); }
  const autor1 = (c.autor || "").split(" (")[0];
  lote.push({
    titulo: c.titulo, tipo: c.tipo, idioma: c.idioma, categorias: ed.categorias,
    anio: c.anio, autor: c.autor, pais: null, extra: ed.extra,
    urlExterna: es ? buscalibre(c.titulo, autor1) : amazon(c.titulo, autor1),
    resena: ed.resena, proveedor: es ? "buscalibre.cl" : "amazon.com",
    portada: c.portada || null,
  });
}
console.log(`lote listo: ${lote.length} registros (${lote.filter(x => x.idioma === "es").length} es + ${lote.filter(x => x.idioma === "en").length} en)`);
// export para los entregables de revisión editorial (CSV/informe)
fs.writeFileSync(new URL("./data/lote-ciclismo-final.json", import.meta.url), JSON.stringify(lote, null, 1));

// ---------- conexión (local o Neon: el sandbox no enruta IPv6 de
// *.neon.tech, así que resolvemos A del host y conectamos por IPv4
// fijando servername para el SNI; TLS sin verificación de nombre) ----------
async function conectar() {
  if (process.argv.includes("--neon")) {
    const orig = process.env.DATABASE_URL_NEON;
    if (!orig) throw new Error("DATABASE_URL_NEON no definida");
    const limpio = orig.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
    const hostname = new URL(limpio).hostname;
    // lookup (no resolve4): el DNS del sandbox solo resuelve getaddrinfo
    // para *.neon.tech; la consulta A pura vuelve vacía.
    const addrs = await dns.lookup(hostname, { all: true, family: 4 });
    if (!addrs.length) throw new Error(`Sin IPv4 para ${hostname}`);
    const c = new Client({
      connectionString: limpio.replace(hostname, addrs[0].address),
      ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: hostname },
      connectionTimeoutMillis: 30000,
    });
    await c.connect();
    return c;
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres@127.0.0.1:5433/cumbre30" });
  await c.connect();
  return c;
}

function nuevoId() {
  const base36 = (n) => n.toString(36);
  const cuerpo = base36(Date.now()) + randomBytes(8).toString("hex").replace(/[g-z]/g, (c) => base36(parseInt(c, 36) % 36));
  return ("c" + cuerpo).slice(0, 25);
}

(async () => {
  const db = await conectar();
  let creados = 0, actualizados = 0;
  for (const r of lote) {
    const prev = await db.query(`SELECT id FROM cultura_recursos WHERE titulo = $1 AND tipo = $2 LIMIT 1`, [r.titulo, r.tipo]);
    if (prev.rowCount) {
      await db.query(
        `UPDATE cultura_recursos SET resena=$1, idioma=$2, categorias=$3, anio=$4, autor=$5, extra=$6,
         "urlExterna"=$7, "portadaUrl"=$8, "updatedAt"=now() WHERE id=$9`,
        [r.resena, r.idioma, r.categorias, r.anio, r.autor, r.extra, r.urlExterna, r.portada, prev.rows[0].id]);
      actualizados++;
    } else {
      await db.query(
        `INSERT INTO cultura_recursos (id, titulo, resena, tipo, idioma, categorias, anio, autor, pais, extra,
          "urlExterna", "portadaUrl", proveedor, publicado, destacado, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,false,now(),now())`,
        [nuevoId(), r.titulo, r.resena, r.tipo, r.idioma, r.categorias, r.anio, r.autor, r.pais, r.extra,
         r.urlExterna, r.portada, r.proveedor]);
      creados++;
    }
  }
  const resumen = await db.query(`SELECT idioma, publicado, count(*)::int n FROM cultura_recursos GROUP BY 1,2 ORDER BY 1,2`);
  console.log(`creados ${creados} · actualizados ${actualizados}`);
  console.table(resumen.rows);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
