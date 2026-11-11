// Forma del track r2: punto cada ~250 m con rumbo a la puerta/plaza
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";
import { haversineM } from "../src/lib/routing";
import { NAV_DESTINATIONS } from "../src/lib/park";

const gate = { lat: -33.430691, lon: -70.63592 };
const plaza = NAV_DESTINATIONS.find((x) => x.id === "plaza-mexico")!.position;
const track = RUTAS_TRAZADOS["r2"].coords.map(([lat, lon]) => ({ lat, lon }));

let acum = 0;
console.log("km acum | lat,lon | dist a puerta | dist a plaza");
console.log(`0.000   | ${track[0].lat.toFixed(5)},${track[0].lon.toFixed(5)} | ${haversineM(track[0], gate).toFixed(0)} m | ${haversineM(track[0], plaza).toFixed(0)} m`);
for (let i = 1; i < track.length; i++) {
  acum += haversineM(track[i - 1], track[i]);
  if (acum % 250 < haversineM(track[i - 1], track[i])) {
    console.log(`${(acum / 1000).toFixed(3)}   | ${track[i].lat.toFixed(5)},${track[i].lon.toFixed(5)} | ${haversineM(track[i], gate).toFixed(0)} m | ${haversineM(track[i], plaza).toFixed(0)} m`);
  }
}
console.log(`fin: ${(acum / 1000).toFixed(3)} km en ${track[track.length - 1].lat.toFixed(5)},${track[track.length - 1].lon.toFixed(5)} (dist plaza: ${haversineM(track[track.length - 1], plaza).toFixed(0)} m)`);
