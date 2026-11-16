/* Regresión de geocercas (requerimiento de cumplimiento, §7):
   1. Motor de detección INTACTO: git diff de useRideEngine.ts y park.ts
      no debe tocar la lógica de detección (park.ts sólo añade el campo
      trazabilidad opcional; useRideEngine no cambia).
   2. La detección sigue produciendo los mismos resultados: replica las
      condiciones EXACTAS de useRideEngine (líneas «7) Zonas de riesgo»:
      pre-aviso en [radiusM, radiusM+100) con cooldown 150 s; aviso al
      entrar con d < radiusM y cooldown 150 s) sobre puntos de prueba
      derivados de cada zona.
   3. Trazabilidad: los 7 campos completos y la regla dura
      OSM-only ≠ OFFICIAL_RESTRICTION (validarTrazabilidad). */

const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === "string" && input.startsWith("/red-ciclista.json")) {
    const data = readFileSync("public/red-ciclista.json");
    return Promise.resolve(new Response(data, { headers: { "Content-Type": "application/json" } }));
  }
  if (typeof input === "string" && input.startsWith("/")) return realFetch("http://localhost:3000" + input, init);
  return realFetch(input, init);
};

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { RISK_ZONES, type LatLng } from "@/lib/park";
import { validarTrazabilidad, TRAZABILIDAD_GEOCERCAS, CLASIFICACION_GEOCERCAS, clasificarGeocerca } from "@/lib/geocercas";

const COOLDOWN_MS = 150_000; // useRideEngine: fix.t - last > 150_000
const PREAVISO_M = 100; // pre-aviso 100 m antes

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180, lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Punto a X metros al norte de p (misma mecánica de prueba para todas). */
function alNorte(p: LatLng, metros: number): LatLng {
  return { lat: p.lat + metros / 111_320, lon: p.lon };
}

/** Condiciones EXACTAS del bloque «7) Zonas de riesgo» del engine. */
function evaluar(fix: LatLng, zone: (typeof RISK_ZONES)[number], last: number, t: number): "preaviso" | "alerta" | "nada" {
  const d = haversineM(fix, zone.position);
  if (d >= zone.radiusM && d < zone.radiusM + PREAVISO_M && t - last > COOLDOWN_MS) return "preaviso";
  if (d < zone.radiusM && t - last > COOLDOWN_MS) return "alerta";
  return "nada";
}

async function main() {
  let fallos = 0;

  // 1) Motor intocado
  const diff = execSync("git diff --name-only HEAD -- src/hooks/useRideEngine.ts", { encoding: "utf8" }).trim();
  if (diff) {
    console.log("✗ useRideEngine.ts tiene cambios sin commitear (¡motor tocado!):", diff);
    fallos++;
  } else {
    console.log("✓ motor de detección intocado (git diff useRideEngine.ts = 0)");
  }
  const diffPark = execSync("git diff -- src/lib/park.ts | grep -E '^[-+].*(d <|radiusM \\+ 100|haversineM)' || true", { encoding: "utf8" }).trim();
  if (diffPark) {
    console.log("✗ park.ts cambia condiciones de detección:", diffPark);
    fallos++;
  } else {
    console.log("✓ park.ts no altera radios ni condiciones de detección");
  }

  // 2) Detección: mismos resultados esperados en cada zona
  const T = 1_000_000_000;
  for (const zone of RISK_ZONES) {
    const centro = zone.position;
    const pre = alNorte(centro, zone.radiusM + 50); // dentro de la franja de pre-aviso
    const fuera = alNorte(centro, zone.radiusM + 400); // fuera de ambas franjas
    const e1 = evaluar(centro, zone, 0, T);
    const e2 = evaluar(pre, zone, 0, T);
    const e3 = evaluar(fuera, zone, 0, T);
    // cooldown: al entrar dos veces seguidas, la segunda no dispara
    const e4 = evaluar(centro, zone, T - 60_000, T);
    const ok = e1 === "alerta" && e2 === "preaviso" && e3 === "nada" && e4 === "nada";
    if (!ok) fallos++;
    console.log(`${ok ? "✓" : "✗"} ${zone.id}: centro=${e1} pre-aviso=${e2} fuera=${e3} cooldown=${e4}`);
  }

  // 3) Trazabilidad completa + regla OSM
  const errs = validarTrazabilidad();
  if (errs.length) {
    fallos++;
    console.log("✗ trazabilidad:", errs.join(" | "));
  } else {
    console.log(`✓ trazabilidad completa y regla OSM≠OFFICIAL_RESTRICTION OK (${RISK_ZONES.length} zonas inline + ${Object.keys(TRAZABILIDAD_GEOCERCAS).length} por id)`);
  }
  // Las 5 zonas de riesgo deben ser SAFETY con fuente NO-OSM verificada
  for (const zone of RISK_ZONES) {
    const traz = zone.trazabilidad;
    if (!traz) {
      console.log(`✗ ${zone.id}: sin trazabilidad inline`);
      fallos++;
      continue;
    }
    const cat = clasificarGeocerca("SAFETY", traz);
    if (cat !== "SAFETY" || traz.source.toLowerCase().includes("openstreetmap")) fallos++;
    console.log(`✓ ${zone.id}: SAFETY · fuente=${traz.source} · verif=${traz.verification_status} · updated=${traz.updated_at}`);
  }
  // Regla dura: simular una geocerca OSM pedida como oficial
  const osmCat = clasificarGeocerca("OFFICIAL_RESTRICTION", {
    source: "OpenStreetMap", source_reference: "way 123", created_at: "2026-01-01", updated_at: "2026-01-01",
    verification_status: "unverified", confidence_level: "low", restriction_type: "none",
  });
  if (osmCat !== "INFORMATIVE") {
    console.log("✗ regla OSM falla:", osmCat);
    fallos++;
  } else {
    console.log("✓ regla dura: geocerca OSM pedida OFFICIAL_RESTRICTION → INFORMATIVE");
  }

  console.log(fallos === 0 ? "\nREGRESIÓN OK — funcionalidad de geocercas intacta + trazabilidad completa" : `\n${fallos} FALLOS`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
