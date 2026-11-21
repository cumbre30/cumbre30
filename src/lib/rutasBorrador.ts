// ============================================================
// Borradores de ruta del editor (fase B del módulo Rutas y
// Comunidad, arquitectura v2.1 tabla 6). Vive SOBRE rutasStore
// ("c30.rutas-v2") sin cambiar su contrato: un borrador es una
// RutaV2 con status 'borrador' y los metadatos del §5.
//
// Entradas de geometría admitidas por el editor:
// · trazado multi-waypoint con el motor (useEditorRutas),
// · GPX importado (la línea del archivo se respeta tal cual),
// · crear desde actividad: una traza existente copiada 1:1
//   (coords y distKm sin transformación; gainM solo si vino de
//   GPX — del motor es un 0 ficticio y aquí pasa a null: sin
//   datos de elevación, jamás cero, §5.1).
// Patrón probado en node como rutasStoreFor: la lógica vive en
// borradoresFor(store) con almacenamiento inyectable; la instancia
// de navegador usa el singleton de rutasStore.
// ============================================================

import { rutasStore, rutasStoreFor, type KVStorage, type RutaV2 } from "./rutasStore";
import { attrsValidos, aplicarSugerencias, sugerirDificultad, type Modalidad } from "./dificultad";
import type { LatLng } from "./routing";

/** Tipos de POI cerrados del editor (tabla 4: RoutePoi.tipo). */
export const TIPOS_POI = ["agua", "mirador", "descanso", "comida", "estacionamiento", "peligro", "otro"] as const;
export type TipoPoi = (typeof TIPOS_POI)[number];

export type PoiEntrada = NonNullable<RutaV2["pois"]>[number];

export type MetadatosBorrador = {
  nombre: string;
  descripcion?: string;
  modalidad: Modalidad;
  attrs?: string[];
  dificultadFisica: 1 | 2 | 3 | 4 | 5;
  dificultadTecnica: 1 | 2 | 3 | 4 | 5;
  dificultadOrigen: "auto" | "creador";
  pois?: PoiEntrada[];
};

export type BorradorRuta = RutaV2;

const limpiarTexto = (s: string, max: number): string => s.trim().slice(0, max);

/** Reordena por 'orden' y re-numera 0..n (RoutePoi.orden). */
export function ordenarPois(pois: PoiEntrada[]): PoiEntrada[] {
  return [...pois].sort((a, b) => a.orden - b.orden).map((p, i) => ({ ...p, orden: i }));
}

/** Agrega un POI validando tipo cerrado y datos mínimos. */
export function agregarPoi(
  pois: PoiEntrada[] | undefined,
  poi: { tipo: string; nombre: string; nota?: string; lat: number; lon: number },
): PoiEntrada[] {
  const tipo = (TIPOS_POI as readonly string[]).includes(poi.tipo) ? poi.tipo : "otro";
  const previa = pois ?? [];
  return ordenarPois([
    ...previa,
    {
      id: crypto.randomUUID(),
      orden: previa.length,
      tipo,
      nombre: limpiarTexto(poi.nombre, 60),
      nota: poi.nota ? limpiarTexto(poi.nota, 200) : undefined,
      lat: poi.lat,
      lon: poi.lon,
    },
  ]);
}

/** Crea el borrador (sin guardar) desde una geometría ya trazada.
 *  gainM: null cuando no hay fuente (§5.1: null explícito, jamás 0). */
export function nuevoBorrador(entrada: {
  nombre?: string;
  coords: LatLng[];
  distKm: number;
  gainM: number | null;
  eleFuente?: "gpx" | "servicio" | null;
  /** Elevación por punto (fase C): debe venir ALINEADA con coords.
   *  Solo se guarda si hay gain real — jamás array de ceros (§5.1). */
  eleM?: (number | null)[];
  waypoints?: LatLng[];
  descripcion?: string;
  modalidad?: Modalidad;
  attrs?: string[];
  dificultadFisica?: 1 | 2 | 3 | 4 | 5;
  dificultadTecnica?: 1 | 2 | 3 | 4 | 5;
  dificultadOrigen?: "auto" | "creador";
  pois?: PoiEntrada[];
}): BorradorRuta {
  const modalidad = entrada.modalidad ?? "pavimento";
  const attrs = attrsValidos(entrada.attrs);
  const distKm = entrada.distKm;
  const gain = entrada.gainM != null && entrada.gainM > 0 ? entrada.gainM : null;
  const sug = sugerirDificultad({ distKm, gainM: gain, modalidad, attrs: attrs ?? [] });
  const fisica = entrada.dificultadFisica ?? sug.fisica;
  const tecnica = entrada.dificultadTecnica ?? sug.tecnica;
  return {
    id: crypto.randomUUID(),
    kind: "ruta",
    nombre: limpiarTexto(entrada.nombre ?? "", 80) || "Ruta sin título",
    descripcion: entrada.descripcion ? limpiarTexto(entrada.descripcion, 2000) : undefined,
    coords: entrada.coords,
    waypoints: entrada.waypoints?.map((p) => ({ lat: p.lat, lon: p.lon })),
    distKm,
    gainM: gain,
    eleFuente: gain != null ? (entrada.eleFuente ?? "gpx") : null,
    eleM: gain != null && entrada.eleM && entrada.eleM.length === entrada.coords.length ? entrada.eleM : undefined,
    createdAt: new Date().toISOString(),
    origen: entrada.eleFuente === "gpx" ? "gpx" : "motor",
    status: "borrador",
    modalidad,
    attrs: attrs ?? undefined,
    dificultadFisica: fisica,
    dificultadTecnica: tecnica,
    dificultadOrigen: entrada.dificultadOrigen ?? "auto",
    pois: entrada.pois?.length ? ordenarPois(entrada.pois) : undefined,
  };
}

