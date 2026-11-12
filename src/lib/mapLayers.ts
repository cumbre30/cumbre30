// ============================================================
// Arquitectura del MAPA GENERAL en 5 capas (GPX "Arquitectura
// Completa Ciclistas - Cerro San Cristóbal", Parquemet).
//
//   1. Accesos              → entradas y salidas oficiales (4)
//   2. Rutas                → trazados de pavimento y circuitos MTB (6)
//   3. Puntos de Interés    → cruces, servicios, miradores y alertas (12)
//   4. Normativa y Seguridad→ cortes horarios, límites y soporte (6)
//   5. Conexión Urbana      → metro y ciclovías externas (6)
//
// POLÍTICA DE COORDENADAS: el GPX del cliente es la arquitectura
// (nombres, categorías y recorridos), pero trae una deriva
// sistemática de ~1-2 km al oeste (p. ej. ubica Piscina Antilén en
// -70.6312 cuando la real es -70.6137). Por eso:
//   · Puntos con posición VERIFICADA en el proyecto (GATES,
//     PARK_PLACES, RISK_ZONES, NAV_DESTINATIONS) → coordenada real.
//   · Puntos sin verificación → posición del GPX referencial
//     (marcada en el comentario de cada punto).
//   · Trazados de rutas → generados con el motor A* real sobre el
//     grafo OSM propio (scripts/build-rutas.ts) respetando los
//     corredores del GPX (Tupahue, El Ermitaño, Pa' Arriba…).
// ============================================================

import { GATES, RISK_ZONES, type LatLng } from "./park";
import { BAJADAS_CONTROL_30, RUTAS_TRAZADOS } from "./rutasTrazados";

// ------------------------------------------------------------
// Destinos del MINIMAPA (limpieza pedida por el cliente, 2026-11-12):
// SOLO los accesos habilitados para ciclistas — sin opciones de ruta ni
// otros destinos (el listado completo vive en el mapa general, pestaña
// Explorar). Las alternativas de voz del corte horario (Av. Gabriela
// Mistral / Av. Carlos Martner) siguen vivas en routingService.
// ------------------------------------------------------------

export const MINIMAP_ACCESOS: { id: string; name: string; position: LatLng }[] = GATES.filter((g) => g.ciclistas).map((g) => ({
  id: g.id,
  name: `🚴 ${g.name}`,
  position: g.position,
}));

export const MINIMAP_DESTINOS: { id: string; name: string; position: LatLng }[] = MINIMAP_ACCESOS;

// ------------------------------------------------------------
// CAPA 1 · ACCESOS OFICIALES HABILITADOS PARA CICLISTAS (4)
// ------------------------------------------------------------

export type CapaAcceso = {
  id: string;
  nombre: string;
  detalle: string;
  position: LatLng;
};

const ACCESOS_DETALLE: Record<string, string> = {
  "pio-nono":
    "Entrada habilitada para ciclistas en Recoleta/Providencia. Horario: 06:00 a 20:30 hrs.",
  "pv-norte":
    "Entrada habilitada para ciclistas en Providencia: Parque Metropolitano Pedro de Valdivia Norte (Av. El Cerro 678), por la CicloRecreoVía hasta la ladera y el Paseo Metropolitano.",
  "la-piramide":
    "Entrada habilitada para ciclistas en Vitacura. Acceso directo al Circuito Los Gemelos y Paseo Metropolitano.",
  zapadores:
    "Entrada habilitada para ciclistas en Recoleta (sector norte). Subida pavimentada de alta pendiente.",
};

export const CAPA_ACCESOS: CapaAcceso[] = GATES.filter((g) => g.ciclistas).map((g) => ({
  id: g.id,
  nombre: g.name,
  detalle: ACCESOS_DETALLE[g.id] ?? "",
  position: g.position,
}));

// ------------------------------------------------------------
// CAPA 2 · RUTAS PREDEFINIDAS (PAVIMENTO + MTB) (9)
// Trazados reales: ver scripts/build-rutas.ts (motor A* propio).
// ------------------------------------------------------------

export type CapaRuta = {
  id: string;
  /** id del trazado en rutasTrazados.ts */
  trz: string;
  nombre: string;
  tipo: "pavimento" | "mtb";
  /** etiqueta corta de esfuerzo, derivada de la descripción del cliente */
  nivel: string;
  detalle: string;
  emoji: string;
  /** color de línea sobre el mapa (pavimento azul · MTB naranja) */
  color: string;
};

