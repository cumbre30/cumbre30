// ============================================================
// Reglas de trazado según dentro/fuera del cerro (v1.12.11,
// definiciones del cliente 2026-11-15). Un solo evaluador para
// buscador y destinos libres — el motor (useNavEngine) lo
// consulta ANTES de llamar a computeRoute y, si la decisión le
// corresponde al usuario, muestra el popup en lugar de trazar.
//
// v1.12.12 (cliente 2026-11-15): el minimapa «Ir a» y los
// marcadores de acceso NO abren popup (destino = acceso → se
// cumple SOLO el criterio de llegar al acceso, F1/D1 directo),
// y el botón «Ruta» de las capas del mapa (rutas predefinidas)
// SIEMPRE abre su propio popup de decisión ¿ingresar al cerro o
// solo llegar al acceso? — ambos flujos viven en useNavEngine.
//
// FUERA DEL CERRO (origen fuera de las geocercas):
//  F1/F3 · destino = acceso ciclista (≤60 m de una portería con
//          ingreso en bici): el destino está a la vez «dentro» del
//          polígono (los accesos nacen sobre el borde), así que la
//          regla operativa es F3 → popup con dos opciones:
//          · «Solo hasta la portería» = comportamiento F1/v1.12.8:
//            ruta por la vía pública hasta la puerta, sin meterse
//            al cerro.
//          · «Ingresar al cerro» = misma ruta a la portería y al
//            llegar se extiende ~130 m hacia adentro por el camino
//            pavimentado del acceso (llegas ya dentro, listo para
//            arrancar el paseo).
//  F2    · destino dentro del cerro, NO es acceso → ingresa por el
//          ACCESO CICLISTA MÁS CERCANO AL ORIGEN (decisión del
//          cliente: mantener el criterio vigente, prioriza los km
//          dentro del cerro). computeRoute ya lo hace así: no
//          requiere cambio, solo la clasificación explícita.
// DENTRO DEL CERRO (origen dentro de las geocercas):
//  D1    · destino = acceso → ruta interior hasta la portería
//          (flujo normal del grafo local).
//  D2    · destino fuera de las geocercas → sale por el acceso
//          ciclista MÁS CERCANO AL DESTINO: tramo interior hasta
//          esa portería + tramo exterior por la vía pública.
//  D3    · estás a ≤300 m de un acceso y según el destino deberías
//          salir por OTRO → popup: «salir por el acceso del
//          destino» o «salir por el acceso más cercano a ti y
//          seguir por fuera».
// ============================================================

import { haversineM, type LatLng } from "@/lib/routing";
import { GATES, type Gate } from "@/lib/park";
import { parkInsideTest } from "@/lib/routingService";

/** Un destino cuenta como «acceso» si cae a ≤60 m de una portería con
 *  ingreso en bicicleta (los 4 oficiales de Parquemet). */
export const UMBRAL_ES_ACCESO_M = 60;

/** «Estás cerca de un acceso» (dispara el popup D3). */
export const UMBRAL_CERCA_ACCESO_M = 300;

/** Acceso ciclista más cercano a un punto (solo GATES con ingreso en bici). */
export function accesoCiclistaMasCercano(p: LatLng): { gate: Gate; distM: number } | null {
  let best: Gate | null = null;
  let bd = Infinity;
  for (const g of GATES) {
    if (!g.ciclistas) continue;
    const d = haversineM(p, g.position);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best ? { gate: best, distM: bd } : null;
}

/** Qué hacer al trazar de `from` a `to` (reglas F1-F3 / D1-D3). */
export type DecisionRuta =
  /** Trazar con el flujo normal de computeRoute (F2, D1, destino fuera sin acceso…). */
  | { tipo: "trazar" }
  /** Ruta solo hasta la portería, por la vía pública (accesoDirecto). */
  | { tipo: "sinIngresar" }
  /** Ruta a la portería + extensión interior por el camino del acceso. */
  | { tipo: "ingresarExtendido" }
  /** D2: salida en dos tramos por esta portería (interior → exterior). */
  | { tipo: "salidaPor"; gate: Gate }
  /** F3: el usuario decide ¿portería o ingresar? */
  | { tipo: "popupAcceso"; gate: Gate }
  /** D3: el usuario decide ¿salir por el acceso del destino o por el suyo? */
  | { tipo: "popupSalida"; gateMio: Gate; gateDest: Gate };

export function evaluarRuta(from: LatLng, to: LatLng): DecisionRuta {
  const dentro = parkInsideTest();
  const origenDentro = dentro(from.lat, from.lon);
  const accDest = accesoCiclistaMasCercano(to);
  const destEsAcceso = !!accDest && accDest.distM <= UMBRAL_ES_ACCESO_M;

  if (!origenDentro) {
    // F1/F3: destino acceso → decisión del usuario (portería / ingresar).
    // F2 (destino dentro sin acceso) y destino fuera → flujo normal.
    if (accDest && destEsAcceso) return { tipo: "popupAcceso", gate: accDest.gate };
    return { tipo: "trazar" };
  }
  // Origen dentro del cerro
  if (!dentro(to.lat, to.lon) && !destEsAcceso) {
    // D2/D3: destino fuera de las geocercas → salir por el acceso
    // ciclista más cercano AL DESTINO; si además estás cerca de otro
    // acceso, la elección te corresponde (D3).
    const accOrigen = accesoCiclistaMasCercano(from);
    if (accOrigen && accDest && accOrigen.gate.id !== accDest.gate.id && accOrigen.distM <= UMBRAL_CERCA_ACCESO_M) {
      return { tipo: "popupSalida", gateMio: accOrigen.gate, gateDest: accDest.gate };
    }
    if (accDest) return { tipo: "salidaPor", gate: accDest.gate };
    return { tipo: "trazar" };
  }
  // D1 y destinos interiores: el flujo normal traza por dentro.
  return { tipo: "trazar" };
}
