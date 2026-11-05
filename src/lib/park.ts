// ============================================================
// Datos calibrados del Parque Metropolitano de Santiago
// (Cerro San Cristóbal). Límite real simplificado desde
// OpenStreetMap way/168227059 (147 vértices, tolerancia ~13 m)
// y POIs geocodificados con Nominatim.
// El límite vigente al interior del parque es 30 km/h (Parquemet).
// 2026-11-05: la CUMBRE deja de ser destino (el Santuario de la
// Virgen es solo peatonal, no se puede subir en bici); Plaza México
// la reemplaza como meta de esa ruta. Se agrega el ACCESO LA
// PIRÁMIDE (Parquemet, Vitacura) como acceso oficial (ver GATES).
// ============================================================

export const LIMIT_KMH = 30;
export const CAUTION_KMH = LIMIT_KMH - 3; // aviso previo a los 27 km/h

export type LatLng = { lat: number; lon: number };

/** Polígono real del Parque Metropolitano (OSM way/168227059). */
export const PARK_POLYGON: LatLng[] = [
  { lat: -33.390803, lon: -70.6013 }, { lat: -33.392585, lon: -70.602554 }, { lat: -33.395955, lon: -70.604509 },
  { lat: -33.395883, lon: -70.604793 }, { lat: -33.396613, lon: -70.605139 }, { lat: -33.396705, lon: -70.60467 },
  { lat: -33.401369, lon: -70.604737 }, { lat: -33.401554, lon: -70.604879 }, { lat: -33.401637, lon: -70.604508 },
  { lat: -33.403625, lon: -70.604284 }, { lat: -33.406972, lon: -70.605349 }, { lat: -33.409147, lon: -70.606524 },
  { lat: -33.410081, lon: -70.607637 }, { lat: -33.411348, lon: -70.607744 }, { lat: -33.411769, lon: -70.607988 },
  { lat: -33.41234, lon: -70.609007 }, { lat: -33.412468, lon: -70.61019 }, { lat: -33.413012, lon: -70.611494 },
  { lat: -33.414259, lon: -70.612363 }, { lat: -33.414518, lon: -70.61293 }, { lat: -33.414102, lon: -70.613556 },
  { lat: -33.414305, lon: -70.613959 }, { lat: -33.414636, lon: -70.614224 }, { lat: -33.415452, lon: -70.612862 },
  { lat: -33.415567, lon: -70.612932 }, { lat: -33.415514, lon: -70.617574 }, { lat: -33.418192, lon: -70.620649 },
  { lat: -33.418975, lon: -70.621253 }, { lat: -33.420967, lon: -70.621945 }, { lat: -33.422642, lon: -70.622936 },
  { lat: -33.425647, lon: -70.623565 }, { lat: -33.425812, lon: -70.62411 }, { lat: -33.425531, lon: -70.625486 },
  { lat: -33.425671, lon: -70.625494 }, { lat: -33.426151, lon: -70.626706 }, { lat: -33.427712, lon: -70.628796 },
  { lat: -33.427932, lon: -70.628671 }, { lat: -33.428078, lon: -70.629012 }, { lat: -33.428713, lon: -70.629487 },
  { lat: -33.430118, lon: -70.631512 }, { lat: -33.43108, lon: -70.634079 }, { lat: -33.430931, lon: -70.634628 },
  { lat: -33.430461, lon: -70.635186 }, { lat: -33.430696, lon: -70.635513 }, { lat: -33.430691, lon: -70.63592 },
  { lat: -33.430543, lon: -70.636165 }, { lat: -33.430104, lon: -70.636115 }, { lat: -33.429931, lon: -70.636597 },
  { lat: -33.429602, lon: -70.636421 }, { lat: -33.428652, lon: -70.637765 }, { lat: -33.428072, lon: -70.639018 },
  { lat: -33.427872, lon: -70.639123 }, { lat: -33.426419, lon: -70.638644 }, { lat: -33.423604, lon: -70.638472 },
  { lat: -33.423856, lon: -70.637343 }, { lat: -33.423369, lon: -70.637173 }, { lat: -33.423259, lon: -70.637717 },
  { lat: -33.423005, lon: -70.637654 }, { lat: -33.422907, lon: -70.637858 }, { lat: -33.422948, lon: -70.638062 },
  { lat: -33.423203, lon: -70.638096 }, { lat: -33.423136, lon: -70.638382 }, { lat: -33.422072, lon: -70.638728 },
  { lat: -33.42201, lon: -70.639297 }, { lat: -33.420965, lon: -70.640078 }, { lat: -33.421038, lon: -70.640426 },
  { lat: -33.42004, lon: -70.640624 }, { lat: -33.418476, lon: -70.639641 }, { lat: -33.418707, lon: -70.639091 },
  { lat: -33.418987, lon: -70.63928 }, { lat: -33.419585, lon: -70.638333 }, { lat: -33.417431, lon: -70.6364 },
  { lat: -33.416971, lon: -70.635304 }, { lat: -33.416703, lon: -70.633235 }, { lat: -33.415417, lon: -70.632339 },
  { lat: -33.414456, lon: -70.630664 }, { lat: -33.414412, lon: -70.62979 }, { lat: -33.414727, lon: -70.629475 },
  { lat: -33.414793, lon: -70.628967 }, { lat: -33.415282, lon: -70.628655 }, { lat: -33.415443, lon: -70.628248 },
  { lat: -33.415241, lon: -70.627787 }, { lat: -33.414733, lon: -70.627362 }, { lat: -33.415069, lon: -70.626621 },
  { lat: -33.415109, lon: -70.6256 }, { lat: -33.412404, lon: -70.623025 }, { lat: -33.411417, lon: -70.623197 },
  { lat: -33.41098, lon: -70.624752 }, { lat: -33.408218, lon: -70.624302 }, { lat: -33.408274, lon: -70.624003 },
  { lat: -33.407643, lon: -70.623701 }, { lat: -33.406058, lon: -70.622193 }, { lat: -33.406085, lon: -70.621599 },
  { lat: -33.406712, lon: -70.620386 }, { lat: -33.406695, lon: -70.619514 }, { lat: -33.40761, lon: -70.619947 },
  { lat: -33.407674, lon: -70.61928 }, { lat: -33.407258, lon: -70.618221 }, { lat: -33.40599, lon: -70.617431 },
  { lat: -33.405562, lon: -70.61728 }, { lat: -33.405195, lon: -70.617415 }, { lat: -33.405186, lon: -70.618482 },
  { lat: -33.40471, lon: -70.61895 }, { lat: -33.403927, lon: -70.618828 }, { lat: -33.403554, lon: -70.617901 },
  { lat: -33.402851, lon: -70.617901 }, { lat: -33.402273, lon: -70.617544 }, { lat: -33.401393, lon: -70.617574 },
  { lat: -33.400361, lon: -70.61876 }, { lat: -33.400025, lon: -70.61962 }, { lat: -33.400087, lon: -70.619877 },
  { lat: -33.399876, lon: -70.619663 }, { lat: -33.399813, lon: -70.620196 }, { lat: -33.398873, lon: -70.620854 },
  { lat: -33.397009, lon: -70.622663 }, { lat: -33.396541, lon: -70.622406 }, { lat: -33.396111, lon: -70.622706 },
  { lat: -33.395716, lon: -70.622166 }, { lat: -33.400099, lon: -70.615372 }, { lat: -33.400066, lon: -70.61513 },
  { lat: -33.398249, lon: -70.613245 }, { lat: -33.397761, lon: -70.612009 }, { lat: -33.396864, lon: -70.611826 },
  { lat: -33.3949, lon: -70.609292 }, { lat: -33.393591, lon: -70.608553 }, { lat: -33.392975, lon: -70.60724 },
  { lat: -33.391781, lon: -70.606836 }, { lat: -33.391331, lon: -70.60645 }, { lat: -33.390771, lon: -70.604281 },
  { lat: -33.389666, lon: -70.602816 }, { lat: -33.389419, lon: -70.602108 }, { lat: -33.389191, lon: -70.602144 },
  { lat: -33.38939, lon: -70.602947 }, { lat: -33.388881, lon: -70.60267 }, { lat: -33.388581, lon: -70.602289 },
  { lat: -33.388594, lon: -70.601966 }, { lat: -33.3868, lon: -70.601671 }, { lat: -33.38666, lon: -70.601289 },
  { lat: -33.387751, lon: -70.600866 }, { lat: -33.388312, lon: -70.600223 }, { lat: -33.388902, lon: -70.600245 },
  { lat: -33.389173, lon: -70.600704 }, { lat: -33.389102, lon: -70.601128 }, { lat: -33.388475, lon: -70.601801 },
  { lat: -33.389486, lon: -70.601908 }, { lat: -33.389943, lon: -70.601395 }, { lat: -33.390803, lon: -70.6013 },
];

