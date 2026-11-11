// Detalle: metros por nombre de vía en la ruta Plaza México (y dónde cae cada tramo)
// Ejecutar: node_modules/.bin/tsx scripts/verif-detalle-ruta.ts
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, ...a: any[]) => realFetch(new URL(url, "http://localhost:3000"), ...a)) as typeof fetch;

import { computeRoute } from "../src/lib/routingService";
import { haversineM } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

async function main() {
  const plaza = NAV_DESTINATIONS.find((d) => d.id === "plaza-mexico")!;
  const casos: [string, { lat: number; lon: number }, { lat: number; lon: number }][] = [
    ["Pío Nono (ciudad) → Plaza México", { lat: -33.4355, lon: -70.6452 }, plaza.position],
    ["Antilén(exterior) → Plaza México", { lat: -33.4125, lon: -70.6105 }, plaza.position],
  ];
  for (const [nombre, from, to] of casos) {
    const res = await computeRoute(from, to);
    if (!res.route) { console.log(nombre, "SIN RUTA"); continue; }
    const r = res.route;
    console.log(`\n== ${nombre} ==  ${(r.distanceM / 1000).toFixed(2)} km`);
    // metros por nombre (conservando orden de primera aparición)
    const porNombre = new Map<string, number>();
    const orden: string[] = [];
    for (let i = 0; i < r.segNames.length; i++) {
      const nm = r.segNames[i] || "(sin nombre)";
      const m = haversineM(r.coords[i], r.coords[i + 1]);
      if (!porNombre.has(nm)) { porNombre.set(nm, 0); orden.push(nm); }
      porNombre.set(nm, (porNombre.get(nm) ?? 0) + m);
    }
    for (const nm of orden) {
      const m = porNombre.get(nm) ?? 0;
      const marca = /^(vereda|sendero|Sendero (?!Ciclista)|Ruta Nativa|path|footway|track)/i.test(nm) ? "  ⚠️" : "";
      console.log(`  ${m.toFixed(0).padStart(6)} m  ${nm}${marca}`);
    }
    // pasos con texto (hito de ingreso)
    const hito = r.steps.find((s) => s.text.startsWith("Ingresa por"));
    console.log("  hito:", hito?.text ?? "(ninguno)");
  }
  process.exit(0);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
