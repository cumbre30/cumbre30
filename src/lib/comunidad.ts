// ============================================================
// Comunidad y moderación (fase E, arquitectura v2.1 §6-§7). Lógica
// PURA, probable en node: peso del reportante, evaluación del
// umbral ponderado de confianza y lote sospechoso. Los reportes
// NUNCA cambian la geometría: solo visibilidad y estado informativo.
// ============================================================

export type RolUsuario = "user" | "moderador" | "admin";
export type MotivoReporte = "cierre" | "peligro" | "error_geografico" | "spam" | "contenido_inapropiado";

export const MOTIVOS_VALIDOS: MotivoReporte[] = [
  "cierre", "peligro", "error_geografico", "spam", "contenido_inapropiado",
];

/** Motivos que pueden ocultar automáticamente (v2.1 §7.2): cierre y
 *  peligro. El resto va SIEMPRE a cola de moderación. */
export const MOTIVOS_AUTOHIDE: MotivoReporte[] = ["cierre", "peligro"];

/** Condiciones tipificadas de las experiencias (§6, máx 3). */
export const CONDICIONES_VALIDAS = ["camino_ok", "tramo_cerrado", "barro", "mucho_trafico", "sombra", "agua", "otro"];

// ------------------------------------------------------------
// Peso del reportante (§7.2): veterano 1,5 · regular 1,0 · nueva
// 0,5. Decae 0,25 por denuncia descartada (mínimo 0,25).
// ------------------------------------------------------------

export type PerfilReportante = {
  /** Días desde la creación de la cuenta. */
  diasCuenta: number;
  /** Contribuciones confirmadas (reportes suyos confirmados). */
  contribucionesConfirmadas: number;
  /** Rides registrados. */
  rides: number;
  /** Denuncias suyas descartadas (decaen el peso). */
  descartadas: number;
};

export function pesoReportante(p: PerfilReportante): number {
  let peso: number;
  const veterano = p.diasCuenta >= 90 && (p.contribucionesConfirmadas >= 3 || p.rides >= 20);
  // «cuenta nueva o de poca actividad 0,5 (menos de 30 días o sin
  // contribuciones confirmadas)» — el veterano ya salió por arriba
  // (rides ≥ 20 también lo califica aunque no confirme reportes).
  const nueva = p.diasCuenta < 30 || p.contribucionesConfirmadas === 0;
  if (veterano) peso = 1.5;
  else if (nueva) peso = 0.5;
  else peso = 1.0;
  return Math.max(0.25, peso - 0.25 * p.descartadas);
}

// ------------------------------------------------------------
// Ocultamiento automático (§7.2): SOLO cierre/peligro; suma de
// pesos de reportantes DISTINTOS ≥ 2,0 Y al menos 2 reportantes
// distintos. Un lote sospechoso desactiva el auto-ocultamiento y
// pasa a cola con clasificacion = sospechoso.
// ------------------------------------------------------------

export type ReporteAbierto = {
  motivo: MotivoReporte;
  peso: number;
  reporterId: string;
  clasificacion: "normal" | "sospechoso";
};

export type DecisionAutohide = {
  ocultar: boolean;
  /** true si el lote del motivo quedó marcado sospechoso (a cola). */
  loteSospechoso: boolean;
  sumaPesos: number;
  reportantes: number;
  umbral: number;
};

export const UMBRAL_AUTOHIDE = 2.0;
export const MIN_REPORTANTES = 2;

/** Lote sospechoso: ≥3 denuncias del MISMO motivo en <1 hora desde
 *  cuentas creadas la misma semana (defensa anti-coordinación). */
export function esLoteSospechoso(
  reportesMismoMotivo: { reporterId: string; createdAt: number; cuentaCreada: number }[],
): boolean {
  if (reportesMismoMotivo.length < 3) return false;
  const orden = [...reportesMismoMotivo].sort((a, b) => a.createdAt - b.createdAt);
  const ventana = orden[orden.length - 1].createdAt - orden[0].createdAt;
  if (ventana >= 3_600_000) return false;
  const semana = 7 * 86_400_000;
  const base = orden[0].cuentaCreada;
  const mismaSemana = orden.every((r) => Math.abs(r.cuentaCreada - base) <= semana);
  return mismaSemana;
}

/** Evalúa si procede el ocultamiento automático de una ruta. */
export function evaluarAutohide(
  motivo: MotivoReporte,
  abiertos: ReporteAbierto[],
  recientesMismoMotivo: { reporterId: string; createdAt: number; cuentaCreada: number }[],
): DecisionAutohide {
  const loteSospechoso = esLoteSospechoso(recientesMismoMotivo);
  const delMotivo = abiertos.filter((r) => r.motivo === motivo);
  const reportantes = new Set(delMotivo.map((r) => r.reporterId)).size;
  const sumaPesos = delMotivo
    .reduce((acc, r) => { acc.set(r.reporterId, Math.max(acc.get(r.reporterId) ?? 0, r.peso)); return acc; }, new Map<string, number>());
  const total = [...sumaPesos.values()].reduce((a, b) => a + b, 0);
  const puede = MOTIVOS_AUTOHIDE.includes(motivo) && !loteSospechoso && total >= UMBRAL_AUTOHIDE && reportantes >= MIN_REPORTANTES;
  return { ocultar: puede, loteSospechoso, sumaPesos: total, reportantes, umbral: UMBRAL_AUTOHIDE };
}

/** estadoVigencia derivado (§7.4): reportes de cierre/peligro
 *  abiertos o confirmados → 'avisos' (informativo, con su número). */
export function vigenciaConReportes(
  ultimaRevisionAt: string | null,
  reportesCierrePeligro: number,
): "vigente" | "avisos" | "sin-revisar" {
  if (reportesCierrePeligro > 0) return "avisos";
  if (!ultimaRevisionAt) return "sin-revisar";
  const t = Date.parse(ultimaRevisionAt);
  if (!Number.isFinite(t)) return "sin-revisar";
  return Date.now() - t < 182 * 24 * 60 * 60 * 1000 ? "vigente" : "sin-revisar";
}