export type Gate = {
  id: string;
  name: string;
  position: LatLng;
};

/** Accesos principales donde Parquemet fiscaliza / pide enrolamiento. */
export const GATES: Gate[] = [
  { id: "pio-nono", name: "Acceso Pío Nono", position: { lat: -33.430691, lon: -70.63592 } },
  { id: "pv-norte", name: "Acceso Pedro de Valdivia Norte", position: { lat: -33.411769, lon: -70.607988 } },
  // Acceso La Pirámide (Vitacura): portería al final de Camino La
  // Pirámide, borde nororiente del parque, el acceso más cercano a
  // Bosque Santiago y al Paseo Metropolitano (parquemet.cl,
  // "Acceso La Pirámide", abierto 06:00–20:30). Posición = punto
  // final del way OSM 445801999 "Camino La Pirámide"
  // (-33.38642, -70.60179, verificado el 2026-11-05), a ~40 m de la
  // punta nororiente del polígono del parque.
  { id: "la-piramide", name: "Acceso La Pirámide", position: { lat: -33.38642, lon: -70.60179 } },
];

export type RiskZone = {
  id: string;
  name: string;
  position: LatLng;
  radiusM: number;
  /** Mensaje de voz al aproximarse. */
  voice: string;
};

/** Zonas de riesgo: puntos sensibles de control y accidentes. */
export const RISK_ZONES: RiskZone[] = [
  {
    id: "anahuac",
    name: "Curva Casa de la Cultura Anáhuac",
    position: { lat: -33.417135, lon: -70.623511 },
    radiusM: 140,
    voice: "Atención, curva cerrada de la Casa Anáhuac. Reduce velocidad.",
  },
  {
    id: "antiluen",
    name: "Cruce Piscina Antilén",
    position: { lat: -33.409051, lon: -70.61374 },
    radiusM: 130,
    voice: "Proximidad a la piscina Antilén. Cruza con precaución, área peatonal.",
  },
  {
    id: "jardin-japones",
    name: "Jardín Japonés",
    position: { lat: -33.413345, lon: -70.614692 },
    radiusM: 120,
    voice: "Jardín Japonés a la vista. Peatones cruzando.",
  },
  {
    id: "salida-pv",
    name: "Salida Pedro de Valdivia",
    position: { lat: -33.411769, lon: -70.607988 },
    radiusM: 130,
    voice: "Tramo previo a la salida Pedro de Valdivia. Confluencia de ciclistas y vehículos.",
  },
  {
    id: "zoologico",
    name: "Zoológico Nacional",
    position: { lat: -33.429636, lon: -70.633963 },
    radiusM: 120,
    voice: "Zona de Zoológico. Niños y peatones en el camino.",
  },
];