export const CAPA_RUTAS: CapaRuta[] = [
  {
    id: "ruta-1",
    trz: "r1",
    nombre: "Ruta 1 · Clásica Cumbre por Pedro de Valdivia",
    tipo: "pavimento",
    nivel: "Fluida y directa",
    detalle:
      "Subida fluida y directa desde el Acceso Pedro de Valdivia Norte (cruce Av. El Cerro × Av. PdV Norte): sube por Av. Abate Molina y Av. Gabriela Mistral, cruza a Av. Pedro Bannen en Tupahue y llega a Plaza México.",
    emoji: "🚴",
    color: "#0ea5e9",
  },
  {
    id: "ruta-2",
    trz: "r2",
    nombre: "Ruta 2 · Clásica Cumbre por Pío Nono",
    tipo: "pavimento",
    nivel: "Tradicional",
    detalle:
      "El mismo trazado de la navegación a Plaza México del minimapa: sube por Av. Alberto Mackenna desde Pío Nono, cruza el puente de Tupahue y toma Av. Pedro Bannen hasta Plaza México.",
    emoji: "🚴",
    color: "#0ea5e9",
  },
  {
    id: "ruta-3",
    trz: "r3",
    nombre: "Ruta 3 · Travesía Zapadores - Pedro de Valdivia",
    tipo: "pavimento",
    nivel: "Exigente",
    detalle:
      "Travesía desde Acceso Zapadores bajando por Avenida La Montaña: en el empalme sigue siempre por Av. Abate Molina hasta Pedro de Valdivia Norte, pasando por las 2 zonas de riesgo de la bajada (Jardín Japonés y Salida Pedro de Valdivia). Sin desvío a Carlos Martner ni Carlos Reed.",
    emoji: "🚴",
    color: "#0ea5e9",
  },
  {
    id: "ruta-4",
    trz: "r4",
    nombre: "Ruta 4 · Circuito La Pirámide - Anfiteatro",
    tipo: "pavimento",
    nivel: "Moderada",
    detalle:
      "Desde Acceso La Pirámide por el camino de crestería norte (Zañartu · Claudio Gay) hasta Av. Pablo Neruda y el Anfiteatro Pablo Neruda.",
    emoji: "🚴",
    color: "#0ea5e9",
  },
  {
    id: "ruta-5",
    trz: "r5",
    nombre: "Ruta 5 · Vuelta Completa (4 accesos)",
    tipo: "pavimento",
    nivel: "Exigente · larga",
    detalle:
      "Vuelta completa al cerro conectando los 4 accesos: subida por Pío Nono (sólo subida), Tupahue, tramo norte por Zapadores y La Pirámide, con cierre por la bajada oriente hasta Pedro de Valdivia Norte. Sin bajada por Pío Nono ni tramos por Carlos Reed.",
    emoji: "🚴",
    color: "#0ea5e9",
  },
  {
    id: "mtb-1",
    trz: "mtb1",
    nombre: "MTB 1 · Loop Los Gemelos (Pa' Arriba + descenso Zorzal/Anfiteatro)",
    tipo: "mtb",
    nivel: "Básico / Intermedio",
    detalle:
      "Loop del circuito Los Gemelos: desde La Rotonda por Pa' Arriba al sector alto y descenso por Anfiteatro/Zorzal de vuelta.",
    emoji: "🚵",
    color: "#f97316",
  },
  {
    id: "mtb-2",
    trz: "mtb2",
    nombre: "MTB 2 · Loop Técnico La S",
    tipo: "mtb",
    nivel: "Avanzado",
    detalle:
      "Loop técnico en la zona Los Gemelos: ascenso por Pa' Arriba y descenso por La S (sendero de descenso exclusivo) hasta La Rotonda.",
    emoji: "🚵",
    color: "#f97316",
  },
  {
    id: "mtb-3",
    trz: "mtb3",
    nombre: "MTB 3 · Travesía Paseo Metropolitano",
    tipo: "mtb",
    nivel: "Suave · XC/Gravel",
    detalle:
      "Travesía XC/Gravel por el anillo de caminos amplios del Paseo Metropolitano, desde el acceso poniente hasta el sector La Pirámide.",
    emoji: "🚵",
    color: "#f97316",
  },
  {
    id: "mtb-4",
    trz: "mtb4",
    nombre: "MTB 4 · Enduro Torre 5 - PdV Norte",
    tipo: "mtb",
    nivel: "Técnico",
    detalle:
      "Ascenso por el camino oriente al sector Torre 5 y descenso técnico por el sendero Torre 5 hasta la base Pedro de Valdivia Norte.",
    emoji: "🚵",
    color: "#f97316",
  },
];

