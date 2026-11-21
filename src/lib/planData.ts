// ============================================================
// Tabla FREE vs PRO - rediseño de planes (reevaluación v1.8.0).
// ⚠️ Cada fila está validada contra el código real de la app:
//   · Ciclocomputador, GPS, mapa/destinos, QR:
//     funcionan completos en FREE (page.tsx, MapView, Wallet).
//   · Desafíos con fecha (diarios/semanales/mensuales): gratis y
//     sin recompensas (pins.ts TIME_SERIES + ChallengesTab).
//   · Desafíos del cerro y pines: solo el PRIMER desafío de cada
//     serie es gratis; el resto (y sus pines) requiere Pro
//     (pins.ts Tier.pro + evaluateAchievements {pro:false}).
//   · Constancias PDF: 3 al mes en FREE (proLicenseCore
//     FREE_CONSTANCIA_LIMIT + HistoryTab.exportPdf).
//   · Buscador universal + marcadores: solo Pro (MapView SearchCard).
//   · Segmentos del cerro: solo Pro (StatsTab → lib/segments; el
//     catálogo de los 7 tramos oficiales se ve en Explorar →
//     Segmentos → Predefinidas, el cronometraje es Pro).
//   · Export GPX: solo Pro (HistoryTab, lib/gpx).
//   · Historial: últimos 20 viajes en FREE (history.ts
//     FREE_RIDE_LIMIT + applyFreeCap); Pro ilimitado.
//   · Estadísticas avanzadas (resumen mensual): solo Pro
//     (StatsTab → lib/statsMonthly).
// Nada inventado: si cambia el gating, actualizar aquí también.
// i18n: los textos son CLAVES del diccionario (src/lib/i18n.ts,
// grupos plan.* y p.*); PlanesTab y ProContextModal las pintan
// con t(). Las claves NO se comparan en lógica.
// ============================================================

export type PlanRow = {
  feature: string;
  free: string | boolean; // true = Sí · false = No · string = clave i18n
  pro: string | boolean;
};

export const PLAN_ROWS: PlanRow[] = [
  { feature: "plan.f.cc", free: true, pro: true },
  { feature: "plan.f.gps", free: true, pro: true },
  { feature: "plan.f.mapa", free: true, pro: true },
  { feature: "plan.f.qr", free: true, pro: true },
  { feature: "plan.f.desafiosTiempo", free: true, pro: true },
  { feature: "plan.f.desafiosCerro", free: "plan.c.primero", pro: "plan.c.todos" },
  { feature: "plan.f.pines", free: "plan.c.retosGratis", pro: "plan.c.todos" },
  { feature: "plan.f.constancias", free: "plan.c.tresMes", pro: "plan.c.ilimitadas" },
  { feature: "plan.f.historial", free: "plan.c.ultimos20", pro: "plan.c.ilimitado" },
  { feature: "plan.f.stats", free: false, pro: true },
  { feature: "plan.f.buscador", free: false, pro: true },
  { feature: "plan.f.segmentos", free: false, pro: true },
  { feature: "plan.f.gpx", free: false, pro: true },
  { feature: "plan.f.temas", free: false, pro: true },
];

/** Texto del beneficio Pro que abre el modal contextual del mapa.
 *  Valores = claves i18n (grupo p.*): ProContextModal las renderiza
 *  con t(copy.title) / t(copy.body) / t(copy.free). */
export const PRO_LOCK_COPY = {
  buscador: {
    title: "p.buscadorTitle",
    body: "p.buscadorBody",
    free: "p.buscadorFree",
  },
  marcador: {
    title: "p.marcadorTitle",
    body: "p.marcadorBody",
    free: "p.marcadorFree",
  },
  muro: {
    title: "p.muroTitle",
    body: "p.muroBody",
    free: "p.muroFree",
  },
} as const;

export type ProLockFeature = keyof typeof PRO_LOCK_COPY;
