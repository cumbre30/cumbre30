// ¿Dónde se separan mtb1 y mtb2? Tramos únicos de cada trazado en metros,
// con posición geográfica de cada divergencia (km del loop).
import { RUTAS_TRAZADOS } from "../src/lib/rutasTrazados";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const hav = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const a = RUTAS_TRAZADOS["mtb1"].coords;
const b = RUTAS_TRAZADOS["mtb2"].coords;
const key = (p: [number, number]) => `${p[0]},${p[1]}`;
const setB = new Set(b.map(key));
const setA = new Set(a.map(key));

function tramosUnicos(t: [number, number][], otro: Set<string>, etiqueta: string, id: string) {
  const tramos: { desde: number; hasta: number; metros: number; kmDesde: number }[] = [];
  let abierto = false;
  let km = 0;
  for (let i = 0; i < t.length; i++) {
    if (i > 0) km += hav(t[i - 1], t[i]) / 1000;
    const unico = !otro.has(key(t[i]));
    if (unico && !abierto) { tramos.push({ desde: i, hasta: i, metros: 0, kmDesde: km }); abierto = true; }
    else if (unico && abierto) tramos[tramos.length - 1].hasta = i;
    else if (!unico && abierto) abierto = false;
  }
  // cierra el loop: si quedó abierto al final, une con el inicio
  for (const tr of tramos) {
    for (let i = tr.desde + 1; i <= tr.hasta; i++) tr.metros += hav(t[i - 1], t[i]);
  }
  console.log(`\n${etiqueta}: ${tramos.length} tramos únicos`);
  for (const tr of tramos) {
    const p0 = t[tr.desde], p1 = t[tr.hasta];
    console.log(
      `  idx ${tr.desde}..${tr.hasta} · ${tr.metros.toFixed(0)} m · km ${tr.kmDesde.toFixed(2)}-${(tr.kmDesde + tr.metros / 1000).toFixed(2)} · inicio ${p0[0].toFixed(5)},${p0[1].toFixed(5)} → fin ${p1[0].toFixed(5)},${p1[1].toFixed(5)}`
    );
  }
  const total = tramos.reduce((s, t2) => s + t2.metros, 0);
  console.log(`  total único: ${total.toFixed(0)} m de ${(RUTAS_TRAZADOS[id].distKm * 1000).toFixed(0)} m`);
}

tramosUnicos(a, setB, "mtb1 (únicos vs mtb2)", "mtb1");
tramosUnicos(b, setA, "mtb2 (únicos vs mtb1)", "mtb2");
