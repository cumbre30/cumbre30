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
import { RUTAS_TRAZADOS } from "./rutasTrazados";
import { PUENTE_TUPAHUE_CUMBRE } from "./reglasParque";

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
      "Travesía desde Acceso Zapadores bajando por Avenida La Montaña a Tupahue, hasta el puente Mackenna-Bannen (corte horario fin de semana), y descenso final por Av. Carlos Martner y Av. Abate Molina a Pedro de Valdivia Norte. Sin Plaza México ni Carlos Reed.",
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
// CAPA 3 · PUNTOS DE INTERÉS (12)
// Cruces, servicios, miradores y alertas peatonales.
// ------------------------------------------------------------

export type CapaPuntoBase = {
  id: string;
  nombre: string;
  detalle: string;
  emoji: string;
  position: LatLng;
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
    // posición GPX referencial (sobre Av. Pedro Bannen, entre Tupahue y Plaza México)
    position: { lat: -33.4215, lon: -70.6288 },
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
    // posición GPX referencial (dentro del parque)
    position: { lat: -33.409, lon: -70.6215 },
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
    // posición verificada (NAV_DESTINATIONS plaza-mexico)
    position: { lat: -33.4234, lon: -70.6327 },
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
    // posición GPX referencial (dentro del parque)
    position: { lat: -33.4195, lon: -70.6218 },
  },
  // --- Miradores ---
  {
    id: "terraza-bellavista",
    nombre: "Mirador Terraza Bellavista",
    detalle:
      "Vista panorámica hacia el centro y poniente de Santiago entre el Zoológico y Tupahue.",
    emoji: "🔭",
    sub: "mirador",
    // posición GPX (coincide con el camino Pío Nono)
    position: { lat: -33.4285, lon: -70.6345 },
  },
  {
    id: "mirador-hundido",
    nombre: "Mirador Hundido / Sector Antenas",
    detalle: "Punto alto de referencia visual en la zona de cumbres.",
    emoji: "🔭",
    sub: "mirador",
    // posición GPX referencial (dentro del parque)
    position: { lat: -33.4165, lon: -70.6295 },
  },
  // --- Precaución peatonal ---
  {
    id: "precau-zoo",
    nombre: "Precaución: Zoológico Nacional",
    detalle:
      "Alto flujo de peatones, familias y detención de buses en tramo bajo de Pío Nono. Reducir velocidad.",
    emoji: "⚠️",
    sub: "precaucion",
    // posición verificada (RISK_ZONES zoologico)
    position: { lat: -33.429636, lon: -70.633963 },
  },
  {
    id: "precau-cumbre",
    nombre: "Precaución: Estación Cumbre Teleférico / Funicular",
    detalle: "Cruce constante de turistas en las inmediaciones de Plaza México.",
    emoji: "⚠️",
    sub: "precaucion",
    // posición GPX referencial (junto a Plaza México)
    position: { lat: -33.4248, lon: -70.6331 },
  },
  {
    id: "precau-torre5",
    nombre: "Precaución: Cruce Sendero Torre 5",
    detalle:
      "Ingreso y salida de ciclistas de enduro hacia senderos técnicos Torre 5 y 4½.",
    emoji: "⚠️",
    sub: "precaucion",
    // posición GPX referencial (sector cumbre)
    position: { lat: -33.4232, lon: -70.6315 },
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
    // EN EL PUENTE que une Av. Alberto Mackenna con Av. Pedro Bannen en
    // Tupahue (cliente: «dónde tenemos el puente»), nodo compartido del
    // grafo OSM propio (2026-11-12).
    position: PUENTE_TUPAHUE_CUMBRE,
  },
  {
    id: "control-30",
    nombre: "Control velocidad máx. 30 km/h (bajadas principales)",
    detalle:
      "Límite máximo de 30 km/h en vías interiores fiscalizado por Carabineros (plan Pedalea Seguro).",
    emoji: "🐢",
    // posición GPX referencial (bajada principal)
    position: { lat: -33.4202, lon: -70.625 },
  },
  {
    id: "control-qr",
    nombre: "Control QR obligatorio MTB (Circuito Los Gemelos)",
    detalle:
      "Registro digital y código QR obligatorio en la bici para uso de senderos enduro/MTB desde diciembre 2026.",
    emoji: "📱",
    // posición GPX referencial (base del circuito, junto a La Rotonda)
    position: { lat: -33.4093, lon: -70.6213 },
  },
  {
    id: "soporte-pdv",
    nombre: "Punto soporte: Estación reparación y agua (Pedro de Valdivia)",
    detalle:
      "Punto de herramientas básicas, bombín y bebedero de agua potable en base oriente.",
    emoji: "🛠️",
    // GPX caía fuera del parque → ~100 m dentro del Acceso PdV Norte
    position: { lat: -33.4122, lon: -70.6088 },
  },
  {
    id: "soporte-tupahue",
    nombre: "Punto soporte: Bebedero y guardaparques Tupahue",
    detalle:
      "Punto confirmado de hidratación, asistencia de guardaparques y primeros auxilios en zona media.",
    emoji: "🛠️",
    // posición GPX referencial (zona Tupahue)
    position: { lat: -33.4213, lon: -70.6285 },
  },
  {
    id: "soporte-pio-nono",
    nombre: "Punto soporte: Caseta seguridad y agua (Pío Nono)",
    detalle:
      "Punto de asistencia, información y recarga de agua en acceso sur-poniente.",
    emoji: "🛠️",
    // GPX caía fuera del parque → junto al Acceso Pío Nono
    position: { lat: -33.4305, lon: -70.6358 },
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
    // Plaza Baquedano (posición de referencia conocida); GPX a ~130 m
    position: { lat: -33.437, lon: -70.6331 },
  },
  {
    id: "metro-pdv",
    nombre: "Conexión Metro Pedro de Valdivia (L1)",
    detalle:
      "Enlace directo hacia Acceso Pedro de Valdivia Norte cruzando el Río Mapocho.",
    emoji: "🚇",
    // posición GPX
    position: { lat: -33.4221, lon: -70.6146 },
  },
  {
    id: "metro-zapadores",
    nombre: "Conexión Metro Zapadores (L2)",
    detalle:
      "Estación de acercamiento al Acceso Zapadores en el sector norte de Recoleta.",
    emoji: "🚇",
    // posición GPX (Av. Recoleta, línea 2 norte)
    position: { lat: -33.3958, lon: -70.6421 },
  },
  {
    id: "ciclovia-andres-bello",
    nombre: "Enlace Ciclovía Andrés Bello / Costanera",
    detalle:
      "Eje ciclista estructurante que conecta directamente con Acceso Pedro de Valdivia Norte y Pío Nono.",
    emoji: "🚲",
    // posición GPX (orilla sur del río Mapocho)
    position: { lat: -33.4202, lon: -70.6168 },
  },
  {
    id: "ciclovia-av-peru",
    nombre: "Enlace Ciclovía Avenida Perú",
    detalle:
      "Corredor ciclista poniente en Recoleta que enlaza los sectores de Pío Nono y Zapadores.",
    emoji: "🚲",
    // posición GPX (Av. Perú, Recoleta)
    position: { lat: -33.4225, lon: -70.6412 },
  },
  {
    id: "ciclovia-santa-maria",
    nombre: "Enlace Ciclovía Santa María / Vitacura",
    detalle:
      "Aproximación segura desde el sector oriente hacia el Acceso La Pirámide.",
    emoji: "🚲",
    // posición GPX (Av. Santa María)
    position: { lat: -33.4052, lon: -70.6135 },
  },
];
