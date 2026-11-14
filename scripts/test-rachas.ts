// Prueba de lógica de rachas (corre con node --experimental-strip-types).
// Casos: hoy con ride, racha rota, semana pasada, historial vacío.
import { rachasDe, diaDeRide } from "./out/rachas_test.ts";

const hoy = new Date();
const d = (n: number) => new Date(hoy.getTime() - n * 86400000).toISOString();
const ok = (name: string, cond: boolean) => console.log(`${cond ? "PASS" : "FAIL"} · ${name}`);

// 1) Historial vacío
const r0 = rachasDe([]);
ok("vacío: todo 0", r0.diasActual === 0 && r0.diasMaxima === 0 && r0.semanasActual === 0 && r0.diasTotales === 0);

// 2) Hoy + ayer + anteayer (racha de 3), y hace 10 días (racha vieja de 2)
const rides2 = [
  { dateISO: d(0) }, { dateISO: d(1) }, { dateISO: d(2) },
  { dateISO: d(10) }, { dateISO: d(11) },
];
const r2 = rachasDe(rides2);
ok("actual: 3 días", r2.diasActual === 3);
ok("máxima: 3 días", r2.diasMaxima === 3);
ok("totales: 5 días", r2.diasTotales === 5);
ok("semanas actual: 2 (semana actual + anterior)", r2.semanasActual === 2);

// 3) Sin ride hoy pero sí ayer: la racha sobrevive (perdón de 1 día)
const r3 = rachasDe([{ dateISO: d(1) }, { dateISO: d(2) }]);
ok("sin ride hoy: actual 2", r3.diasActual === 2);

// 4) Último ride hace 5 días: racha actual 0, máxima 2
const r4 = rachasDe([{ dateISO: d(5) }, { dateISO: d(6) }]);
ok("rota: actual 0", r4.diasActual === 0);
ok("rota: máxima 2", r4.diasMaxima === 2);

// 5) DiaDeRide resuelve en Santiago (ISO con UTC → misma fecha si es horario de día)
const iso = new Date("2026-11-14T18:00:00.000Z").toISOString();
ok("diaDeRide formato", /^\d{4}-\d{2}-\d{2}$/.test(diaDeRide(iso)));

// 6) Semanas: rides en 3 semanas consecutivas
const sem = [];
for (let w = 0; w < 3; w++) sem.push({ dateISO: d(7 * w + 1) });
const r6 = rachasDe(sem);
ok("semanas actual: 3", r6.semanasActual === 3);