/** «Crear desde actividad»: copia una traza existente 1:1 como
 *  borrador de ruta (coords, kind y distKm sin transformación). */
export function borradorDesdeTraza(t: { nombre: string; coords: LatLng[]; distKm: number; gainM: number; origen: "motor" | "gpx" }): BorradorRuta {
  return nuevoBorrador({
    nombre: `${t.nombre} (ruta)`,
    coords: t.coords,
    distKm: t.distKm,
    // gainM del motor es 0 ficticio (useCreadorTrazas.ts:96): null.
    gainM: t.origen === "gpx" && t.gainM > 0 ? t.gainM : null,
    eleFuente: t.origen === "gpx" && t.gainM > 0 ? "gpx" : null,
  });
}

/** Fábrica pura de la lógica de borradores sobre un store inyectable
 *  (probable en node con storage fake). */
export function borradoresFor(store: ReturnType<typeof rutasStoreFor>) {
  /** Guarda un borrador nuevo en el store. */
  function guardarBorrador(b: BorradorRuta): RutaV2 {
    const { id: _omit, ...resto } = b;
    void _omit;
    return store.add({ ...resto, status: "borrador" });
  }

  /** Guarda cambios de un borrador existente; recalcula sugerencias
   *  si el origen es 'auto' (§5.2: nunca sobrescribe al creador). */
  function actualizarBorrador(
    id: string,
    patch: Partial<MetadatosBorrador> & {
      coords?: LatLng[];
      distKm?: number;
      gainM?: number | null;
      eleFuente?: "gpx" | "servicio" | null;
      /** Elevación por punto alineada con las coords finales. */
      eleM?: (number | null)[];
      /** «Revisé esta ruta hoy» (§7.4): actualiza la vigencia. */
      ultimaRevisionAt?: string;
      waypoints?: LatLng[];
    },
  ): RutaV2 | null {
    const actual = store.get().find((r) => r.id === id);
    if (!actual) return null;
    const distKm = patch.distKm ?? actual.distKm;
    const gainM = patch.gainM !== undefined ? (patch.gainM != null && patch.gainM > 0 ? patch.gainM : null) : actual.gainM;
    const modalidad = (patch.modalidad ?? actual.modalidad ?? "pavimento") as Modalidad;
    const attrs = (patch.attrs ? attrsValidos(patch.attrs) : actual.attrs ? attrsValidos(actual.attrs) : null) ?? [];
    const dificultad = aplicarSugerencias(
      {
        fisica: patch.dificultadFisica ?? actual.dificultadFisica ?? 1,
        tecnica: patch.dificultadTecnica ?? actual.dificultadTecnica ?? 1,
        origen: patch.dificultadOrigen ?? actual.dificultadOrigen ?? "auto",
      },
      { distKm, gainM, modalidad, attrs },
    );
    // El update del store hace spread del patch: un campo undefined
    // SOBREESCRIBIRÍA el valor existente, así que se arman solo los
    // campos que realmente cambian (patch sin claves indefinidas).
    const p: Partial<RutaV2> = { status: "borrador" };
    const asignar = <K extends keyof RutaV2>(k: K, v: RutaV2[K] | undefined): void => {
      if (v !== undefined) p[k] = v;
    };
    if (patch.nombre !== undefined) asignar("nombre", limpiarTexto(patch.nombre, 80));
    if (patch.descripcion !== undefined) asignar("descripcion", limpiarTexto(patch.descripcion, 2000));
    asignar("modalidad", modalidad);
    asignar("attrs", attrs.length > 0 ? attrs : undefined);
    asignar("dificultadFisica", dificultad.fisica);
    asignar("dificultadTecnica", dificultad.tecnica);
    asignar("dificultadOrigen", dificultad.origen);
    if (patch.pois !== undefined) asignar("pois", ordenarPois(patch.pois));
    if (patch.coords !== undefined) asignar("coords", patch.coords);
    if (patch.waypoints !== undefined) asignar("waypoints", patch.waypoints.map((w) => ({ lat: w.lat, lon: w.lon })));
    asignar("distKm", distKm);
    asignar("gainM", gainM);
    if (patch.eleFuente !== undefined) asignar("eleFuente", gainM != null ? patch.eleFuente ?? "gpx" : null);
    // eleM: solo si queda alineada con las coords finales y hay gain
    // real; si la nueva geometría la desalinea se ELIMINA explícitamente
    // (asignar() salta undefined por diseño, aquí el borrado es el
    // comportamiento buscado — perfil honesto, §5.1).
    const coordsFinales = patch.coords ?? actual.coords;
    const eleFinales = patch.eleM !== undefined ? patch.eleM : actual.eleM;
    if (patch.eleM !== undefined || patch.coords !== undefined) {
      p.eleM = gainM != null && eleFinales && eleFinales.length === coordsFinales.length ? eleFinales : undefined;
    }
    if (patch.ultimaRevisionAt !== undefined) asignar("ultimaRevisionAt", patch.ultimaRevisionAt);
    return store.update(id, p);
  }

  /** Lista de borradores (status 'borrador'), más recientes primero. */
  function listarBorradores(): RutaV2[] {
    return store.get().filter((r) => r.status === "borrador");
  }

  return { guardarBorrador, actualizarBorrador, listarBorradores };
}

// ---------- instancia de navegador (usa el singleton del store) ----------
export const borradores = borradoresFor(rutasStore);
