#!/usr/bin/env python3
"""Extrae articulos seleccionados de los XML de LeyChile (BCN) en /tmp/leyes.
Los articulos son EstructuraFuncional tipoParte='Articulo'; el numero va al inicio de su <Texto>."""
import re
import xml.etree.ElementTree as ET

DIR = "/tmp/leyes"


NS = "{http://www.leychile.cl/esquemas}"


def lista_articulos(path):
    tree = ET.parse(path)
    out = []
    for ef in tree.iter(f"{NS}EstructuraFuncional"):
        te = ef.find(f"{NS}Texto")
        if te is None or not te.text:
            continue
        cuerpo = te.text.strip()
        m = re.match(r"^Art[íi]culo\s+([0-9°ºª]+)\s*(bis|ter|A|B)?\b", cuerpo, re.IGNORECASE)
        if m:
            nombre = f"Artículo {m.group(1)}{m.group(2) or ''}"
            out.append((nombre, cuerpo))
    return out


def mostrar(path, patrones, titulo):
    arts = lista_articulos(path)
    print(f"\n{'='*70}\n{titulo}  ({len(arts)} articulos)\n{'='*70}")
    for pat in patrones:
        rx = re.compile(pat, re.IGNORECASE)
        hallados = [(n, c) for (n, c) in arts if rx.fullmatch(n) or rx.search(n)]
        if not hallados:
            print(f"\n--- [{pat}] NO ENCONTRADO")
        for n, c in hallados:
            print(f"\n--- {n} ---\n{c}\n")


if __name__ == "__main__":
    mostrar(f"{DIR}/ley18290.xml",
            [r"^Artículo 2$", r"^Artículo 5$", r"^Artículo 5bis$", r"^Artículo 131$",
             r"^Artículo 169$", r"^Artículo 190$", r"^Artículo 196$"],
            "LEY 18.290 - Ley de Trafico (consolidada)")
    mostrar(f"{DIR}/ley21088.xml", [r".*"], "LEY 21.088 - Convivencia Vial")
