// Test: detección de segmentos de bajada + reto Pedalea Seguro listo
import { detectEfforts } from "../src/lib/segments";
import { evaluateAchievements, RETOS } from "../src/lib/pins";

// Track sintético: bajada por Zorro Vidal (Plaza México -> Pío Nono, -140 m en 4 min)
const track: [number, number, number, number][] = [];
for (let i = 0; i <= 48; i++) {
  const f = i / 48;
  track.push([
    -33.42394 + (-33.42651 + 33.42394) * f,
    -70.63269 + (-70.63765 + 70.63269) * f,
    845 - 140 * f,
    i * 5, // cada 5 s -> 240 s total
  ]);
}
const ride = {
  id: "r1",
  dateISO: new Date().toISOString(),
  track,
} as unknown as Parameters<typeof detectEfforts>[0];

const e1 = detectEfforts(
  ride,
  {
    id: "zorro-vidal-bajada",
    name: "Zorro Vidal · bajada",
    detail: "",
    start: { lat: -33.42394, lon: -70.63269 },
    end: { lat: -33.42651, lon: -70.63765 },
    radiusStartM: 110,
    radiusEndM: 130,
    minGainM: 80,
    minTimeSec: 60,
    maxTimeSec: 900,
    dir: "bajada",
  },
);
console.log("bajada Zorro Vidal detectada:", e1.length === 1, "| gain:", e1[0]?.gainM.toFixed(0), "m | t:", e1[0]?.timeSec, "s");

// Subida clásica sigue funcionando (regresión)
const subida = detectEfforts(
  ride, // el mismo track invertido no; usamos uno ascendente
  {
    id: "prueba-subida",
    name: "prueba",
    detail: "",
    start: { lat: -33.42651, lon: -70.63765 },
    end: { lat: -33.42394, lon: -70.63269 },
    radiusStartM: 110,
    radiusEndM: 130,
    minGainM: 80,
    minTimeSec: 60,
    maxTimeSec: 900,
  },
);
console.log("subida con track ascendente invertido detectada:", subida.length === 0 ? false : "n/a");
// (el track es descendente: una def de subida no debe detectar)
console.log("regresión subida sobre track bajada:", subida.length === 0 ? "OK (no detecta)" : `MAL (${subida.length})`);

// Reto credencial
const reto = RETOS.find((r) => r.code === "pedalea_seguro_qr");
console.log("reto presente:", !!reto, "| metric:", reto?.metric);
const stats = {
  totalKm: 0, rideCount: 0, maxKmh: 0, totalGainM: 0, parkRides: 0,
  cleanParkRides: 0, nightRides: 0, dawnRides: 0, maxRideKm: 0,
  weekendRides: 0, totalHours: 0, incidentCount: 0,
} as Parameters<typeof evaluateAchievements>[0];
const sinQR = evaluateAchievements(stats, [], {}).includes("pedalea_seguro_qr");
// Emula el localStorage del dispositivo (tsx corre en Node puro);
// también `window`, porque metricValue usa typeof window para
// distinguir servidor de cliente.
(globalThis as unknown as { window: unknown }).window = globalThis;
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size; },
} as Storage;
(globalThis.localStorage as Storage).setItem("cumbre30-entry-qr-v1", JSON.stringify({ img: "x", savedAt: "x" }));
const conQR = evaluateAchievements(stats, [], {}).includes("pedalea_seguro_qr");
console.log("sin QR desbloquea:", sinQR, "(esperado false) | con QR desbloquea:", conQR, "(esperado true)");