/** Distancia y trazado de una ruta (desde rutasTrazados.ts). */
export function rutaTrazado(r: CapaRuta): { coords: LatLng[]; distKm: number } {
  const t = RUTAS_TRAZADOS[r.trz];
  return {
    coords: (t?.coords ?? []).map(([lat, lon]) => ({ lat, lon })),
    distKm: t?.distKm ?? 0,
  };
}

// ------------------------------------------------------------
// BAJADAS CON CONTROL DE VELOCIDAD 30 KM/H (cliente 2026-11-13):
// «Control velocidad máx. 30 km/h (bajadas principales), al marcar
// pintar trazado en rojo y que se vean los 3». Trazados precomputados
// con el motor A* (scripts/build-rutas.ts) por el pavimento del
// parque, SIN reglas direccionales (son geometría de la vía).
// ------------------------------------------------------------

export type Bajada30 = { id: string; nombre: string; coords: LatLng[]; distKm: number };

export const BAJADAS_30: Bajada30[] = BAJADAS_CONTROL_30.map((b) => ({
  id: b.id,
  nombre: b.nombre,
  coords: b.coords.map(([lat, lon]) => ({ lat, lon })),
  distKm: b.distKm,
}));

// ------------------------------------------------------------
// CAPA 3 · PUNTOS DE INTERÉS (12)
// Cruces, servicios, miradores y alertas peatonales.
// ------------------------------------------------------------

export type CapaPuntoBase = {
  id: string;
  nombre: string;
  detalle: string;
  emoji: string;
  position: LatLng;
  /** Item listado en la capa pero SIN marcador en el mapa (cliente
   *  2026-11-13: «borra el punto 🐢 en el mapa, dejar sólo en la capa»). */
  sinMarcador?: boolean;
};

export type CapaPunto = CapaPuntoBase & {
  /** subcategoría para agrupar en el menú (solo Puntos de Interés) */
  sub: "conexion" | "servicio" | "mirador" | "precaucion";
};

export const SUB_ETIQUETAS: Record<CapaPunto["sub"], string> = {
  conexion: "Puntos de conexión",
  servicio: "Servicio y descanso",
  mirador: "Miradores",
  precaucion: "Precaución peatonal",
};