// ============================================================
// Ruta de simulación: Pío Nono → Plaza México → bajada por
// Antilén → Jardín Japonés → salida Pedro de Valdivia Norte.
// La cima (Santuario de la Virgen) es solo peatonal: en bici la
// meta más alta de la ruta es Plaza México.
// kmh = velocidad objetivo en el tramo; alt = altitud (m s.n.m.)
// ============================================================

export type SimWaypoint = LatLng & { kmh: number; alt: number };

// Geografía real del parque: por el camino del lado del Funicular se
// sube hasta Plaza México (848 m), la meta en bici más alta del sector
// cumbre — el tramo final al Santuario de la Virgen (863 m) es solo
// peatonal. De Plaza México Av. Pedro Bannen continúa al sector Tupahue
// (Casa Anáhuac / Piscina Tupahue), Jardín Japonés y, por Av. Carlos
// Martner, sube a la Piscina Antilén (cumbre del cerro Chacarillas,
// 800 m). El retorno se baja por la cara oriente hacia Pedro de
// Valdivia Norte.
export const SIM_ROUTE: SimWaypoint[] = [
  { lat: -33.4343, lon: -70.636, kmh: 10, alt: 700 }, // Bellavista (fuera del parque)
  { lat: -33.43, lon: -70.635, kmh: 12, alt: 706 }, // ingreso por Pío Nono
  { lat: -33.4296, lon: -70.634, kmh: 11, alt: 722 }, // Zoológico Nacional
  { lat: -33.4277, lon: -70.6337, kmh: 12, alt: 758 }, // subida lado Funicular (camino a Plaza México)
  { lat: -33.4234, lon: -70.6327, kmh: 8, alt: 848 }, // Plaza México — meta más alta en bici (fuente, buses panorámicos)
  { lat: -33.4195, lon: -70.628, kmh: 16, alt: 822 }, // Av. Pedro Bannen hacia Tupahue
  { lat: -33.4171, lon: -70.6235, kmh: 12, alt: 785 }, // Casa de la Cultura Anáhuac (curva)
  { lat: -33.4148, lon: -70.619, kmh: 18, alt: 790 }, // tramo Tupahue → Jardín Japonés
  { lat: -33.4133, lon: -70.6147, kmh: 20, alt: 792 }, // Jardín Japonés
  { lat: -33.4112, lon: -70.6138, kmh: 18, alt: 798 }, // Av. Carlos Martner hacia Antilén
  { lat: -33.409051, lon: -70.61374, kmh: 16, alt: 802 }, // cruce Piscina Antilén (cumbre Chacarillas)
  { lat: -33.4112, lon: -70.6135, kmh: 24, alt: 794 }, // vuelta por Carlos Martner
  { lat: -33.4118, lon: -70.6105, kmh: 35, alt: 762 }, // bajada a PdV Norte — pico sobre el límite
  { lat: -33.411769, lon: -70.607988, kmh: 16, alt: 738 }, // salida Acceso Pedro de Valdivia Norte
  { lat: -33.4113, lon: -70.6068, kmh: 12, alt: 730 }, // Av. Pedro de Valdivia (fuera)
];

