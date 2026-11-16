// ============================================================
// Clasificación y trazabilidad de geocercas (requerimiento de
// cumplimiento legal, 2026-11-16).
//
// El sistema de geocercas informativas NO cambia: la detección
// GPS, las alertas visuales/sonoras y los radios siguen en
// useRideEngine (motor intocado). Este módulo agrega la capa de
// PROCEDENCIA y CLASIFICACIÓN que exige el requerimiento:
//
//   · INFORMATIVE        → advertencias orientativas.
//   · SAFETY             → zonas de riesgo y precaución.
//   · OFFICIAL_RESTRICTION → restricciones respaldadas por
//     fuentes oficiales VERIFICADAS (administración del parque).
//
// REGLA DURA: una geocerca cuya única fuente sea OpenStreetMap
// NO puede clasificarse OFFICIAL_RESTRICTION — la información
// cartográfica de OSM es orientativa y su modelo comunitario no
// es una fuente normativa. `clasificarGeocerca()` la aplica y
// `validarTrazabilidad()` la audita en carga y en el test de
// regresión (scripts/reg-geocercas.ts).
//
// Los 7 campos de trazabilidad (source, source_reference,
// created_at, updated_at, verification_status, confidence_level,
// restriction_type) viven en cada geocerca: RISK_ZONES los
// llevan inline (park.ts) y los accesos y puntos normativos por
// id en TRAZABILIDAD_GEOCERCAS. Fechas ISO (yyyy-mm-dd, hora
// local de Chile), fuentes: comentarios de procedencia que el
// código ya documentaba (coordenadas del cliente 2026-11-12/13).
// ============================================================

/** Categoría de una geocerca (requerimiento §2). */
export type ClasificacionGeocerca =
  | "INFORMATIVE"
  | "SAFETY"
  | "OFFICIAL_RESTRICTION";

/** Estado de verificación de la procedencia. */
export type VerificacionGeocerca =
  | "verified_official" // respaldada por la administración del parque
  | "verified_client" // coordenadas exactas entregadas por el cliente
  | "unverified"; // solo fuentes cartográficas (OSM) — nunca oficial

/** Nivel de confianza de la precisión de la geocerca. */
export type ConfianzaGeocerca = "high" | "medium" | "low";

/** Los 7 campos de trazabilidad exigidos (requerimiento §3). */
export type TrazabilidadGeocerca = {
  /** Origen de la información: "OpenStreetMap", "Parquemet", etc. */
  source: string;
  /** Referencia concreta de la fuente (documento, comunicado, fecha). */
  source_reference: string;
  created_at: string; // ISO yyyy-mm-dd
  updated_at: string; // ISO yyyy-mm-dd
  verification_status: VerificacionGeocerca;
  confidence_level: ConfianzaGeocerca;
  /** Tipo de restricción; "none" para las orientativas. */
  restriction_type: string;
};

/** La fuente es EXCLUSIVAMENTE OpenStreetMap (directa o derivada). */
export function fuenteSoloOsm(source: string): boolean {
  return source.toLowerCase().includes("openstreetmap");
}

/** Clasifica una geocerca aplicando la regla dura del requerimiento
 *  §2: una fuente exclusivamente OSM no puede ser una restricción
 *  oficial. Se usa al asignar categorías y en la auditoría. */
export function clasificarGeocerca(
  pedida: ClasificacionGeocerca,
  traz: TrazabilidadGeocerca
): ClasificacionGeocerca {
  if (pedida !== "OFFICIAL_RESTRICTION") return pedida;
  if (fuenteSoloOsm(traz.source)) {
    // OSM no acredita una fuente normativa: baja a orientativa.
    return "INFORMATIVE";
  }
  if (traz.verification_status !== "verified_official") {
    // Sin verificación oficial documentada: orientativa hasta que exista.
    return "INFORMATIVE";
  }
  return "OFFICIAL_RESTRICTION";
}

