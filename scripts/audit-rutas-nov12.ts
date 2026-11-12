// Audita los trazados regenerados contra los criterios del cliente (2026-11-12):
//  · r1: nace/termina en el ACCESO PDV (cruce Av. El Cerro × PdV Norte) y llega a Plaza México, sin Carlos Reed
//  · r2: el mismo trazado que la navegación a Plaza México del minimapa (Pío Nono → Mackenna → puente → Bannen)
//  · r3: Zapadores → La Montaña → SIEMPRE Av. Abate Molina a PDV (sin Martner,
//        sin puente, sin Gabriela Mistral), pasando Jardín Japonés y Salida PDV;
//        SIN Plaza México ni Carlos Reed
//  · r4: intacto (OK para el cliente)
//  · r5: Pío Nono sólo subida, sin bajada Pío Nono, sin Carlos Reed, cierre en PDV
//  · círculos amarillos (RISK_ZONES) en la capa Normativa y Seguridad
import { readFileSync } from "node:fs";
import { haversineM, type Network, type NetNode, type NetEdge, type LatLng, type FindRouteOpts } from "../src/lib/routing";
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { CAPA_NORMATIVA, CAPA_RUTAS } from "../src/lib/mapLayers";
import { RISK_ZONES, GATES } from "../src/lib/park";
import { PUENTE_TUPAHUE_CUMBRE, PLAZA_MEXICO_POS, GATE_PIO_NONO, crearDirOk } from "../src/lib/reglasParque";
import { PAV_DEST_OPTS, corredorPav } from "../src/lib/routingService";
import { aplicarPuentes } from "../src/lib/puentesGrafo";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

// red desde el archivo local (mismo montaje que scripts/build-rutas.ts)
const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};
const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as { classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[]; cicloviaPolylines: number[][] };
const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const w = dist * p;
  const bearingDeg = ((Math.atan2(((pb.lon - pa.lon) * Math.PI) / 180 * Math.cos((pb.lat * Math.PI) / 180), (pb.lat - pa.lat) * (Math.PI / 180)) * 180) / Math.PI + 360) % 360;
  adj[a].push({ to: b, w, dist, cls, name, ciclovia: ciclo === 1, bearing: bearingDeg });
  adj[b].push({ to: a, w, dist, cls, name, ciclovia: ciclo === 1, bearing: (bearingDeg + 180) % 360 });
}
const net: Network = { ...raw, adj };
aplicarPuentes(net);
const findRoute = (from: LatLng, to: LatLng, opts?: FindRouteOpts) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require("../src/lib/routing") as typeof import("../src/lib/routing")).findRoute(net, from, to, opts);
void findRoute;

const PDV = GATES.find((g) => g.id === "pv-norte")!.position;
const ZAPADORES = GATES.find((g) => g.id === "zapadores")!.position;
const PIO = GATES.find((g) => g.id === "pio-nono")!.position;
const LA_PIRAMIDE = GATES.find((g) => g.id === "la-piramide")!.position;

const toLL = (t: string): LatLng[] => RUTAS_TRAZADOS[t].coords.map(([lat, lon]) => ({ lat, lon }));

const minDist = (c: LatLng[], p: LatLng) => Math.min(...c.map((x) => haversineM(x, p)));

