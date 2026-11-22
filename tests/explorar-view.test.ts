// ============================================================
// Explorar — rediseño «Rutas, segmentos y comunidad» (2026-11-21).
// Verifica en node la parte PURA del rediseño:
//   · Toda clave i18n «ex.*» referenciada por el módulo existe en
//     los 3 idiomas (es/en/pt) con valor no vacío — el idioma sigue
//     al usuario en toda la app.
//   · El conjunto de claves usadas coincide con el bloque declarado
//     (nada huérfano: ni claves faltantes ni declaraciones muertas).
//   · El bus de órdenes del mapa (OrdenExplorar): cada tipo que
//     ExplorarView puede enviar tiene su case en MapView.
// El render visual se verifica in-vivo en el navegador.
// ============================================================
import { readFileSync } from "fs";
import { setLang, t } from "../src/lib/i18n";
import { SEGMENTS } from "../src/lib/segments";

let pasos = 0;
let fallos = 0;
function ok(nombre: string, cond: boolean): void {
  pasos++;
  if (!cond) {
    fallos++;
    console.error(`  ✗ ${nombre}`);
  }
}

const VISTA = readFileSync(new URL("../src/components/ExplorarView.tsx", import.meta.url), "utf8");
const MAPA = readFileSync(new URL("../src/components/MapView.tsx", import.meta.url), "utf8");
const I18N = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");

// Claves usadas por el módulo: t("...") literales + las que llegan
// por ternarios fijos (bib.*, cat.*, navf.*, pub.* son de otros
// módulos; aquí solo se audita el bloque ex.*).
const usadas = new Set<string>();
for (const m of VISTA.matchAll(/t\(\s*"([^"]+)"/g)) {
  if (m[1].startsWith("ex.")) usadas.add(m[1]);
}
// Claves dinámicas por ternario (ex.* elegidas con ? :) — explícitas
// para no depender del formato del ternario:
for (const m of VISTA.matchAll(/"(ex\.[a-zA-Z]+)"/g)) {
  usadas.add(m[1]);
}

