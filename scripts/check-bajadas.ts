import { BAJADAS_30 } from "../src/lib/mapLayers";
import { haversineM } from "../src/lib/geo";
const antilen = { lat: -33.409051, lon: -70.61374 };
const plazaAntilen = { lat: -33.40758, lon: -70.61121 };
const pm = { lat: -33.4234, lon: -70.6327 };
const pio = { lat: -33.430462, lon: -70.636212 };
for (const b of BAJADAS_30) {
  const ini = b.coords[0];
  const fin = b.coords[b.coords.length - 1];
  console.log(`${b.id}: ini (${ini.lat},${ini.lon}) fin (${fin.lat},${fin.lon})`);
  if (b.id === "b30-piramide") console.log(`  dCima=${haversineM(ini, antilen).toFixed(0)}m`);
  if (b.id === "b30-pdv") console.log(`  dPlaza=${haversineM(ini, plazaAntilen).toFixed(0)}m`);
  if (b.id === "b30-pionono") { console.log(`  dPlazaMex=${haversineM(ini, pm).toFixed(0)}m dPio=${haversineM(fin, pio).toFixed(0)}m`); }
}