export const CAPA_POIS: CapaPunto[] = [
  // --- Puntos de conexión ---
  {
    id: "nodo-tupahue",
    nombre: "Plaza Tupahue (Nodo Central)",
    detalle:
      "Cruce principal donde convergen rutas de Pedro de Valdivia, Pío Nono y Zapadores hacia la Cumbre.",
    emoji: "🔀",
    sub: "conexion",
    // Coordenada exacta del cliente (2026-11-13): cruce real de la Plaza Tupahue.
    position: { lat: -33.41566193234907, lon: -70.62253008246276 },
  },
  {
    id: "el-ermitano",
    nombre: "Sector El Ermitaño / La Cantera",
    detalle:
      "Enlace clave en la ladera norte que conecta ascenso Zapadores con Tupahue y Paseo Metropolitano.",
    emoji: "🔀",
    sub: "conexion",
    // GPX caía fuera del parque → nodo real del Acceso Paseo Metropolitano (OSM)
    position: { lat: -33.412407, lon: -70.623052 },
  },
  {
    id: "la-rotonda",
    nombre: "La Rotonda (Sector La Pirámide)",
    detalle:
      "Base operativa del Circuito Cerro Los Gemelos. Inicio subida Pa' Arriba y llegada descensos MTB.",
    emoji: "🔀",
    sub: "conexion",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.407601, lon: -70.611192 },
  },
  {
    id: "anfiteatro",
    nombre: "Anfiteatro Pablo Neruda",
    detalle:
      "Hito alto en sector oriente. Final de subida Pa' Arriba e inicio de senderos Anfiteatro, Zorzal y La S.",
    emoji: "🎭",
    sub: "conexion",
    // posición verificada (PARK_PLACES / CUMBRES, OSM-Nominatim 2026-11-11)
    position: { lat: -33.40401, lon: -70.60956 },
  },
  // --- Servicio y descanso ---
  {
    id: "plaza-mexico",
    nombre: "Plaza México (Cumbre)",
    detalle:
      "Meta de rutas de pavimento. Cuenta con bicicleteros, hidratación, servicios y acceso a Santuario.",
    emoji: "⛲",
    sub: "servicio",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.42387320247046, lon: -70.63255907914812 },
  },
  {
    id: "piscina-antilen",
    nombre: "Piscina Antilén",
    detalle:
      "Cumbre sector norte (Cerro Chacarillas). Zona de pausa, servicios y mirador 360.",
    emoji: "🏊",
    sub: "servicio",
    // posición verificada; el GPX la ubicaba ~1.7 km al oeste
    position: { lat: -33.409051, lon: -70.61374 },
  },
  {
    id: "mapulemu",
    nombre: "Jardín Mapulemu / Plaza Gabriela Mistral",
    detalle:
      "Zona de sombra, bancas y descanso en la subida de Pedro de Valdivia Norte.",
    emoji: "🌳",
    sub: "servicio",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.414644, lon: -70.620398 },
  },
  // --- Miradores ---
  {
    id: "terraza-bellavista",
    nombre: "Mirador Terraza Bellavista",
    detalle:
      "Vista panorámica hacia el centro y poniente de Santiago entre el Zoológico y Tupahue.",
    emoji: "🔭",
    sub: "mirador",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.42618, lon: -70.63411 },
  },
  {
    id: "mirador-hundido",
    nombre: "Mirador Hundido / Sector Antenas",
    detalle: "Punto alto de referencia visual en la zona de cumbres.",
    emoji: "🔭",
    sub: "mirador",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.419353, lon: -70.625013 },
  },
  // --- Precaución peatonal ---
  {
    id: "precau-zoo",
    nombre: "Precaución: Zoológico Nacional",
    detalle:
      "Alto flujo de peatones, familias y detención de buses en tramo bajo de Pío Nono. Reducir velocidad.",
    emoji: "⚠️",
    sub: "precaucion",
    // Coordenada exacta del cliente (2026-11-13) = Advertencia RISK_ZONES zoologico.
    position: { lat: -33.429544, lon: -70.636007 },
  },
  {
    id: "precau-cumbre",
    nombre: "Precaución: Estación Cumbre Teleférico / Funicular",
    detalle: "Cruce constante de turistas en las inmediaciones de Plaza México.",
    emoji: "⚠️",
    sub: "precaucion",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.425882, lon: -70.632243 },
  },
  {
    id: "precau-torre5",
    nombre: "Precaución: Cruce Sendero Torre 5",
    detalle:
      "Ingreso y salida de ciclistas de enduro hacia senderos técnicos Torre 5 y 4½.",
    emoji: "⚠️",
    sub: "precaucion",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.40415, lon: -70.60739 },
  },
];

// ------------------------------------------------------------
// CAPA 4 · NORMATIVA, SEGURIDAD Y SOPORTE TÉCNICO
// (cortes horarios, límites, soporte y advertencias de riesgo)
// ------------------------------------------------------------

