// ============================================================
// Semilla del LOTE EN ESPAÑOL de Cultura Ciclista (v4): primeras
// fichas reales y verificables del lote editorial es. SOLO obras
// reales (títulos localizados vía Open Library language:spa y
// fuentes abiertas); año solo cuando es seguro (null si no). La
// reseña nace EN ESPAÑOL (regla v4: la reseña va en el idioma de
// la edición). Flujo editorial: se crean como BORRADORES
// (publicado=false) y el equipo publica por oleadas tras revisión.
//   · Si el recurso ya existe, la re-corre NO toca publicado ni
//     destacado (el estado editorial es del equipo, no de la
//     semilla); solo refresca el resto de campos.
// Política de enlaces (v4.2): descubrir no es conseguir gratis. Los
// libros en español enlazan a Buscalibre Chile (libros/search?q=,
// catálogo local verificado, precios en CLP); la búsqueda por
// título+autor sobrevive a cambios de stock y edición.
// Idempotente: match por titulo+tipo.
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//   bun scripts/semilla-cultura-es.mjs
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const enc = (s) => encodeURIComponent(s);
// Buscalibre Chile: búsqueda estable por título+autor (formato
// verificado en el índice: /libros/search?q=…; robots.txt del propio
// Buscalibre documenta la ruta).
const bc = (t, a) => `https://www.buscalibre.cl/libros/search?q=${enc(`${t} ${a}`)}`;
const imdb = (t) => `https://www.imdb.com/find/?q=${enc(t)}&s=tt`;

const LOTE_ES = [
  { titulo: "El ciclista", tipo: "libro", categorias: ["ruta", "historia", "personas"], anio: "2010", autor: "Tim Krabbé", pais: "Países Bajos", extra: "Novela · Edición española de The Rider (1978); traducción publicada en español",
    resena: "La gran novela del ciclismo en su edición española: 150 kilómetros de carrera amateur contados desde dentro, donde cada puerto es un estado mental. El puente perfecto entre la biblioteca en inglés y la española." },
  { titulo: "Elogio de la bicicleta", tipo: "libro", categorias: ["historia", "personas"], anio: "2009", autor: "Marc Augé", pais: "Francia", extra: "Ensayo · Original en francés (Éloge de la bicyclette); edición española",
    resena: "El antropólogo Marc Augé piensa la bicicleta como nadie: el ciclista adulto que vuelve a pedalear y reencuentra el equilibrio entre cuerpo, mundo y memoria. Ensayo breve, luminoso y citadino." },
  { titulo: "Cuentos de ciclismo", tipo: "libro", categorias: ["historia", "personas"], anio: "2000", autor: "Luis Martínez de Mingo (ed.)", pais: "España", extra: "Antología · Literatura deportiva",
    resena: "Antología de relatos sobre ciclismo reunida por Luis Martínez de Mingo: la leyenda del pedal contada por escritores. Una entrada literaria al imaginario de la bici en español." },
  { titulo: "La bicicleta, mi cámara y yo", tipo: "libro", categorias: ["aventura", "personas"], anio: "2002", autor: "Horacio Gil Ochoa", pais: "España", extra: "Crónica de viaje · Fotografía",
    resena: "Viaje en bicicleta narrado y fotografiado por su autor: kilómetros, gente y luz capturados al pedalear. Crónica viajera en primera persona con ojo de fotógrafo." },
  { titulo: "Navarra en Bicicleta", tipo: "libro", categorias: ["ruta", "aventura"], anio: "2020", autor: "Francisco Javier Ayesa Usabiaga", pais: "España", extra: "Guía local · Rutas",
    resena: "Guía de rutas ciclistas por Navarra con descripciones y datos prácticos. Contenido local que ningún catálogo extranjero tiene: pedalear la geografía navarra con mapa propio." },
  { titulo: "Bicicleta: salud y ejercicio", tipo: "libro", categorias: ["entrenamiento"], anio: "2004", autor: "Chris Carmichael", pais: "EE. UU.", extra: "Guía de entrenamiento · Edición española",
    resena: "La guía de entrenamiento de Chris Carmichael en su edición española: fitness sobre dos ruedas para ciclistas reales, con planes y progresión. Entrenar sin anglicismos innecesarios." },
  { titulo: "Desde Monterrey en bicicleta", tipo: "libro", categorias: ["aventura", "personas"], anio: "1998", autor: "Sergio L. González de León", pais: "México", extra: "Crónica de viaje",
    resena: "El escritor regiomontano Sergio L. González de León pedalea desde Monterrey y convierte el viaje en crónica literaria. Aventura larga mexicana con prosa fina." },
  { titulo: "La bicicleta de Katmandú", tipo: "libro", categorias: ["aventura", "personas"], anio: "2013", autor: "Felipe Ovares Barquero", pais: "Costa Rica", extra: "Crónica de viaje",
    resena: "Relato de viaje en bicicleta del costarricense Felipe Ovares: Centroamérica, Asia y el mundo visto al ritmo del pedal. Voz centroamericana poco frecuente en las bibliotecas ciclistas." },
  { titulo: "Bicicleta, cuchara, manzana", tipo: "documental", categorias: ["personas", "aventura"], anio: "2004", autor: "Carlos Mario Cárdenas", pais: "Colombia", extra: "Documental · Medellín · El filósofo Fernando González sobre dos ruedas",
    resena: "Documental colombiano que sigue al filósofo Fernando González, El Filósofo de Oriente, pedaleando Medellín: filosofía práctica, ciudad y bicicleta. Ciclismo cotidiano como manera de pensar." },
  { titulo: "Bahamontes, el precursor", tipo: "documental", categorias: ["historia", "personas"], anio: null, autor: "Teledeporte (RTVE)", pais: "España", extra: "Documental · Federico Martín Bahamontes, primer español ganador del Tour (1959)",
    resena: "Retrato del Águila de Toledo, primer español en ganar el Tour de Francia (1959), con la memoria de Induráin, Pedro Delgado y quienes lo conocieron. La raíz hispana del ciclismo de gran vuelta." },
];

async function main() {
  let creados = 0;
  let actualizados = 0;
  for (const r of LOTE_ES) {
    const url = r.tipo === "libro" ? bc(r.titulo, r.autor.split(" (")[0]) : imdb(r.titulo);
    const data = {
      titulo: r.titulo,
      tipo: r.tipo,
      idioma: "es",
      categorias: r.categorias,
      anio: r.anio,
      autor: r.autor,
      pais: r.pais ?? null,
      extra: r.extra,
      urlExterna: url,
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
  const borradores = await db.culturaRecurso.count({ where: { idioma: "es", publicado: false } });
  console.log(`Lote ES: ${creados} creados, ${actualizados} actualizados → borradores es: ${borradores} (el equipo publica por oleadas)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
