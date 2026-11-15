// Prueba de lógica del evaluador de reglas de accesos (v1.12.11).
// Ejecutar con: bun scripts/test-reglas-acceso.ts
// Usa coordenadas reales: accesos de GATES y puntos de referencia del
// sector. Verifica primero que cada punto de referencia caiga en la
// zona declarada (dentro/fuera del polígono del parque).
import { evaluarRuta, UMBRAL_ES_ACCESO_M, UMBRAL_CERCA_ACCESO_M, accesoCiclistaMasCercano, type DecisionRuta } from "../src/lib/reglasAcceso";
import { GATES } from "../src/lib/park";
import { parkInsideTest } from "../src/lib/routingService";

const dentroTest = parkInsideTest();
const ciclistas = GATES.filter((g) => g.ciclistas);
console.log("Accesos ciclistas:", ciclistas.map((g) => `${g.id} (${g.position.lat},${g.position.lon})`).join(" · "));

// Puntos de referencia (aprox; se auto-verifican contra el polígono)
const fuera: Record<string, { lat: number; lon: number }> = {
  plazaArmas: { lat: -33.4372, lon: -70.6506 },        // Santiago centro
  baquedano: { lat: -33.4424, lon: -70.6520 },         // plaza Baquedano
  providencia: { lat: -33.4340, lon: -70.6250 },       // Av. Providencia (oriente)
  vitacuraPiramide: { lat: -33.3845, lon: -70.5975 },  // ~350 m más allá del Acceso La Pirámide, por fuera
};
const dentro: Record<string, { lat: number; lon: number }> = {
  plazaMexico: { lat: -33.4210, lon: -70.6310 },  // tras el acceso Pío Nono
  tupahue: { lat: -33.4161, lon: -70.6317 },      // cumbre del cerro (interior)
  cercaPioNono: { lat: -33.4300, lon: -70.6362 }, // ~77 m del acceso Pío Nono, lado interior
};

console.log("\nAuto-verificación de puntos de referencia:");
for (const [n, p] of Object.entries(fuera)) console.log(`  fuera.${n} inside=${dentroTest(p.lat, p.lon)} (debe ser false)`);
for (const [n, p] of Object.entries(dentro)) console.log(`  dentro.${n} inside=${dentroTest(p.lat, p.lon)} (debe ser true)`);

const pioNono = GATES.find((g) => g.id === "pio-nono")!;
const laPiramide = GATES.find((g) => g.id === "la-piramide")!;

function describir(d: DecisionRuta): string {
  switch (d.tipo) {
    case "trazar": return "trazar (flujo normal)";
    case "sinIngresar": return "sinIngresar";
    case "ingresarExtendido": return "ingresarExtendido";
    case "salidaPor": return `salidaPor (${d.gate.id})`;
    case "popupAcceso": return `popupAcceso (${d.gate.id})`;
    case "popupSalida": return `popupSalida (mío=${d.gateMio.id}, destino=${d.gateDest.id})`;
  }
}

const casos: Array<[string, { lat: number; lon: number }, { lat: number; lon: number }, string]> = [
  // FUERA DEL CERRO
  ["F3 fuera→acceso (Plaza Armas → La Pirámide)", fuera.plazaArmas, laPiramide.position, "popupAcceso"],
  ["F2 fuera→dentro no acceso (Baquedano → Tupahue)", fuera.baquedano, dentro.tupahue, "trazar"],
  ["fuera→fuera (Plaza Armas → Providencia)", fuera.plazaArmas, fuera.providencia, "trazar"],
  // DENTRO DEL CERRO
  ["D1 dentro→acceso (Plaza México → Pío Nono)", dentro.plazaMexico, pioNono.position, "trazar"],
  ["D1 dentro→dentro (Plaza México → Tupahue)", dentro.plazaMexico, dentro.tupahue, "trazar"],
  ["D2 dentro→fuera (Plaza México → Providencia)", dentro.plazaMexico, fuera.providencia, "salidaPor"],
  ["D3 cerca de acceso→fuera al otro lado (cerca Pío Nono → Vitacura)", dentro.cercaPioNono, fuera.vitacuraPiramide, "popupSalida"],
];

let ok = 0;
for (const [nombre, from, to, esperado] of casos) {
  const d = evaluarRuta(from, to);
  const got = describir(d);
  const bien = got.startsWith(esperado);
  if (bien) ok++;
  console.log(`${bien ? "✓" : "✗"} ${nombre}\n    esperado=${esperado} → obtenido=${got}`);
}
console.log(`\n${ok}/${casos.length} casos OK · umbrales: acceso=${UMBRAL_ES_ACCESO_M} m, cerca=${UMBRAL_CERCA_ACCESO_M} m`);
const cerca = accesoCiclistaMasCercano(dentro.cercaPioNono);
console.log(`Distancia «cerca Pío Nono»→gate Pío Nono: ${Math.round(cerca?.distM ?? -1)} m (debe ser ≤300 para que D3 dispare)`);