// ------------------------------------------------------------
// Trazabilidad por id para geocercas que NO llevan el campo
// inline (GATES y puntos de la capa normativa). Las 5 zonas de
// riesgo lo llevan inline en park.ts. Cualquier id no listado es
// INFORMATIVE por defecto (seguro ante geocercas nuevas).
// ------------------------------------------------------------
export const TRAZABILIDAD_GEOCERCAS: Record<string, TrazabilidadGeocerca> = {
  // Zonas de riesgo (RISK_ZONES en park.ts las llevan inline): la
  // procedencia ya la documentaba el código — coordenadas EXACTAS
  // entregadas por el cliente (2026-11-12/13). Son SAFETY: advertencias
  // de precaución, no restricciones.
  anahuac: {
    source: "Cliente Parquemet/Cumbre30 (coordenadas exactas)",
    source_reference: "Coordenadas de la curva Casa de la Cultura Anáhuac entregadas por el cliente 2026-11-13",
    created_at: "2026-11-13",
    updated_at: "2026-11-16",
    verification_status: "verified_client",
    confidence_level: "high",
    restriction_type: "none",
  },
  antiluen: {
    source: "Cliente Parquemet/Cumbre30 (coordenadas exactas)",
    source_reference: "Coordenadas de la Rotonda/Plaza Antilén entregadas por el cliente 2026-11-13",
    created_at: "2026-11-13",
    updated_at: "2026-11-16",
    verification_status: "verified_client",
    confidence_level: "high",
    restriction_type: "none",
  },
  "jardin-japones": {
    source: "Cliente Parquemet/Cumbre30 (coordenadas exactas)",
    source_reference: "Coordenadas del cruce del Jardín Japonés entregadas por el cliente 2026-11-13",
    created_at: "2026-11-13",
    updated_at: "2026-11-16",
    verification_status: "verified_client",
    confidence_level: "high",
    restriction_type: "none",
  },
  "salida-pv": {
    source: "Cliente Parquemet/Cumbre30 (coordenadas exactas)",
    source_reference: "Coordenadas de la salida Pedro de Valdivia Norte entregadas por el cliente 2026-11-12; radio 55 m acordado 2026-11-13",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_client",
    confidence_level: "high",
    restriction_type: "none",
  },
  zoologico: {
    source: "Cliente Parquemet/Cumbre30 (coordenadas exactas)",
    source_reference: "Coordenadas del Zoológico Nacional entregadas por el cliente 2026-11-13",
    created_at: "2026-11-13",
    updated_at: "2026-11-16",
    verification_status: "verified_client",
    confidence_level: "high",
    restriction_type: "none",
  },
  // Accesos: autorizados (ciclistas) y no autorizados para bici.
  // Fuente: normativa de accesos de la administración del parque,
  // comunicada por el cliente al configurar la app (2026-11-12).
  "pio-nono": {
    source: "Parquemet (administración del parque)",
    source_reference: "Normativa de accesos ciclistas, comunicada por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "acceso_bicicletas",
  },
  "pv-norte": {
    source: "Parquemet (administración del parque)",
    source_reference: "Normativa de accesos ciclistas, comunicada por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "acceso_bicicletas",
  },
  "la-piramide": {
    source: "Parquemet (administración del parque)",
    source_reference: "Normativa de accesos ciclistas, comunicada por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "acceso_bicicletas",
  },
  "zapadores": {
    source: "Parquemet (administración del parque)",
    source_reference: "Normativa de accesos ciclistas, comunicada por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "acceso_bicicletas",
  },
  "santos-dumont": {
    source: "Parquemet (administración del parque)",
    source_reference: "Accesos sin habilitación ciclista, comunicados por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "ingreso_bicicletas_prohibido",
  },
  "carlos-reed": {
    source: "Parquemet (administración del parque)",
    source_reference: "Accesos sin habilitación ciclista, comunicados por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "ingreso_bicicletas_prohibido",
  },
  "aurora-de-chile": {
    source: "Parquemet (administración del parque)",
    source_reference: "Accesos sin habilitación ciclista, comunicados por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "ingreso_bicicletas_prohibido",
  },
  "paseo-metropolitano": {
    source: "Parquemet (administración del parque)",
    source_reference: "Accesos sin habilitación ciclista, comunicados por el cliente 2026-11-12",
    created_at: "2026-11-12",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "ingreso_bicicletas_prohibido",
  },
  // Puntos normativos del mapa (capa «Normativa y Seguridad»).
  "corte-tupahue": {
    source: "Parquemet (administración del parque)",
    source_reference: "Corte horario del puente Tupahue→Cumbre (fines de semana y festivos desde 13:30), comunicado por el cliente 2026-11-13",
    created_at: "2026-11-13",
    updated_at: "2026-11-16",
    verification_status: "verified_official",
    confidence_level: "high",
    restriction_type: "horario_fin_de_semana",
  },
};