/** Destinos frecuentes para la navegación tipo Waze.
 *  La CUMBRE (Santuario de la Virgen, 863 m) NO es destino: el
 *  Parquemet la tiene reservada a peatones, no se puede subir en bici.
 *  PLAZA MÉXICO la reemplaza (misma ruta, meta más alta alcanzable). */
export const NAV_DESTINATIONS: { id: string; name: string; position: LatLng }[] = [
  // Plaza México: la plaza con la gran fuente del sector Cumbre (parada
  // final de los buses panorámicos), en Av. Pedro Bannen, ~210 m al
  // NORTE del Santuario de la Virgen (Mapcarta/OSM way 496989814), a
  // pasos de la estación Manuel Foster del Teleférico Pío Nono
  // (-33.42277, -70.63103, Wikipedia) y del Observatorio Manuel Foster
  // (-33.42206, -70.63237, Wikipedia). El grafo OSM propio tiene un
  // nodo de camino a 11 m de esta posición (2026-11-05). Es la meta
  // en bici más alta de la ruta de la cumbre.
  { id: "plaza-mexico", name: "⛲ Plaza México", position: { lat: -33.4234, lon: -70.6327 } },
  // Acceso La Pirámide (Vitacura): misma posición que GATES — ver
  // la nota con fuentes en GATES.
  { id: "la-piramide", name: "🚪 Acceso La Pirámide", position: { lat: -33.38642, lon: -70.60179 } },
  { id: "pio-nono", name: "🚪 Acceso Pío Nono", position: { lat: -33.430691, lon: -70.63592 } },
  { id: "pv-norte", name: "🚪 Acceso Pedro de Valdivia Norte", position: { lat: -33.411769, lon: -70.607988 } },
  { id: "antiluen", name: "🏊 Piscina Antilén", position: { lat: -33.409051, lon: -70.61374 } },
  { id: "jardin-japones", name: "🏯 Jardín Japonés", position: { lat: -33.413345, lon: -70.614692 } },
  { id: "zoologico", name: "🦁 Zoológico Nacional", position: { lat: -33.429636, lon: -70.633963 } },
  { id: "anahuac", name: "🎭 Casa de la Cultura Anáhuac", position: { lat: -33.417135, lon: -70.623511 } },
];
