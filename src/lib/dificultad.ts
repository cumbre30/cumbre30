// ============================================================
// Dificultad física y técnica + atributos recreativos (fase B del
// módulo Rutas y Comunidad, arquitectura v2.1 §5.2-§5.3).
//
// Reglas del diseño:
// · Dos escalas independientes 1-5 (muy fácil … muy difícil).
// · La sugerencia es ORIENTATIVA y editable siempre; el campo
//   dificultadOrigen ('auto' | 'creador') registra quién mandó.
// · La física se sugiere con datos objetivos: distancia, desnivel
//   (cuando exista) y pendiente media. Si gainM es null, la
//   sugerencia es "preliminar" (solo distancia) y la UI lo dice.
// · La técnica se sugiere desde la modalidad (pavimento/mtb) y los
//   atributos del entorno.
// · Recalcular JAMÁS sobrescribe un valor ajustado por el creador
//   (aplicarSugerencias respeta dificultadOrigen === 'creador').
// · Atributos recreativos: enumerado CERRADO de 7 valores, máximo
//   3 por ruta, orientativos (no hay ranking competitivo).
// Lógica pura y probada en node (tests/rutas-editor.test.ts).
// ============================================================

/** Atributos recreativos del enumerado cerrado (§5.3). */
export const ATRIBUTOS_RECREATIVOS = [
  "escénica",
  "familiar",
  "recreativa",
  "desafiante",
  "para principiantes",
  "con miradores",
  "con zonas de descanso",
] as const;

export type AtributoRecreativo = (typeof ATRIBUTOS_RECREATIVOS)[number];

export const MAX_ATRIBUTOS = 3;

/** Modalidades del modelo Route (arquitectura tabla 3, Identidad). */
export const MODALIDADES = ["pavimento", "mtb"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export type Dificultad = 1 | 2 | 3 | 4 | 5;

export const ETIQUETAS_DIFICULTAD: Record<Dificultad, string> = {
  1: "muy fácil",
  2: "fácil",
  3: "media",
  4: "difícil",
  5: "muy difícil",
};

export type DatosDificultad = {
  distKm: number;
  /** Desnivel positivo en metros; null = sin datos (§5.1: jamás 0). */
  gainM: number | null;
  modalidad: Modalidad;
  attrs: string[];
};

export type SugerenciaDificultad = {
  fisica: Dificultad;
  tecnica: Dificultad;
  /** true cuando gainM es null: sugerencia física solo con distancia. */
  preliminar: boolean;
};

const clamp = (n: number): Dificultad => Math.min(5, Math.max(1, Math.round(n))) as Dificultad;

/** Sugerencia orientativa de dificultad física (1-5).
 *  Con desnivel: distancia + ganancia total + pendiente media.
 *  Sin desnivel (null): solo distancia y preliminar=true. */
export function sugerirFisica({ distKm, gainM }: { distKm: number; gainM: number | null }): { nivel: Dificultad; preliminar: boolean } {
  // Base por distancia (cicloturismo de parque y cerro).
  let nivel: number;
  if (distKm < 8) nivel = 1;
  else if (distKm < 15) nivel = 2;
  else if (distKm < 25) nivel = 3;
  else if (distKm < 40) nivel = 4;
  else nivel = 5;
  if (gainM == null) return { nivel: clamp(nivel), preliminar: true };
  // Ajuste por desnivel total y pendiente media (gain por km).
  if (gainM > 1000) nivel += 2;
  else if (gainM > 500) nivel += 1;
  const pendienteMediaPct = distKm > 0 ? (gainM / (distKm * 1000)) * 100 : 0;
  if (pendienteMediaPct > 5) nivel += 1;
  return { nivel: clamp(nivel), preliminar: false };
}

/** Sugerencia orientativa de dificultad técnica (1-5):
 *  modalidad base + ajustes por atributos del entorno (§5.2). */
export function sugerirTecnica({ modalidad, attrs }: { modalidad: Modalidad; attrs: string[] }): Dificultad {
  let nivel: number = modalidad === "mtb" ? 2 : 1;
  if (attrs.includes("desafiante")) nivel += 1;
  if (attrs.includes("para principiantes")) nivel -= 1;
  return clamp(nivel);
}

/** Sugerencia completa para un borrador/ruta. */
export function sugerirDificultad(d: DatosDificultad): SugerenciaDificultad {
  const fisica = sugerirFisica({ distKm: d.distKm, gainM: d.gainM });
  return {
    fisica: fisica.nivel,
    tecnica: sugerirTecnica({ modalidad: d.modalidad, attrs: d.attrs }),
    preliminar: fisica.preliminar,
  };
}

/** Valida la lista de atributos recreativos: enumerado cerrado y
 *  máximo 3 (el creador marca hasta tres, §5.3). Devuelve la lista
 *  limpia (sin duplicados, solo valores válidos) o null si no hay. */
export function attrsValidos(lista: unknown): AtributoRecreativo[] | null {
  if (!Array.isArray(lista)) return null;
  const limpios = lista.filter((a): a is AtributoRecreativo =>
    typeof a === "string" && (ATRIBUTOS_RECREATIVOS as readonly string[]).includes(a),
  );
  const sinDuplicados = [...new Set(limpios)].slice(0, MAX_ATRIBUTOS);
  return sinDuplicados.length > 0 ? sinDuplicados : null;
}

export type NivelesDificultad = {
  fisica: Dificultad;
  tecnica: Dificultad;
  origen: "auto" | "creador";
};

/** Recalcula sugerencias al editar geometría o metadatos SIN
 *  sobrescribir valores ajustados por el creador (§5.2). Si el
 *  origen es 'auto', los niveles vigentes pasan a la nueva
 *  sugerencia; si es 'creador', se conservan (la UI muestra la
 *  sugerencia como referencia). */
export function aplicarSugerencias(
  vigente: NivelesDificultad,
  datos: DatosDificultad,
): NivelesDificultad {
  if (vigente.origen === "creador") return vigente;
  const s = sugerirDificultad(datos);
  return { fisica: s.fisica, tecnica: s.tecnica, origen: "auto" };
}
