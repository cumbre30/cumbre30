// ============================================================
// Datos del Parque Metropolitano de Santiago (Cerro San Cristóbal)
// NOTA: Coordenadas aproximadas con fines de prototipo.
// El límite vigente al interior del parque es 30 km/h (Parquemet).
// ============================================================

export const LIMIT_KMH = 30;
export const CAUTION_KMH = LIMIT_KMH - 3; // aviso previo a los 27 km/h

export type LatLng = { lat: number; lon: number };

/** Polígono aproximado del Parque Metropolitano (sentido horario). */
export const PARK_POLYGON: LatLng[] = [
  { lat: -33.4360, lon: -70.6430 }, // sur: Acceso Pío Nono (Bellavista)
  { lat: -33.4330, lon: -70.6455 },
  { lat: -33.4255, lon: -70.6480 },
  { lat: -33.4180, lon: -70.6480 },
  { lat: -33.4105, lon: -70.6460 },
  { lat: -33.4030, lon: -70.6445 },
  { lat: -33.3965, lon: -70.6425 }, // punta norte
  { lat: -33.3950, lon: -70.6355 },
  { lat: -33.4010, lon: -70.6300 },
  { lat: -33.4090, lon: -70.6262 }, // Acceso Pedro de Valdivia Norte
  { lat: -33.4170, lon: -70.6285 },
  { lat: -33.4250, lon: -70.6320 },
  { lat: -33.4305, lon: -70.6365 },
];

export type Gate = {
  id: string;
  name: string;
  position: LatLng;
};

/** Accesos principales donde Parquemet fiscaliza / pide enrolamiento. */
export const GATES: Gate[] = [
  { id: "pio-nono", name: "Acceso Pío Nono", position: { lat: -33.4338, lon: -70.6420 } },
  { id: "pv-norte", name: "Acceso Pedro de Valdivia Norte", position: { lat: -33.4106, lon: -70.6272 } },
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
    position: { lat: -33.4166, lon: -70.6377 },
    radiusM: 140,
    voice: "Atención, curva cerrada de la Casa Anáhuac. Reduce velocidad.",
  },
  {
    id: "antiluen",
    name: "Cruce Piscina Antilén",
    position: { lat: -33.4096, lon: -70.6348 },
    radiusM: 130,
    voice: "Proximidad a la piscina Antilén. Cruza con precaución, área peatonal.",
  },
  {
    id: "jardin-japones",
    name: "Jardín Japonés",
    position: { lat: -33.4085, lon: -70.6326 },
    radiusM: 120,
    voice: "Jardín Japonés a la vista. Peatones cruzando.",
  },
  {
    id: "salida-pv",
    name: "Salida Pedro de Valdivia",
    position: { lat: -33.4100, lon: -70.6276 },
    radiusM: 130,
    voice: "Tramo previo a la salida Pedro de Valdivia. Confluencia de ciclistas y vehículos.",
  },
  {
    id: "zoologico",
    name: "Zoológico Nacional",
    position: { lat: -33.4245, lon: -70.6390 },
    radiusM: 120,
    voice: "Zona de Zoológico. Niños y peatones en el camino.",
  },
];

// ============================================================
// Ruta de simulación: Pío Nono → Cumbre → bajada por Antilén
// → salida Pedro de Valdivia Norte.
// kmh = velocidad objetivo en el tramo; alt = altitud (m s.n.m.)
// ============================================================

export type SimWaypoint = LatLng & { kmh: number; alt: number };

export const SIM_ROUTE: SimWaypoint[] = [
  { lat: -33.4372, lon: -70.6422, kmh: 10, alt: 700 }, // Bellavista, fuera del parque
  { lat: -33.4340, lon: -70.6415, kmh: 12, alt: 705 }, // ingreso por Pío Nono
  { lat: -33.4305, lon: -70.6408, kmh: 13, alt: 715 },
  { lat: -33.4260, lon: -70.6398, kmh: 14, alt: 725 }, // camino interior
  { lat: -33.4245, lon: -70.6390, kmh: 11, alt: 732 }, // Zoológico
  { lat: -33.4200, lon: -70.6385, kmh: 15, alt: 745 },
  { lat: -33.4166, lon: -70.6377, kmh: 12, alt: 760 }, // Casa Anáhuac (curva)
  { lat: -33.4125, lon: -70.6368, kmh: 16, alt: 782 },
  { lat: -33.4090, lon: -70.6360, kmh: 14, alt: 800 }, // bifurcación
  { lat: -33.4050, lon: -70.6390, kmh: 12, alt: 840 }, // camino a la cumbre
  { lat: -33.4015, lon: -70.6418, kmh: 8, alt: 875 }, // Cumbre (Virgen)
  { lat: -33.4038, lon: -70.6398, kmh: 24, alt: 852 }, // inicio bajada
  { lat: -33.4068, lon: -70.6368, kmh: 28, alt: 815 },
  { lat: -33.4092, lon: -70.6350, kmh: 35, alt: 788 }, // cruce Antilén — pico sobre el límite
  { lat: -33.4087, lon: -70.6328, kmh: 32, alt: 780 }, // Jardín Japonés
  { lat: -33.4058, lon: -70.6308, kmh: 27, alt: 768 },
  { lat: -33.4088, lon: -70.6288, kmh: 24, alt: 752 },
  { lat: -33.4102, lon: -70.6276, kmh: 18, alt: 740 }, // tramo salida PV Norte
  { lat: -33.4112, lon: -70.6270, kmh: 14, alt: 736 }, // salida del parque
  { lat: -33.4128, lon: -70.6262, kmh: 12, alt: 730 }, // Av. Providencia, libre
];
