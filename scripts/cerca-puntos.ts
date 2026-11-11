// Qué vías existen alrededor de puntos clave (gates y sectores).
import { readFileSync } from "node:fs";
import { haversineM, type LatLng } from "../src/lib/routing";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[];
  names: string[];
  nodes: [number, number][];
  edges: [number, number, number, number, 0 | 1][];
};

const PUNTOS: Record<string, LatLng> = {
  gateZapadores: { lat: -33.399921, lon: -70.620406 },
  gatePioNono: { lat: -33.430691, lon: -70.63592 },
  gatePdVNorte: { lat: -33.411769, lon: -70.607988 },
  gateLaPiramide: { lat: -33.38642, lon: -70.60179 },
  circuitoMTB: { lat: -33.4033, lon: -70.6098 },
  nodoTupahue: { lat: -33.4215, lon: -70.6288 },
  plazaMexico: { lat: -33.4234, lon: -70.6327 },
  piscinaAntilen: { lat: -33.4086, lon: -70.6132 },
  laRotondaGPX: { lat: -33.409, lon: -70.6215 },
};

for (const [label, p] of Object.entries(PUNTOS)) {
  const cerca = new Map<string, { n: number; d: number; cls: Set<string> }>();
  for (const [a, b, ci, ni] of raw.edges) {
    const na = raw.nodes[a], nb = raw.nodes[b];
    const name = raw.names[ni] || "(sin nombre)";
    const cls = raw.classes[ci];
    const da = haversineM(p, { lat: na[0], lon: na[1] });
    const db = haversineM(p, { lat: nb[0], lon: nb[1] });
    const d = Math.min(da, db);
    if (d > 180) continue;
    const cur = cerca.get(name) ?? { n: 0, d: Infinity, cls: new Set<string>() };
    cur.n++;
    cur.d = Math.min(cur.d, d);
    cur.cls.add(cls);
    cerca.set(name, cur);
  }
  console.log(`\n== ${label} (${p.lat},${p.lon}) ==`);
  const rows = [...cerca.entries()].sort((x, y) => x[1].d - y[1].d).slice(0, 10);
  for (const [name, v] of rows) console.log(`  ${Math.round(v.d)}m ×${v.n} [${[...v.cls].join(",")}] ${name}`);
}