/** Categoría declarada por geocerca (las zonas de riesgo = SAFETY
 *  están en park.ts; el resto se declara aquí). */
export const CLASIFICACION_GEOCERCAS: Record<string, ClasificacionGeocerca> = {
  "pio-nono": "OFFICIAL_RESTRICTION",
  "pv-norte": "OFFICIAL_RESTRICTION",
  "la-piramide": "OFFICIAL_RESTRICTION",
  "zapadores": "OFFICIAL_RESTRICTION",
  "santos-dumont": "OFFICIAL_RESTRICTION",
  "carlos-reed": "OFFICIAL_RESTRICTION",
  "aurora-de-chile": "OFFICIAL_RESTRICTION",
  "paseo-metropolitano": "OFFICIAL_RESTRICTION",
  "corte-tupahue": "OFFICIAL_RESTRICTION",
};

/** Trazabilidad de un id (null si es una geocerca sin registro:
 *  se trata como INFORMATIVE/unverified — nunca como oficial). */
export function trazabilidadDe(id: string): TrazabilidadGeocerca | null {
  return TRAZABILIDAD_GEOCERCAS[id] ?? null;
}

/** Categoría efectiva de un id: aplica la regla OSM sobre la
 *  categoría declarada. Zonas de riesgo (SAFETY) viven en park.ts. */
export function clasificacionDe(id: string): ClasificacionGeocerca {
  const traz = trazabilidadDe(id);
  if (!traz) return "INFORMATIVE";
  return clasificarGeocerca(CLASIFICACION_GEOCERCAS[id] ?? "INFORMATIVE", traz);
}

/** Auditoría (en carga y en el test): toda geocerca registrada
 *  debe tener los 7 campos completos y fechas ISO válidas, y
 *  ninguna fuente OSM puede estar clasificada como oficial. */
export function validarTrazabilidad(): string[] {
  const errs: string[] = [];
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const [id, traz] of Object.entries(TRAZABILIDAD_GEOCERCAS)) {
    if (!traz.source || !traz.source_reference) errs.push(`${id}: source/source_reference vacíos`);
    if (!iso.test(traz.created_at) || !iso.test(traz.updated_at)) errs.push(`${id}: fechas no ISO`);
    if (traz.updated_at < traz.created_at) errs.push(`${id}: updated_at < created_at`);
    if (!traz.confidence_level) errs.push(`${id}: confidence_level vacío`);
    if (!traz.restriction_type) errs.push(`${id}: restriction_type vacío`);
    const cat = clasificarGeocerca(CLASIFICACION_GEOCERCAS[id] ?? "INFORMATIVE", traz);
    if (fuenteSoloOsm(traz.source) && cat === "OFFICIAL_RESTRICTION") {
      errs.push(`${id}: fuente OSM no puede ser OFFICIAL_RESTRICTION`);
    }
    if (cat === "OFFICIAL_RESTRICTION" && traz.verification_status !== "verified_official") {
      errs.push(`${id}: OFFICIAL_RESTRICTION exige verification_status verified_official`);
    }
  }
  return errs;
}

// Valida al cargar el módulo (no lanza: registra en consola para
// que un fallo sea visible sin romper la app en producción).
if (typeof console !== "undefined") {
  for (const e of validarTrazabilidad()) console.warn("[geocercas] trazabilidad:", e);
}
