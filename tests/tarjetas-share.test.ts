// ============================================================
// Tarjetas para compartir — Propuesta B «ADN helicoidal».
// Prueba los helpers PUROS de src/lib/shareAdn.ts en node:
// semana ISO, agregación por día, alturas de barra, formatos de
// números por idioma, KPIs honestos (null → «—») y las claves
// i18n de las tarjetas en los 3 idiomas (el idioma de las
// estadísticas sigue al usuario). El render canvas se verifica
// in-vivo en el navegador.
// ============================================================
import {
  CLAVES_EJE,
  EJE_HEX,
  EJE_I18N,
  ARCH_EMOJI,
  isoWeekNumber,
  weekDaysKm,
  barHeights,
  rungWidth,
  fmt1,
  fmtInt,
  fmtHoras,
  kpiTexts,
  weekRangeLabel,
  type WeekRideLite,
} from "../src/lib/shareAdn";
import { t, setLang } from "../src/lib/i18n";

let pasos = 0;
function ok(nombre: string, cond: boolean): void {
  if (!cond) {
    console.error(`  ✗ ${nombre}`);
    process.exit(1);
  }
  pasos++;
  console.log(`  ✓ ${nombre}`);
}

// semana de prueba: lunes 16 nov 2026 00:00 → lunes 23 nov (Chile UTC-3 en nov)
const lunes = new Date(2026, 10, 16, 0, 0, 0);
const domingoFin = new Date(2026, 10, 23, 0, 0, 0);

console.log("· semana ISO (FICHA · SEM N)");
ok("21 nov 2026 → semana 47 (como el mockup)", isoWeekNumber(new Date(2026, 10, 21)) === 47);
ok("1 ene 2026 → semana 1", isoWeekNumber(new Date(2026, 0, 1)) === 1);
ok("1 ene 2027 → semana 53 de 2026", isoWeekNumber(new Date(2027, 0, 1)) === 53);

console.log("· agregación por día (sin conteo de constancias)");
const rides: (WeekRideLite & { elapsedSec?: number; gainM?: number })[] = [
  { dateISO: "2026-11-16T10:00:00", distanceKm: 24.6, elapsedSec: 5400, gainM: 520 }, // lunes
  { dateISO: "2026-11-18T09:30:00", distanceKm: 18.2, elapsedSec: 4000, gainM: 300 }, // miércoles
  { dateISO: "2026-11-21T08:00:00", distanceKm: 31.4, elapsedSec: 7000, gainM: 620 }, // sábado
  { dateISO: "2026-11-21T17:00:00", distanceKm: 0 }, // segundo registro sábado sin km
  { dateISO: "2026-11-22T09:00:00", distanceKm: 12.2, elapsedSec: 2800, gainM: 180 }, // domingo
  { dateISO: "2026-11-14T09:00:00", distanceKm: 99.9 }, // semana anterior: NO suma
];
const dias = weekDaysKm(rides, lunes, domingoFin);
ok("7 cubetas", dias.length === 7);
ok("lunes 24.6", Math.abs(dias[0] - 24.6) < 1e-9);
ok("miércoles 18.2", Math.abs(dias[2] - 18.2) < 1e-9);
ok("sábado 31.4 (dos registros del día suman)", Math.abs(dias[5] - 31.4) < 1e-9);
ok("domingo 12.2", Math.abs(dias[6] - 12.2) < 1e-9);
ok("martes/jueves/viernes en cero", dias[1] === 0 && dias[3] === 0 && dias[4] === 0);
ok("ride de otra semana queda fuera", Math.abs(dias.reduce((a, b) => a + b, 0) - 86.4) < 1e-9);

console.log("· alturas de barra + anillo de días activos");
const { heights, maxIdx, activeDays } = barHeights(dias);
ok("día tope = sábado (índice 5)", maxIdx === 5);
ok("días activos = 4 (4/7)", activeDays === 4);
ok("barra tope 260 px", Math.abs(heights[5] - 260) < 1e-9);
ok("escala sobre el máximo (24.6 → 203.7)", Math.abs(heights[0] - (24.6 / 31.4) * 260) < 1e-9);
ok("días sin km → piso 14 px", heights[1] === 14 && heights[3] === 14 && heights[4] === 14);
const vacia = barHeights([0, 0, 0, 0, 0, 0, 0]);
ok("semana vacía honesta: sin tope, 0/7 días", vacia.maxIdx === -1 && vacia.activeDays === 0);