export const CAPA_NORMATIVA: CapaPuntoBase[] = [
  {
    id: "corte-tupahue",
    nombre: "Corte horario fin de semana (Tupahue → Cumbre)",
    detalle:
      "Restricción de paso en bicicleta hacia la Cumbre los sábados, domingos y festivos desde las 13:30 hrs.",
    emoji: "🚫",
    // Coordenada exacta del cliente (2026-11-13) para el MARCADOR de la
    // capa. El CORTE de ruteo sigue anclado en el nodo real del puente
    // Mackenna ↔ Bannen (PUENTE_TUPAHUE_CUMBRE en reglasParque) — mover
    // este marcador no cambia las reglas de navegación.
    position: { lat: -33.416203, lon: -70.622936 },
  },
  {
    id: "control-30",
    nombre: "Control velocidad máx. 30 km/h (bajadas principales)",
    detalle:
      "Límite máximo de 30 km/h en las 3 bajadas principales, fiscalizado por Carabineros (plan Pedalea Seguro): Cima Chacarillas → Acceso La Pirámide, Plaza Antilén → Acceso Pedro de Valdivia Norte y Plaza México → Acceso Pío Nono. Al activar la capa se pintan los 3 trazados en rojo.",
    emoji: "🐢",
    // Sin punto en el mapa (cliente 2026-11-13): los 3 trazados rojos son
    // ahora la representación del control. El ítem queda en la capa y al
    // elegirlo se enmarcan los 3 corredores (MapView·enfocar).
    sinMarcador: true,
    // Posición referencial de la bajada principal (no se dibuja).
    position: { lat: -33.4202, lon: -70.625 },
  },
  {
    id: "control-qr",
    nombre: "Control QR obligatorio MTB (Circuito Los Gemelos)",
    detalle:
      "Registro digital y código QR obligatorio en la bici para uso de senderos enduro/MTB desde diciembre 2026.",
    emoji: "📱",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.3989, lon: -70.6085 },
  },
  {
    id: "soporte-pdv",
    nombre: "Punto soporte: Estación reparación y agua (Pedro de Valdivia)",
    detalle:
      "Punto de herramientas básicas, bombín y bebedero de agua potable en base oriente.",
    emoji: "🛠️",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.415149, lon: -70.617559 },
  },
  {
    id: "soporte-tupahue",
    nombre: "Punto soporte: Bebedero y guardaparques Tupahue",
    detalle:
      "Punto confirmado de hidratación, asistencia de guardaparques y primeros auxilios en zona media.",
    emoji: "🛠️",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.41627, lon: -70.62327 },
  },
  {
    id: "soporte-pio-nono",
    nombre: "Punto soporte: Caseta seguridad y agua (Pío Nono)",
    detalle:
      "Punto de asistencia, información y recarga de agua en acceso sur-poniente.",
    emoji: "🛠️",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.430237, lon: -70.636087 },
  },
  // --- Círculos amarillos de advertencia (zonas de riesgo RISK_ZONES,
  //     cliente: «agrégalos a la capa del mapa en categoría Normativa y
  //     Seguridad») — posiciones y textos sincronizados con park.ts ---
  ...RISK_ZONES.map((z) => ({
    id: `riesgo-${z.id}`,
    nombre: `Advertencia: ${z.name}`,
    detalle: z.voice,
    emoji: "⚠️",
    position: z.position,
  })),
];

// ------------------------------------------------------------
// CAPA 5 · CONEXIÓN URBANA: METRO Y CICLOVÍAS EXTERNAS (6)
// ------------------------------------------------------------

export const CAPA_URBANA: CapaPuntoBase[] = [
  {
    id: "metro-baquedano",
    nombre: "Conexión Metro Baquedano (L1 / L5)",
    detalle:
      "Estación intermodal más cercana al Acceso Pío Nono (aprox. 450 m por Pío Nono / Parque Forestal).",
    emoji: "🚇",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.4374699337498, lon: -70.63415952369353 },
  },
  {
    id: "metro-pdv",
    nombre: "Conexión Metro Pedro de Valdivia (L1)",
    detalle:
      "Enlace directo hacia Acceso Pedro de Valdivia Norte cruzando el Río Mapocho.",
    emoji: "🚇",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.42547618122174, lon: -70.61427439161757 },
  },
  {
    id: "metro-zapadores",
    nombre: "Conexión Metro Zapadores (L2)",
    detalle:
      "Estación de acercamiento al Acceso Zapadores en el sector norte de Recoleta.",
    emoji: "🚇",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.39115837341313, lon: -70.64246117507359 },
  },
  {
    id: "ciclovia-andres-bello",
    nombre: "Enlace Ciclovía Andrés Bello / Costanera",
    detalle:
      "Eje ciclista estructurante que conecta directamente con Acceso Pedro de Valdivia Norte y Pío Nono.",
    emoji: "🚲",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.416492, lon: -70.607373 },
  },
  {
    id: "ciclovia-av-peru",
    nombre: "Enlace Ciclovía Avenida Perú",
    detalle:
      "Corredor ciclista poniente en Recoleta que enlaza los sectores de Pío Nono y Zapadores.",
    emoji: "🚲",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.421135, lon: -70.64055 },
  },
  {
    id: "ciclovia-santa-maria",
    nombre: "Enlace Ciclovía Santa María / Vitacura",
    detalle:
      "Aproximación segura desde el sector oriente hacia el Acceso La Pirámide.",
    emoji: "🚲",
    // Coordenada exacta del cliente (2026-11-13).
    position: { lat: -33.388756, lon: -70.599442 },
  },
];
