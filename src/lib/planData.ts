// ============================================================
// Tabla FREE vs PRO — rediseño de planes.
// ⚠️ Cada fila está validada contra el código real de la app:
//   · Ciclocomputador, GPS, registro, mapa/destinos, QR:
//     funcionan completos en FREE (page.tsx, MapView, Wallet).
//   · Desafíos con fecha (diarios/semanales/mensuales): gratis y
//     sin recompensas (pins.ts TIME_SERIES + ChallengesTab).
//   · Desafíos del cerro y pines: solo el PRIMER desafío de cada
//     serie es gratis; el resto (y sus pines) requiere Pro
//     (pins.ts Tier.pro + evaluateAchievements {pro:false}).
//   · Constancias PDF: 3 al mes en FREE (proLicenseCore
//     FREE_CONSTANCIA_LIMIT + HistoryTab.exportPdf).
//   · Buscador universal + marcadores: solo Pro (MapView SearchCard).
//   · Segmentos del cerro: solo Pro (HistoryTab → lib/segments).
//   · Export GPX: solo Pro (HistoryTab, lib/gpx).
// Nada inventado: si cambia el gating, actualizar aquí también.
// ============================================================

export type PlanRow = {
  feature: string;
  free: string | boolean; // true = Sí · false = No · string = límite
  pro: string | boolean;
};

export const PLAN_ROWS: PlanRow[] = [
  { feature: "Ciclocomputador y límite 30 km/h", free: true, pro: true },
  { feature: "GPS real y registro de viajes", free: true, pro: true },
  { feature: "Mapa del cerro y rutas a destinos", free: true, pro: true },
  { feature: "Acceso QR y ficha médica", free: true, pro: true },
  { feature: "Desafíos diarios, semanales y mensuales", free: true, pro: true },
  { feature: "Desafíos del cerro", free: "1.º de cada serie", pro: "Todos" },
  { feature: "Pines de recompensa", free: "Los de retos gratis", pro: "Todos" },
  { feature: "Constancias PDF", free: "3 al mes", pro: "Ilimitadas" },
  { feature: "Buscador universal de direcciones", free: false, pro: true },
  { feature: "Segmentos del cerro con récords", free: false, pro: true },
  { feature: "Export GPX (Strava, Garmin, Komoot)", free: false, pro: true },
];

/** Texto del beneficio Pro que abre el modal contextual del mapa. */
export const PRO_LOCK_COPY = {
  buscador: {
    title: "Buscador universal de direcciones",
    body: "Escribe cualquier dirección de Santiago —tu casa, el trabajo, otra ciclovía— y el mapa traza la ruta ciclable hasta ahí, sola. También desde cualquier lugar del cerro.",
    free: "En FREE igual puedes navegar: el mapa, los destinos del cerro y el reporte de incidencias funcionan completos. El buscador de texto libre y tus lugares guardados son la parte Pro.",
  },
  marcador: {
    title: "Mis lugares y marcadores",
    body: "Guarda tus propios puntos —miradores, fuentes, el punto de encuentro del grupo— tocando el mapa, y traza ruta a cada uno con un toque.",
    free: "En FREE el mapa completo sigue disponible. Guardar lugares y marcar puntos personalizados es parte de Cumbre30 Pro.",
  },
} as const;

export type ProLockFeature = keyof typeof PRO_LOCK_COPY;
