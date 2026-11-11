// ============================================================
// Puentes del grafo: conexiones sintéticas donde el extracto OSM
// dejó islas separadas (p. ej. la explanada de un acceso del parque
// sin camino mapeado hasta el interior).
//
// Cada puente se define por COORDENADAS (no índices, que cambian si
// se regenera el JSON): se ancla al nodo más cercano de cada lado.
// Clase "service" (vía de acceso) para que las reglas de pavimento
// la admitan, y nombre explícito para el turn-by-turn.
//
// Autocontenido (sin imports de routing) para evitar la dependencia
// circular: routing.ts importa ESTE módulo al cargar la red.
// ============================================================

/** Estructura mínima que necesita aplicarPuentes (Network de routing la cumple). */
type Red = {
  nodes: [number, number][];
  adj: Array<Array<{ to: number; w: number; dist: number; cls: string; name: string; ciclovia: boolean; bearing: number }>>;
};

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type Puente = {
  /** nombre del enlace (para segNames / diagnóstico) */
  nombre: string;
  a: { lat: number; lon: number };
  b: { lat: number; lon: number };
};

/** Puentes verificados (nov 2026):
 *  · Acceso Pedro de Valdivia Norte: la explanada del acceso quedó como
 *    isla de 49 nodos en el extracto OSM; el camino real continúa hacia
 *    el Tramo Jardín Japonés / Pirámide a 59 m.
 *  · Acceso La Pirámide: la bocha/rotonda de ingreso no está unida al
 *    Tramo Jardín Japonés / Pirámide (387 m del sector de ingreso sin
 *    mapear); el camino real parte justo después de la portería.
 *  · Acceso sector Tupahue (poniente): el fin del camino Comodoro
 *    Merino Benítez no está unido al cruz de Casa Anáhuac (~300 m del
 *    sector de ingreso sin mapear en OSM). */
export const PUENTES: Puente[] = [
  {
    nombre: "Acceso Pedro de Valdivia Norte",
    a: { lat: -33.40964, lon: -70.60661 }, // Los Conquistadores (isla del acceso)
    b: { lat: -33.4092, lon: -70.60697 }, // Tramo Jardín Japonés / Pirámide (parque)
  },
  {
    nombre: "Acceso La Pirámide",
    a: { lat: -33.38642, lon: -70.60179 }, // Rotonda La Pirámide (portería)
    b: { lat: -33.3899, lon: -70.60162 }, // Tramo Jardín Japonés / Pirámide (parque)
  },
  {
    nombre: "Acceso sector Tupahue",
    a: { lat: -33.4195, lon: -70.6214 }, // Comodoro Arturo Merino Benítez (poniente)
    b: { lat: -33.4174, lon: -70.6237 }, // driveway Casa Anáhuac / cruz de Tupahue
  },
  {
    // Ascenso Pío Nono → Plaza México: Terraza Bellavista quedó como isla
    // en el extracto OSM (comp. propia) y no se une a la Explanada que
    // sigue hacia Camino Siete Palabras / Paseo Peatonal Cumbre (33 m).
    nombre: "Camino Pío Nono - Plaza México",
    a: { lat: -33.4261, lon: -70.63397 }, // Terraza Bellavista (norte)
    b: { lat: -33.42596, lon: -70.63365 }, // Explanada (sur)
  },
  {
    // Ascenso Pío Nono → Plaza México (tramo poniente): la cadena real del
    // camino (Sendero El Excursionista → Terraza Bellavista) está partida
    // por ~79 m de tramos etiquetados path sin conexión permitida; el
    // puente la cierra por el pavimento real del camino.
    nombre: "Camino Pío Nono - Plaza México",
    a: { lat: -33.42639, lon: -70.63273 }, // Sendero El Excursionista (extremo oriente)
    b: { lat: -33.42647, lon: -70.63358 }, // Terraza Bellavista (sur)
  },
];

/** Aplica los puentes sobre la red ya construida (muta adj). Idempotente:
 *  ancla cada extremo al nodo más cercano y añade la arista ida y vuelta. */
export function aplicarPuentes(net: Red): void {
  for (const p of PUENTES) {
    const ia = nearestNodeIdx(net, p.a);
    const ib = nearestNodeIdx(net, p.b);
    if (ia < 0 || ib < 0 || ia === ib) continue;
    const pa = { lat: net.nodes[ia][0], lon: net.nodes[ia][1] };
    const pb = { lat: net.nodes[ib][0], lon: net.nodes[ib][1] };
    const dist = Math.max(1, haversineM(pa, pb));
    const w = dist * 1.05; // penalty service
    const already = net.adj[ia].some((e) => e.to === ib);
    if (already) continue;
    net.adj[ia].push({ to: ib, w, dist, cls: "service", name: p.nombre, ciclovia: false, bearing: 0 });
    net.adj[ib].push({ to: ia, w, dist, cls: "service", name: p.nombre, ciclovia: false, bearing: 0 });
  }
}

function nearestNodeIdx(net: Red, p: { lat: number; lon: number }): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < net.nodes.length; i++) {
    const d = haversineM(p, { lat: net.nodes[i][0], lon: net.nodes[i][1] });
    if (d < bd) {
      bd = d;
      best = i;
      if (d < 5) break;
    }
  }
  return best;
}
