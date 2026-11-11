// Verificación de la actualización normativa Parquemet:
//   - horario 06:00-20:30 todos los días
//   - restricción cumbre-Tupahue SOLO fines de semana y festivos
//   - festivos de Chile offline (fijos + Semana Santa + 1er lunes nov)
// Todas las fechas se construyen como instante UTC y se validan
// contra lo que se ve en America/Santiago (UTC-3 en noviembre).
import { estadoParque, esFinDeSemanaOFestivo, horaSantiago } from "../src/lib/horario";

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean, extra = "") {
  if (cond) {
    ok++;
    console.log(`  OK   ${nombre} ${extra}`);
  } else {
    fail++;
    console.log(`  FAIL ${nombre} ${extra}`);
  }
}

console.log("--- esFinDeSemanaOFestivo ---");
check("mié 11 nov 2026", esFinDeSemanaOFestivo(new Date("2026-11-11T17:00:00Z")) === false);
check("sáb 14 nov 2026", esFinDeSemanaOFestivo(new Date("2026-11-14T17:00:00Z")) === true);
check("dom 15 nov 2026", esFinDeSemanaOFestivo(new Date("2026-11-15T17:00:00Z")) === true);
check("sáb noche (sat 22:30 Santiago)", esFinDeSemanaOFestivo(new Date("2026-11-15T01:30:00Z")) === true);
check("dom noche 23:59 Santiago", esFinDeSemanaOFestivo(new Date("2026-11-16T02:59:00Z")) === true);
check("lun 00:00 Santiago", esFinDeSemanaOFestivo(new Date("2026-11-16T03:00:00Z")) === false);
check("mar 8 dic (Inmaculada)", esFinDeSemanaOFestivo(new Date("2026-12-08T17:00:00Z")) === true);
check("vie 18 sep", esFinDeSemanaOFestivo(new Date("2026-09-18T17:00:00Z")) === true);
check("lun 2 nov (1er lunes nov)", esFinDeSemanaOFestivo(new Date("2026-11-02T17:00:00Z")) === true);
check("lun 9 nov (2do lunes nov)", esFinDeSemanaOFestivo(new Date("2026-11-09T17:00:00Z")) === false);
check("vie santo 3 abr 2026", esFinDeSemanaOFestivo(new Date("2026-04-03T17:00:00Z")) === true);
check("mié 1 abr 2026 (no)", esFinDeSemanaOFestivo(new Date("2026-04-01T17:00:00Z")) === false);
check("sáb santo 27 mar 2027", esFinDeSemanaOFestivo(new Date("2027-03-27T12:00:00Z")) === true);
check("mar 1 dic 2026 (marcha blanca, no festivo)", esFinDeSemanaOFestivo(new Date("2026-12-01T17:00:00Z")) === false);
check("vie 25 dic", esFinDeSemanaOFestivo(new Date("2026-12-25T17:00:00Z")) === true);

console.log("--- estadoParque (restricción Tupahue y horario) ---");
// Miércoles 14:00 Santiago (17:00Z): abierto, sin aviso (entre semana NO hay Tupahue)
let e = estadoParque(new Date("2026-11-11T17:00:00Z"));
check("mié 14:00 abierto", e.abierto === true);
check("mié 14:00 sin aviso Tupahue (entre semana)", e.nivel === "info" && e.aviso === null, `nivel=${e.nivel}`);
// Sábado 13:29 Santiago: aún no rige la restricción
e = estadoParque(new Date("2026-11-14T16:29:00Z"));
check("sáb 13:29 sin aviso aún", e.nivel === "info" && e.aviso === null, `nivel=${e.nivel}`);
// Sábado 13:30 Santiago: rige la restricción
e = estadoParque(new Date("2026-11-14T16:30:00Z"));
check("sáb 13:30 aviso Tupahue (warn)", e.nivel === "tupa" && e.aviso?.includes("Fines de semana y festivos") === true, `nivel=${e.nivel}`);
// Domingo 14:00: aviso Tupahue
e = estadoParque(new Date("2026-11-15T17:00:00Z"));
check("dom 14:00 aviso Tupahue", e.nivel === "tupa");
// Festivo martes 8 dic 14:00: aviso Tupahue
e = estadoParque(new Date("2026-12-08T17:00:00Z"));
check("festivo 8 dic 14:00 aviso Tupahue", e.nivel === "tupa");
// Miércoles 19:30 Santiago: ABIERTO con el nuevo horario (antes cerraba 19:00)
e = estadoParque(new Date("2026-11-11T22:30:00Z"));
check("mié 19:30 abierto (nuevo horario 20:30)", e.abierto === true, `nivel=${e.nivel}`);
// Miércoles 20:29 abierto / 20:30 cerrado
e = estadoParque(new Date("2026-11-11T23:29:00Z"));
check("mié 20:29 abierto", e.abierto === true);
e = estadoParque(new Date("2026-11-11T23:30:00Z"));
check("mié 20:30 cerrado (danger)", e.abierto === false && e.nivel === "cierre", `nivel=${e.nivel}`);
check("msg cierre menciona 20:30", e.aviso?.includes("06:00 a 20:30") === true);
// Madrugada: antes de las 06:00
e = estadoParque(new Date("2026-11-12T08:59:00Z")); // 05:59 Santiago
check("mié 05:59 cerrado", e.abierto === false && e.nivel === "cierre");

console.log("--- horaSantiago ---");
check("17:00Z -> 14:00 (UTC-3)", horaSantiago(new Date("2026-11-11T17:00:00Z")) === "14:00", horaSantiago(new Date("2026-11-11T17:00:00Z")));

console.log(`\nResultado: ${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
