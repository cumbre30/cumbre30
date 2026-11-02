// Prueba offline del anclaje del INICIO de ruta al pin GPS del ciclista.
// Regla de negocio: coords[0] SIEMPRE es la ubicación del usuario; la
// preferencia por ciclovías se aplica DESPUÉS del arranque, nunca moviendo
// el inicio. Cubre:
//  1. Bug histórico: proyección >40 m sobre un tramo posterior (la ciclovía
//     que la ruta tomaba metros más adelante) borraba el arranque y el mapa
//     mostraba la ruta iniciando en la ciclovía, sin el pin.
//  2. Recorte cercano (<150 m): se recorta el arranque, pin primero.
//  3. Casos reales del grafo local (Pío Nono, Bellavista, Antilén…).
import * as fs from "fs";
import {
  attachOrigin,
  findRoute,
  haversineM,
  type Network,
  type NavRoute,
  type NetEdge,
  type LatLng,
} from "../src/lib/routing";

// ---------------------------------------------------------------
// Red real (grafo local del cerro + Bellavista)
// ---------------------------------------------------------------
const raw = JSON.parse(fs.readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: NetEdge[];
  cicloviaPolylines: number[][];
};

const PENALTY: Record<string, number> = {
  cycleway: 0.65, path: 0.9, footway: 1.35, pedestrian: 1.1, track: 1.0,
  living_street: 0.95, residential: 0.95, service: 1.05, unclassified: 1.0,
  tertiary: 1.15, tertiary_link: 1.2, secondary: 1.5, secondary_link: 1.5,
  primary: 2.4, primary_link: 2.4,
};

const adj: Network["adj"] = raw.nodes.map(() => []);
for (const [a, b, clsIdx, nameIdx, ciclo] of raw.edges) {
  const cls = raw.classes[clsIdx] ?? "residential";
  const name = raw.names[nameIdx] ?? "";
  const p = PENALTY[cls] ?? 1;
  const pa = { lat: raw.nodes[a][0], lon: raw.nodes[a][1] };
  const pb = { lat: raw.nodes[b][0], lon: raw.nodes[b][1] };
  const dist = haversineM(pa, pb);
  const br = Math.atan2(
    Math.sin((pb.lon - pa.lon) * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180),
    Math.cos(pa.lat * Math.PI / 180) * Math.sin(pb.lat * Math.PI / 180) -
      Math.sin(pa.lat * Math.PI / 180) * Math.cos(pb.lat * Math.PI / 180) * Math.cos((pb.lon - pa.lon) * Math.PI / 180)
  ) / Math.PI * 180;
  const brr = (br + 360) % 360;
  adj[a].push({ to: b, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: brr });
  adj[b].push({ to: a, w: dist * p, dist, cls, name, ciclovia: ciclo === 1, bearing: (brr + 180) % 360 });
}
const net: Network = { ...raw, adj };

let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
  } else {
    failures++;
    console.log(`  ❌ ${msg}`);
  }
}

function routeSanity(route: NavRoute, from: LatLng, label: string) {
  check(haversineM(from, route.coords[0]) < 1, `${label}: coords[0] ES el pin GPS (Δ ${haversineM(from, route.coords[0]).toFixed(2)} m)`);
  check(route.flags[0] === false, `${label}: el tramo inicial (conector/chaflán) no se marca como ciclovía`);
  check(route.steps.length >= 2 && route.steps[0].icon === "start", `${label}: primer paso es "start"`);
  const last = route.coords.length - 1;
  let monotone = true;
  for (let k = 1; k < route.steps.length; k++) if (route.steps[k].idx <= route.steps[k - 1].idx) monotone = false;
  let inBounds = true;
  for (const st of route.steps) if (st.idx < 0 || st.idx > last) inBounds = false;
  check(monotone, `${label}: índices de pasos estrictamente crecientes`);
  check(inBounds, `${label}: índices de pasos dentro de [0, ${last}]`);
  check(route.distanceM > 0, `${label}: distancia > 0 (${route.distanceM} m)`);
}

