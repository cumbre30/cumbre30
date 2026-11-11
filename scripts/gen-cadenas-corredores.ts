// Genera las cadenas de ascenso/descenso de los corredores direccionales
// y las escribe en src/lib/cadenasCorredores.ts (GENERADO).
//
//  · Corredor Pío Nono (regex NOMBRES_CORREDOR_PIO): una cadena por
//    componente conexa, cada una partiendo del nodo del componente más
//    cercano al ACCESO PÍO NONO y siguiendo el camino más largo simple.
//  · Corredor Bannen: cadena del componente desde el nodo más cercano a
//    PLAZA MÉXICO (la cadena arranca en la cara cumbre).
//
// La dirección prohibida es DIMINUIR la t de la cadena (hacia el arranque):
// abajo hacia el acceso Pío Nono, o arriba hacia Plaza México.
import { readFileSync, writeFileSync } from "node:fs";
import { haversineM, type Network, type NetNode, type NetEdge } from "../src/lib/routing";
import { GATE_PIO_NONO, PLAZA_MEXICO_POS } from "../src/lib/reglasParque";

const raw = JSON.parse(readFileSync("public/red-ciclista.json", "utf8")) as {
  classes: string[]; names: string[]; nodes: NetNode[]; edges: NetEdge[];
};

const NOMBRES_CORREDOR_PIO =
  /^(Pío Nono|Pio Nono|Avenida Alberto Mackenna|Camino Pío Nono - Plaza México|Terraza Bellavista|Explanada|Paseo Peatonal Cumbre|Camino Siete Palabras|Sendero El Excursionista|Camino El Excursionista)/;
const NOMBRES_BANNEN = /^Avenida Pedro Bannen/;

type Punto = [number, number]; // [lat, lon] redondeado a 6 decimales

function grafoCorredor(regex: RegExp): Map<number, Array<{ to: number; len: number }>> {
  const adj = new Map<number, Array<{ to: number; len: number }>>();
  for (const [a, b, , ni] of raw.edges) {
    const nm = raw.names[ni] ?? "";
    if (!regex.test(nm)) continue;
    const len = Math.max(0.1, haversineM({ lat: raw.nodes[a][0], lon: raw.nodes[a][1] }, { lat: raw.nodes[b][0], lon: raw.nodes[b][1] }));
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, len });
    adj.get(b)!.push({ to: a, len });
  }
  return adj;
}

/** Camino simple más largo desde `raiz` (DFS con tope de nodos). */
function caminoMasLargo(adj: Map<number, Array<{ to: number; len: number }>>, raiz: number): number[] {
  const visitados = new Set<number>([raiz]);
  let mejor: number[] = [raiz];
  const dfs = (n: number, path: number[]) => {
    if (path.length > mejor.length) mejor = path.slice();
    if (path.length > 420) return;
    for (const e of adj.get(n) ?? []) {
      if (visitados.has(e.to)) continue;
      visitados.add(e.to);
      path.push(e.to);
      dfs(e.to, path);
      path.pop();
      visitados.delete(e.to);
    }
  };
  dfs(raiz, [raiz]);
  return mejor;
}

function cadenaDeComponentes(regex: RegExp, ancla: { lat: number; lon: number }, etiqueta: string): Punto[][] {
  const adj = grafoCorredor(regex);
  const porVisitar = new Set([...adj.keys()]);
  const cadenas: Punto[][] = [];
  while (porVisitar.size > 0) {
    // componente: BFS desde un nodo pendiente
    const semilla = [...porVisitar][0];
    const comp: number[] = [];
    const vistos = new Set<number>([semilla]);
    const cola = [semilla];
    for (let i = 0; i < cola.length; i++) {
      const n = cola[i];
      comp.push(n);
      porVisitar.delete(n);
      for (const e of adj.get(n) ?? []) {
        if (!vistos.has(e.to)) {
          vistos.add(e.to);
          cola.push(e.to);
        }
      }
    }
    // raíz de la cadena: nodo del componente más cercano al ancla
    let raiz = comp[0];
    let bd = Infinity;
    for (const n of comp) {
      const d = haversineM(ancla, { lat: raw.nodes[n][0], lon: raw.nodes[n][1] });
      if (d < bd) {
        bd = d;
        raiz = n;
      }
    }
    const camino = caminoMasLargo(adj, raiz);
    const pts: Punto[] = camino.map((n) => [Number(raw.nodes[n][0].toFixed(6)), Number(raw.nodes[n][1].toFixed(6))]);
    const ini = pts[0], fin = pts[pts.length - 1];
    const km = pts.reduce((s, p, i) => (i ? s + haversineM({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: p[0], lon: p[1] }) : 0), 0) / 1000;
    console.log(`${etiqueta} componente ${cadenas.length}: ${camino.length} nodos · ${km.toFixed(2)} km · ini (${ini[0]},${ini[1]}) · fin (${fin[0]},${fin[1]})`);
    if (camino.length >= 6) cadenas.push(pts);
  }
  return cadenas;
}

const cadenasPio = cadenaDeComponentes(NOMBRES_CORREDOR_PIO, GATE_PIO_NONO, "PIO");
const cadenasBannen = cadenaDeComponentes(NOMBRES_BANNEN, PLAZA_MEXICO_POS, "BANNEN");

const ts = `// ============================================================
// GENERADO por scripts/gen-cadenas-corredores.ts - NO editar a mano.
// Cadenas ordenadas de los corredores direccionales (cliente,
// 2026-11-12): la dirección prohibida es DIMINUIR la t de la cadena.
//  · PIO: corredor de ascenso Pío Nono (acceso → puente de Tupahue y
//    cadena peatonal Terraza/Explanada/Siete Palabras → Plaza México).
//    Una cadena por componente conexa, arrancando en el extremo más
//    cercano al ACCESO PÍO NONO.
//  · BANNEN: Av. Pedro Bannen (Tupahue → Plaza México), arrancando en
//    el extremo más cercano a PLAZA MÉXICO (cara cumbre).
// coords = [lat, lon] a 6 decimales.
// ============================================================

export type CadenaCorredor = [number, number][];

export const CADENAS_PIO_NONO: CadenaCorredor[] = ${JSON.stringify(cadenasPio, null, 2)};

export const CADENAS_BANNEN: CadenaCorredor[] = ${JSON.stringify(cadenasBannen, null, 2)};
`;
writeFileSync("src/lib/cadenasCorredores.ts", ts);
console.log(`\n✎ src/lib/cadenasCorredores.ts escrito (${cadenasPio.length} cadenas PIO · ${cadenasBannen.length} BANNEN)`);