const declaradas = new Set<string>();
for (const m of I18N.matchAll(/"(ex\.[a-zA-Z]+)":\s*\[/g)) declaradas.add(m[1]);

console.log("· bloque ex.* declarado en i18n (es/en/pt)");
ok("el bloque ex.* existe (≥ 60 claves)", declaradas.size >= 60);

console.log("· toda clave usada por ExplorarView está declarada");
const faltantes = [...usadas].filter((k) => !declaradas.has(k));
ok(`sin claves faltantes (${usadas.size} usadas)${faltantes.length ? ` → faltan: ${faltantes.join(", ")}` : ""}`, faltantes.length === 0);

console.log("· sin claves huérfanas (declaradas y nunca usadas)");
const clavesOrtograma = VISTA.includes("ex.");
const huerfanas = [...declaradas].filter((k) => !usadas.has(k));
// Las claves de sección (switcher/subnav) y estados se usan todas;
// si aparece una huérfana, es un resto de borrador: fallar.
ok(`sin huérfanas${huerfanas.length ? ` → sobran: ${huerfanas.join(", ")}` : ""}`, huerfanas.length === 0 && clavesOrtograma);

console.log("· las 3 variantes existen y no están vacías (es/en/pt)");
let variantesMal = 0;
for (const k of declaradas) {
  const m = I18N.match(new RegExp(`"${k.replace(/\./g, "\\.")}":\\s*\\[([^\\]]+)\\]`));
  if (!m) { variantesMal++; continue; }
  const partes = m[1].split(",").length;
  if (partes < 3) variantesMal++;
  if (/\[\s*"["']*\s*,|""\s*,|,\s*""\s*\]/.test(m[1])) variantesMal++;
}
ok("variantes completas en las 3 claves evaluadas por t()", variantesMal === 0);

console.log("· t() responde en los 3 idiomas (muestreo del módulo)");
const MUESTRA = ["ex.heroTitulo", "ex.tabMapa", "ex.swComunidad", "ex.expVacioTitulo", "ex.apPublicar"];
for (const lang of ["es", "en", "pt"] as const) {
  setLang(lang);
  for (const k of MUESTRA) {
    const v = t(k);
    ok(`${lang}: ${k} → "${v.slice(0, 28)}…"`, v.length > 2 && v !== k);
  }
}
setLang("es");

console.log("· bus de órdenes: cada tipo enviado por el módulo tiene case en MapView");
const TIPOS_VALIDOS = [
  "biblioteca", "trazar-ruta", "trazar-segmento", "importar-gpx", "actividades",
  "ver-ruta", "navegar-ruta", "encuadrar", "editar-borrador", "publicar", "desde-traza", "ir-inicio",
];
for (const tipo of TIPOS_VALIDOS) {
  ok(`MapView aplica orden "${tipo}"`, MAPA.includes(`case "${tipo}"`));
}

console.log("· MapView exporta el contrato del módulo");
ok("export type OrdenExplorar", MAPA.includes("export type OrdenExplorar"));
ok("export type MapViewProps", MAPA.includes("export type MapViewProps"));
ok("prop orden llega a MapView", MAPA.includes("orden?: OrdenExplorar"));

console.log("· BibliotecaRutas recibe la sección inicial del módulo");
const BIB = readFileSync(new URL("../src/components/BibliotecaRutas.tsx", import.meta.url), "utf8");
ok("prop tabInicial declarada", BIB.includes("tabInicial?: Tab"));
ok("tabInicial es estado inicial (sin efecto de sync)", BIB.includes('useState<Tab>(tabInicial ?? "mias")'));
ok("MapView remonta por sección (key={bibliotecaTab})", MAPA.includes("key={bibliotecaTab}"));
ok("MapView la pasa (tabInicial={bibliotecaTab})", MAPA.includes("tabInicial={bibliotecaTab}"));
ok("la entrada clásica del panel de capas abre en «mias»", MAPA.includes('setBibliotecaTab("mias")'));

console.log("· page.tsx hospeda el módulo con sub controlado");
const PAGE = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
ok("ExplorarView montado en screen explorar", PAGE.includes("<ExplorarView"));
ok("sub controlado desde la app", PAGE.includes("sub={explorarSub}"));
ok("velocímetro cae en «Explorar mapa»", PAGE.includes('setExplorarSub("mapa")'));

// ------------------------------------------------------------------
// 2026-11-22 · Segmentos sin Predefinidas y Amigos solo en Comunidad:
//   · En «Segmentos» ya NO hay categorías: solo «Mías» (trazados
//     propios). Los 7 oficiales del cerro se listan únicamente en
//     Estadísticas → Pro (única sede del cronometraje).
//   · Amigos fuera del Perfil Ciclista: el mismo AmigosTab vive en
//     Comunidad → Siguiendo (única sede) y la invitación por enlace
//     (/geo?agregar=usuario) aterriza allí; queda libre para
//     invitados porque AmigosTab no llama al servidor sin sesión.
// ------------------------------------------------------------------
console.log("· segmentos: solo «Mías», sin categoría Predefinidas");
const STATS = readFileSync(new URL("../src/components/StatsTab.tsx", import.meta.url), "utf8");
ok("sin categorías de segmentos", !VISTA.includes("segCat") && !VISTA.includes('"ex.segCatPre"') && !VISTA.includes('"ex.segCatMias"'));
ok("la lista oficial de lib/segments ya no se pinta en Explorar", !VISTA.includes('from "@/lib/segments"') && !VISTA.includes("coords: [seg.start, seg.end]"));
ok("los 7 oficiales siguen en Estadísticas → Pro", STATS.includes("computeSegmentStats"));
ok("los oficiales son 7", SEGMENTS.length === 7);
ok("4 subidas + 3 bajadas del control 30", SEGMENTS.filter((s) => s.dir === "bajada").length === 3 && SEGMENTS.filter((s) => s.dir !== "bajada").length === 4);
ok("cada oficial trae nombre, detalle y geocercas", SEGMENTS.every((s) => s.name && s.detail && s.start && s.end && s.radiusStartM > 0 && s.radiusEndM > 0));
ok("ids únicos", new Set(SEGMENTS.map((s) => s.id)).size === SEGMENTS.length);

console.log("· amigos: única sede en Comunidad → Siguiendo");
const PERFIL = readFileSync(new URL("../src/components/PerfilTab.tsx", import.meta.url), "utf8");
ok("Perfil ya no monta AmigosTab", !PERFIL.includes('import { AmigosTab }') && !PERFIL.includes("<AmigosTab"));
ok("Perfil sin la sección/sección inicial amigos", !PERFIL.includes('"amigos"') && !PERFIL.includes('invitado'));
ok("AmigosTab vive en Comunidad → Siguiendo", VISTA.includes('<AmigosTab invitado={invitado} />'));
ok("la invitación /geo?agregar=usuario aterriza en Siguiendo", PAGE.includes('setExplorarSub("siguiendo")') && PAGE.includes("invitado={invitado}"));
ok("con invitado el conmutador arranca en Comunidad", VISTA.includes('useState<Seccion>(invitado ? "comunidad" : "rutas")'));
ok("Siguiendo queda libre para invitados (sin llamada al servidor)", PAGE.includes("!enSiguiendo"));

const HISTORIAL = readFileSync(new URL("../src/components/HistoryTab.tsx", import.meta.url), "utf8");
console.log("· Pro sin repetición: Viajes sin subtab, Estadísticas única sede");
ok("Mis viajes ya no tiene la subsección Pro", !HISTORIAL.includes('sub === "pro"') && !HISTORIAL.includes("<SubTabs"));
ok("Mis viajes conserva el aviso de tramos logrados por ride", HISTORIAL.includes("perRideEfforts"));
ok("Estadísticas mantiene la subsección Pro", STATS.includes('sub === "pro"'));
ok("Estadísticas calcula los oficiales con lib/segments", STATS.includes("computeSegmentStats"));
ok("Estadísticas conserva los segmentos del usuario sin gate", STATS.includes("userSegmentDefs"));
ok("i18n: sin claves huérfanas de los bloques retirados", !I18N.includes('"his.proTeaser"') && !I18N.includes('"his.tabViajes"') && !I18N.includes('"his.segExplicacion"') && !I18N.includes('"ex.segCatPre"') && !I18N.includes('"menu.amigos"'));

console.log(`\n${pasos - fallos}/${pasos} OK`);
if (fallos > 0) process.exit(1);