async function main() {

  // --- presencia de los 9 trazados y distancias plausibles ---
  for (const r of CAPA_RUTAS) {
    const t = RUTAS_TRAZADOS[r.trz];
    ok(!!t && t.coords.length > 20 && t.distKm > 0.5, `${r.id} (${r.nombre}) trazado ${t?.coords.length ?? 0} pts · ${t?.distKm ?? 0} km`);
  }

  const r1 = toLL("r1");
  const r2 = toLL("r2");
  const r3 = toLL("r3");
  const r4 = toLL("r4");
  const r5 = toLL("r5");

  // --- r1: acceso PDV corregido ---
  ok(haversineM(r1[0], PDV) <= 30, `r1 nace en el acceso PdV Norte (${haversineM(r1[0], PDV).toFixed(0)} m)`);
  ok(haversineM(r1[r1.length - 1], PLAZA_MEXICO_POS) <= 60, `r1 termina en Plaza México (${haversineM(r1[r1.length - 1], PLAZA_MEXICO_POS).toFixed(0)} m)`);
  ok(haversineM(r1[r1.length - 1], PDV) > 800, "r1 NO termina en el acceso (no es un loop)");

  // --- r2: mismo trazado que la navegación del minimapa a Plaza México ---
  ok(haversineM(r2[0], PIO) <= 40, `r2 nace en el acceso Pío Nono (${haversineM(r2[0], PIO).toFixed(0)} m)`);
  ok(haversineM(r2[r2.length - 1], PLAZA_MEXICO_POS) <= 60, "r2 termina en Plaza México");
  const dPuente2 = minDist(r2, PUENTE_TUPAHUE_CUMBRE);
  ok(dPuente2 <= 25, `r2 pasa por el puente Mackenna-Bannen (${dPuente2.toFixed(0)} m)`);
  // comparación con la navegación real del minimapa (mismo motor/filtros de PAV_DEST)
  corredorPav(net); // calienta el corredor con la red real (igual que computeRoute)
  const nav = findRoute(PIO, PLAZA_MEXICO_POS, {
    ...PAV_DEST_OPTS,
    edgeDirOk: crearDirOk(net, { pioNonoSoloSubida: true, corteCumbre: false }),
  });
  if (nav) {
    const navKm = nav.distanceM / 1000;
    const trzKm = RUTAS_TRAZADOS.r2.distKm;
    ok(Math.abs(navKm - trzKm) / Math.max(navKm, trzKm) < 0.06, `r2 ≈ navegación minimapa a Plaza México (${trzKm.toFixed(2)} km vs ${navKm.toFixed(2)} km)`);
    // mismo corredor: máx distancia entre muestras de ambos trazados sobre el puente
    ok(minDist(nav.coords, PUENTE_TUPAHUE_CUMBRE) <= 25, "navegación minimapa también cruza el puente");
  } else {
    ok(false, "no se pudo reproducir la navegación del minimapa");
  }

  // --- r3: Zapadores → La Montaña → Abate Molina SIEMPRE → PDV ---
  // Cliente 2026-11-12: «no debe desviarse a Carlos Martner debe seguir por
  // abate Molina siempre. Está ruta pasa por 2 zonas de riesgo (jardín
  // japonés y salida PDV)».
  ok(haversineM(r3[0], ZAPADORES) <= 30, `r3 nace en Zapadores (${haversineM(r3[0], ZAPADORES).toFixed(0)} m)`);
  ok(haversineM(r3[r3.length - 1], PDV) <= 40, `r3 termina en el acceso PdV Norte (${haversineM(r3[r3.length - 1], PDV).toFixed(0)} m)`);
  ok(minDist(r3, PUENTE_TUPAHUE_CUMBRE) > 200, `r3 NO se desvía al puente Mackenna-Bannen (${minDist(r3, PUENTE_TUPAHUE_CUMBRE).toFixed(0)} m)`);
  const JJ_ZONE = { lat: -33.413345, lon: -70.614692 }; // zona de riesgo Jardín Japonés (radio 120 m)
  const SP_ZONE = { lat: -33.416209, lon: -70.619256 }; // zona de riesgo Salida Pedro de Valdivia (radio 130 m)
  ok(minDist(r3, JJ_ZONE) <= 120, `r3 pasa por Jardín Japonés (${minDist(r3, JJ_ZONE).toFixed(0)} m, zona 120 m)`);
  ok(minDist(r3, SP_ZONE) <= 130, `r3 pasa por Salida Pedro de Valdivia (${minDist(r3, SP_ZONE).toFixed(0)} m, zona 130 m)`);
  // punto medio del antiguo tramo Martner (junction → puente) y de Av. Gabriela
  // Mistral: el nuevo trazado no debe pasar por ahí
  const MARTNER_MEDIO = { lat: -33.415426, lon: -70.621316 };
  ok(minDist(r3, MARTNER_MEDIO) > 100, `r3 sin el tramo Carlos Martner al puente (${minDist(r3, MARTNER_MEDIO).toFixed(0)} m)`);
  ok(minDist(r3, PLAZA_MEXICO_POS) > 400, `r3 NO llega a Plaza México (${minDist(r3, PLAZA_MEXICO_POS).toFixed(0)} m)`);

  // --- r4 intacto (referencia git HEAD del trazado) ---
  const { execFileSync } = await import("node:child_process");
  const head = execFileSync("git", ["show", "HEAD:src/lib/rutasTrazados.ts"], { encoding: "utf8" });
  const mR4 = head.match(/"r4": \{\s*"coords": (\[[\s\S]*?\]),\s*"distKm"/);
  const r4head = JSON.parse((mR4?.[1] ?? "null").replace(/,\s*([\]\}])/g, "$1")) as [number, number][];
  let maxDelta = 0;
  for (let i = 0; i < Math.min(r4head.length, r4.length); i++)
    maxDelta = Math.max(maxDelta, haversineM({ lat: r4head[i][0], lon: r4head[i][1] }, r4[i]));
  ok(r4head.length === r4.length && maxDelta < 2, `r4 intacto (${r4.length} pts, Δmáx ${maxDelta.toFixed(1)} m)`);

  // --- r5: vuelta completa, sin bajada Pío Nono ni Carlos Reed ---
  ok(haversineM(r5[0], PIO) <= 40, "r5 nace en Pío Nono");
  ok(haversineM(r5[r5.length - 1], PDV) <= 40, `r5 cierra en el acceso PdV Norte (${haversineM(r5[r5.length - 1], PDV).toFixed(0)} m)`);
  for (const g of [ZAPADORES, LA_PIRAMIDE]) ok(minDist(r5, g) <= 60, `r5 pasa por acceso ${g === ZAPADORES ? "Zapadores" : "La Pirámide"}`);
  ok(minDist(r5, PLAZA_MEXICO_POS) > 400 || haversineM(r5[r5.length - 1], PLAZA_MEXICO_POS) > 400, "r5 no es una ruta a Plaza México");

  // --- Carlos Reed / bajada Pío Nono en TODOS los pavimento ---
  // arista más cercana a cada punto del trazado; flag si cae sobre vía Carlos Reed
  const nodes = net.nodes;
  const edges = net.edges;
  const cell = 0.0005;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const k = `${Math.round(nodes[i][0] / cell)}:${Math.round(nodes[i][1] / cell)}`;
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(i);
  }
  const nearestName = (p: LatLng): { name: string; cls: string; d: number } => {
    const ci = Math.round(p.lat / cell);
    const cj = Math.round(p.lon / cell);
    let bn = "", bc = "", bd = Infinity;
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const arr = grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const i of arr) {
          const d = haversineM(p, { lat: nodes[i][0], lon: nodes[i][1] });
          if (d < bd) {
            bd = d;
            bn = net.names[edges.find((e) => e[0] === i)?.[3] ?? 0] ?? "";
            bc = net.classes[edges.find((e) => e[0] === i)?.[2] ?? 0];
          }
        }
      }
    return { name: bn, cls: bc, d: bd };
  };
  const ReedM = (c: LatLng[]) => {
    let m = 0;
    for (let i = 1; i < c.length; i++) {
      const mid = { lat: (c[i - 1].lat + c[i].lat) / 2, lon: (c[i - 1].lon + c[i].lon) / 2 };
      const ne = nearestName(mid);
      if (/Carlos Reed/.test(ne.name) && ne.d < 30) m += haversineM(c[i - 1], c[i]);
    }
    return m;
  };
  for (const [id, c] of Object.entries({ r1, r2, r3, r5 })) {
    ok(ReedM(c) < 40, `${id}: sin tramos por Carlos Reed (${ReedM(c).toFixed(0)} m)`);
  }
  // bajada por el corredor Pío Nono: en r5/r1/r3 ningún tramo DEBE acercarse al acceso
  // Pío Nono DESPUÉS del arranque (r5 sale legítimamente de ahí: sólo subida).
  for (const [id, c] of Object.entries({ r1, r3, r5 })) {
    let m = 0;
    let acum = 0;
    for (let i = 1; i < c.length; i++) {
      const seg = haversineM(c[i - 1], c[i]);
      acum += seg;
      const mid = { lat: (c[i - 1].lat + c[i].lat) / 2, lon: (c[i - 1].lon + c[i].lon) / 2 };
      // ignora los primeros 700 m (arranque legítimo en el acceso Pío Nono)
      if (haversineM(mid, GATE_PIO_NONO) < 120 && acum > 700) m += seg;
    }
    ok(m < 30, `${id}: sin bajada junto al acceso Pío Nono (${m.toFixed(0)} m tras el arranque)`);
  }

  // --- r1: ubicar el tramo path (sin nombre) de 318 m ---
  const tramos = new Map<string, number>();
  for (let i = 1; i < r1.length; i++) {
    const mid = { lat: (r1[i - 1].lat + r1[i].lat) / 2, lon: (r1[i - 1].lon + r1[i].lon) / 2 };
    const ne = nearestName(mid);
    if (ne.cls === "path" && ne.d < 30) {
      const key = `${ne.name} @ (${mid.lat.toFixed(4)},${mid.lon.toFixed(4)})`;
      tramos.set(key, (tramos.get(key) ?? 0) + haversineM(r1[i - 1], r1[i]));
    }
  }
  for (const [k, m] of tramos) console.log(`   i r1 tramo path: ${m.toFixed(0)} m ← ${k}`);

  // --- círculos amarillos en Normativa y Seguridad ---
  for (const z of RISK_ZONES) {
    const p = CAPA_NORMATIVA.find((x) => x.id === `riesgo-${z.id}`);
    ok(!!p && haversineM(p.position, z.position) < 1, `capa Normativa: círculo amarillo «${z.name}» (${p ? p.position.lat + "," + p.position.lon : "falta"})`);
  }
  const salidaPv = RISK_ZONES.find((z) => z.id === "salida-pv")!;
  ok(salidaPv.position.lat === -33.416209 && salidaPv.position.lon === -70.619256, "Salida Pedro de Valdivia en -33.416209, -70.619256");
  const corte = CAPA_NORMATIVA.find((x) => x.id === "corte-tupahue")!;
  ok(haversineM(corte.position, PUENTE_TUPAHUE_CUMBRE) < 1, "Corte horario (Tupahue → Cumbre) EN el puente de Pedro Bannen");

  console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