// ---------------------------------------------------------------
// 1) BUG histórico: proyección lejana (>40 m) sobre tramo posterior.
//    Ruta: A (≈118 m del pin) → B → C (la "ciclovía" pasa a ≈60 m del
//    pin, 166 m más adelante en la ruta) → destino. El recorte viejo
//    saltaba al tramo B→C y arrancaba SIN pin sobre esa vía.
// ---------------------------------------------------------------
console.log("\n1) Proyección lejana sobre tramo posterior (bug 'inicio en ciclovía'):");
{
  const from: LatLng = { lat: -33.43, lon: -70.63 };
  const coords: LatLng[] = [
    { lat: -33.4290, lon: -70.6295 }, // A: ≈118 m del pin
    { lat: -33.4290, lon: -70.6275 }, // B: ruta avanza al oriente
    { lat: -33.42946, lon: -70.63 },  // C: pasa a ≈60 m del pin (sin pin viejo, >40 m)
    { lat: -33.4299, lon: -70.629 },  // D
    { lat: -33.4305, lon: -70.627 },  // destino
  ];
  const segLen = (a: LatLng, b: LatLng) => haversineM(a, b);
  const route: NavRoute = {
    coords,
    distanceM: Math.round(coords.slice(1).reduce((s, c, i) => s + segLen(coords[i], c), 0)),
    steps: [
      { icon: "start", text: "Parte por Av Momolandia", distM: 118, point: coords[0], idx: 0 },
      { icon: "right", text: "Gira a la derecha hacia Ciclovía Test", distM: 166, point: coords[2], idx: 2 },
      { icon: "end", text: "Has llegado a tu destino", distM: 0, point: coords[4], idx: 4 },
    ],
    cicloviaPct: 40,
    etaMin: 3,
    flags: [false, true, true, true],
    segNames: ["Av Momolandia", "Ciclovía Test", "Ciclovía Test", "Ciclovía Test"],
  };
  const out = attachOrigin(route, from);
  const prOldSeg = 1; // proyección caía en el tramo B→C
  console.log(`  (proyección vieja caía en tramo ${prOldSeg}, a ${haversineM(from, coords[2]).toFixed(0)} m del pin; A está a ${haversineM(from, coords[0]).toFixed(0)} m)`);
  routeSanity(out, from, "deep-trim");
  check(out.coords.length === route.coords.length + 1, "deep-trim: se conserva la ruta ÍNTEGRA + pin antepuesto");
  check(out.coords[1] === route.coords[0], "deep-trim: el segundo vértice es el arranque original A");
  const firstStepText = out.steps[0].text;
  check(firstStepText.includes("tu ubicación"), `deep-trim: el paso inicial anuncia "Parte desde tu ubicación…" ("${firstStepText}")`);
}

// ---------------------------------------------------------------
// 2) Recorte cercano permitido (<150 m a lo largo de la ruta):
//    se recorta el arranque hasta la calle que pasa cerca del pin,
//    PERO el pin sigue encabezando la ruta (antes: sin pin si >40 m).
// ---------------------------------------------------------------
console.log("\n2) Recorte cercano (<150 m) mantiene el pin como inicio:");
{
  const from: LatLng = { lat: -33.43, lon: -70.63 };
  const coords: LatLng[] = [
    { lat: -33.42964, lon: -70.63 },  // A: ≈40 m del pin
    { lat: -33.42964, lon: -70.628 }, // B: ≈185 m al oriente (185 m a lo largo → tramo 1 dentro? prefixM(1)=185)
    { lat: -33.42964, lon: -70.626 }, // destino
  ];
  const route: NavRoute = {
    coords,
    distanceM: 370,
    steps: [
      { icon: "start", text: "Parte por Calle Norte", distM: 185, point: coords[0], idx: 0 },
      { icon: "end", text: "Has llegado a tu destino", distM: 0, point: coords[2], idx: 2 },
    ],
    cicloviaPct: 0,
    etaMin: 2,
    flags: [false, false],
    segNames: ["Calle Norte", "Calle Norte"],
  };
  const out = attachOrigin(route, from);
  routeSanity(out, from, "near-trim");
  // proyección del pin cae sobre el tramo 0 (A→B) pues F está al sur de A
  // con proyección ≤40 m: pin + chaflán al punto proyectado
  check(out.coords.length === 4, "near-trim: pin + punto proyectado + resto (recorte aplicado)");
  console.log(`  inicio: ${out.steps[0].text} · Δ pin→ruta ${haversineM(from, route.coords[0]).toFixed(0)} m`);
}

// ---------------------------------------------------------------
// 3) Casos reales del grafo local: pin SIEMPRE es coords[0].
// ---------------------------------------------------------------
console.log("\n3) Casos reales (grafo local):");
const cases: { label: string; from: LatLng; to: LatLng }[] = [
  { label: "Pío Nono → Cumbre", from: { lat: -33.430691, lon: -70.63592 }, to: { lat: -33.404, lon: -70.617 } },
  { label: "Bellavista (Dardignac) → Zoológico", from: { lat: -33.4292, lon: -70.6385 }, to: { lat: -33.429636, lon: -70.633963 } },
  { label: "Pedro de Valdivia Norte → Piscina Antilén", from: { lat: -33.411769, lon: -70.607988 }, to: { lat: -33.409051, lon: -70.61374 } },
  { label: "Mitad de cuadra Bellavista → Cumbre", from: { lat: -33.4315, lon: -70.6375 }, to: { lat: -33.404, lon: -70.617 } },
];
for (const c of cases) {
  const r0 = findRoute(net, c.from, c.to);
  if (!r0) {
    failures++;
    console.log(`  ❌ ${c.label}: SIN RUTA`);
    continue;
  }
  const route = attachOrigin(r0, c.from);
  console.log(`  ${c.label} · ${(route.distanceM / 1000).toFixed(2)} km · ${route.cicloviaPct}% ciclovía`);
  routeSanity(route, c.from, c.label);
  const firstStreet = route.segNames.find((n) => n.trim()) ?? "(sin nombre)";
  console.log(`    primera vía real tras el pin: "${firstStreet}" · inicio: "${route.steps[0].text}"`);
}

console.log("\n" + (failures === 0 ? "✅ TODO OK" : `❌ ${failures} fallos`));
process.exit(failures === 0 ? 0 : 1);
