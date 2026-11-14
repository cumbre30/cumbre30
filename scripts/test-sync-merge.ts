// Test unitario de mergeServerRides — fusión del pull de rides del
// servidor en el historial local. Función PURA: sin DOM ni red.
// Correr: bun scripts/test-sync-merge.ts
import { mergeServerRides, type ServerRide } from "@/lib/cloudSync";
import type { RideSummary } from "@/lib/history";

let fails = 0;
function chk(label: string, ok: boolean, extra = ""): void {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const EMAIL = "qa@test.cl";
const now = new Date("2026-11-14T10:00:00Z").toISOString();
const earlier = new Date("2026-11-13T10:00:00Z").toISOString();

const srv = (over: Partial<ServerRide> & { id: string }): ServerRide => ({
  dateISO: now,
  source: "gps",
  distanceKm: 10,
  maxKmh: 30,
  avgKmh: 18,
  elapsedSec: 2000,
  gainM: 100,
  overLimitSec: 0,
  ...over,
});

const local = (over: Partial<RideSummary> & { id: string }): RideSummary => ({
  dateISO: now,
  source: "gps",
  distanceKm: 10,
  maxKmh: 30,
  avgKmh: 18,
  elapsedSec: 2000,
  gainM: 100,
  overLimitSec: 0,
  ...over,
});

// 1. Historial vacío: agrega todos, con cuenta enlazada e ids correctos.
{
  const r = mergeServerRides([], [srv({ id: "s1", clientId: "dev-1" }), srv({ id: "s2" })], EMAIL);
  chk("1. agrega 2 rides", r.added === 2, `→ ${r.added}`);
  chk("1. id por clientId", r.list.some((x) => x.id === "dev-1"));
  chk("1. id srv- para rides sin clientId", r.list.some((x) => x.id === "srv-s2"));
  chk("1. cuenta enlazada", r.list.every((x) => x.account === EMAIL));
  chk("1. orden desc por fecha", r.list[0].dateISO >= r.list[r.list.length - 1].dateISO);
}

// 2. Idempotente: los mismos rides no se duplican.
{
  const base = [local({ id: "dev-1" }), local({ id: "srv-s2" })];
  const r = mergeServerRides(base, [srv({ id: "s1", clientId: "dev-1" }), srv({ id: "s2" })], EMAIL);
  chk("2. dedupe por id: added 0", r.added === 0, `→ ${r.added}`);
  chk("2. lista intacta", r.list.length === 2);
}

// 3. Merge parcial: solo agrega los que faltan.
{
  const base = [local({ id: "dev-1" })];
  const r = mergeServerRides(base, [srv({ id: "s1", clientId: "dev-1" }), srv({ id: "s2" })], EMAIL);
  chk("3. solo agrega el faltante", r.added === 1 && r.list.length === 2, `→ added ${r.added}`);
}

// 4. Flags y campos se conservan (motorized, inParkKm, fuente sim).
{
  const r = mergeServerRides([], [srv({ id: "s3", motorized: true, inParkKm: 7.5, source: "sim" })], EMAIL);
  const m = r.list[0];
  chk("4. motorized preservado", m.motorized === true);
  chk("4. inParkKm preservado", m.inParkKm === 7.5);
  chk("4. source sim preservado", m.source === "sim");
}

// 5. Un ride local de OTRA cuenta no se toca; el nuevo queda enlazado al email dado.
{
  const base = [local({ id: "otro", account: "otra@x.cl" })];
  const r = mergeServerRides(base, [srv({ id: "s4", clientId: "dev-2" })], EMAIL);
  chk("5. ride de otra cuenta intacto", r.list.find((x) => x.id === "otro")?.account === "otra@x.cl");
  chk("5. nuevo enlazado a la cuenta", r.list.find((x) => x.id === "dev-2")?.account === EMAIL);
}

console.log(fails ? `\n${fails} FALLOS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