console.log("· hélice: grosor de travesañas");
ok("sin dato → 4 px", rungWidth(null) === 4);
ok("0 → 4 px", rungWidth(0) === 4);
ok("100 → 20 px", Math.abs(rungWidth(100) - 20) < 1e-9);
ok("87 → 17.92 px", Math.abs(rungWidth(87) - 17.92) < 1e-9);

console.log("· formatos numéricos por idioma (dinámico)");
ok("es: coma decimal (86,4)", fmt1(86.44, "es") === "86,4");
ok("es: miles con espacio (+1 240)", fmtInt(1240, "es") === "1 240");
ok("en: punto decimal (86.4)", fmt1(86.44, "en") === "86.4");
ok("en: miles con coma (1,240)", fmtInt(1240, "en") === "1,240");
ok("es: 999 sin separador", fmtInt(999, "es") === "999");
ok("tiempo 4:12", fmtHoras(15120) === "4:12");
ok("bajo 1 h → 42 min", fmtHoras(2520) === "42 min");
ok("cero → 0 min", fmtHoras(0) === "0 min");

console.log("· KPIs honestos (null → «—»), etiquetas según idioma global");
setLang("es");
const kEs = kpiTexts({ vamAvg: 612.4, estWatts: 187, flatAvg: 24.86, co2Kg: 34.14 });
ok("VAM 612 m/h", kEs[0][1] === "612 m/h");
ok("W 187", kEs[1][1] === "187 W");
ok("llano 24,9 km/h (coma es)", kEs[2][1] === "24,9 km/h");
ok("CO₂ −34,1 kg", kEs[3][1] === "−34,1 kg");
ok("rótulos es: LLANO", kEs[2][0] === "LLANO");
setLang("en");
const kEn = kpiTexts({ vamAvg: null, estWatts: null, flatAvg: null, co2Kg: null });
ok("sin datos → «—» en los 4", kEn.every(([, v]) => v === "—"));
ok("rótulos: VAM / EST. W / FLAT / CO₂", kEn[0][0] === "VAM" && kEn[1][0] === "EST. W" && kEn[2][0] === "FLAT" && kEn[3][0] === "CO₂");
setLang("es");

console.log("· rótulos i18n de las tarjetas en los 3 idiomas");
for (const lang of ["es", "en", "pt"] as const) {
  setLang(lang);
  const lema = { es: "SUBE TU LÍMITE", en: "PUSH YOUR LIMIT", pt: "SUBA SEU LIMITE" }[lang];
  ok(`${lang}: lema «${lema}»`, t("sc.lema") === lema);
  ok(`${lang}: 7 letras de día`, t("sc.dias").split(" ").length === 7);
  ok(`${lang}: ficha con número de semana`, t("sc.fichaN", 47).includes("47"));
  ok(`${lang}: especimen + calibración interpolada`, t("sc.adnCalibrando", 5, 12).includes("5") && t("sc.adnCalibrando", 5, 12).includes("12"));
  ok(`${lang}: 6 ejes con nombre`, CLAVES_EJE.every((k) => t(EJE_I18N[k]).length > 2));
}
setLang("es");

console.log("· rango de semana en el idioma activo");
ok("es: rango con mes corto", weekRangeLabel(lunes, new Date(2026, 10, 22), "es").includes("NOV"));
ok("en: rango con mes corto", weekRangeLabel(lunes, new Date(2026, 10, 22), "en").includes("NOV"));
ok("pt: rango con mes corto", weekRangeLabel(lunes, new Date(2026, 10, 22), "pt").toLowerCase().includes("nov"));

console.log("· mapas estáticos");
ok("6 ejes con color", CLAVES_EJE.every((k) => EJE_HEX[k].startsWith("#")));
ok("8 arquetipos con emoji", Object.keys(ARCH_EMOJI).length === 8);

console.log(`\nTARJETAS COMPARTIR: ${pasos} comprobaciones OK`);
