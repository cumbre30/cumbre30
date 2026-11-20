// Extrae el array MODULOS del mockup aprobado y genera src/lib/educacionData.ts
// con el mismo contenido literal (fidelidad a lo revisado por el cliente).

import fs from "node:fs";

const MOCKUP = "/home/z/my-project/download/mockup-centro-educacion-ciclista.html";
const SALIDA = "/home/z/my-project/src/lib/educacionData.ts";

const html = fs.readFileSync(MOCKUP, "utf8");
const ini = html.indexOf("const MODULOS = [");
const fin = html.indexOf("\n];", ini);
if (ini < 0 || fin < 0) {
  console.error("No se encontró el array MODULOS en el mockup");
  process.exit(1);
}
const codigo = html.slice(ini + "const MODULOS = ".length, fin + 3);
const MODULOS = new Function(`"use strict"; return ${codigo};`)();

// Categorías del mockup (CATS)
const iniCat = html.indexOf("const CATS = {");
const finCat = html.indexOf("};", iniCat);
const CATS = new Function(`"use strict"; return ${html.slice(iniCat + "const CATS = ".length, finCat + 2)};`)();

console.log("Módulos:", MODULOS.length, "| categorías:", Object.keys(CATS).length);
console.log("Con quiz:", MODULOS.filter((m) => m.quiz).map((m) => m.id).join(", "));

// Cabecera del archivo generado
const cabecera = `"use client";

// ============================================================
// Centro de Educación Ciclista (CEC) - datos de los módulos.
// Generado desde el mockup aprobado (download/mockup-centro-
// educacion-ciclista.html, v.2026-11-20) por scripts/gen-educacion-data.mjs
// para garantizar fidelidad al contenido revisado por el cliente.
// El contenido de los módulos (reglas, citas legales, fuentes)
// permanece en español: la normativa citada (Ley 18.290, CONASET,
// UTM/SII) es chilena y su texto oficial es en español; traducir
// citas legales implicaría parafrasearlas. Los textos de interfaz
// (chips, búsqueda, quiz, insignias) sí están en i18n (i18n.ts).
// ------------------------------------------------------------
// Tipos: ModuloCEC = ficha completa; quiz en CEC-012/013/014.
// ============================================================

export type QuizCEC = { q: string; alt: string[]; ok: number; exp: string };
export type RefCEC = { t: string; f: string; r: string; v: string };
export type ModuloCEC = {
  id: string;
  cat: string;
  nivel: string;
  modo: string[];
  icono: string;
  titulo: string;
  desc: string;
  cuerpo: string[];
  recos: string[];
  refs: RefCEC[];
  act: string;
  quiz?: QuizCEC;
};

/** Categorías (clave = cat del módulo; etiquetas vía i18n cat.*). */
export const CEC_CATS: string[] = ${JSON.stringify(Object.keys(CATS))};

export const CEC_MODULOS: ModuloCEC[] = ${JSON.stringify(MODULOS, null, 2).replace(/"([^"]+)":/g, "$1:")};
`;

fs.writeFileSync(SALIDA, cabecera, "utf8");
console.log("Escrito:", SALIDA, fs.statSync(SALIDA).size, "bytes");
