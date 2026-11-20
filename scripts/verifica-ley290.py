#!/usr/bin/env python3
"""Verifica los artículos citados en el CEC contra el XML oficial de LeyChile
(texto refundido Ley de Tránsito, idNorma 1007469, versión vigente 22-10-2026).
Descarga el XML, separa por artículo y muestra el extracto de cada artículo clave.
"""
import html
import re
import sys
import urllib.request

URL_XML = "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=1007469"
ARCHIVO = "/tmp/ley290.xml"

def obtener_xml() -> str:
    try:
        return open(ARCHIVO, encoding="utf-8").read()
    except FileNotFoundError:
        req = urllib.request.Request(URL_XML, headers={"User-Agent": "Mozilla/5.0"})
        xml = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
        open(ARCHIVO, "w", encoding="utf-8").write(xml)
        return xml

def articulos(xml: str) -> dict[str, str]:
    # decodifica entidades (&#237; -> í) y extrae solo los <Texto>...</Texto>
    xml = html.unescape(xml)
    textos = re.findall(r"<Texto>(.*?)</Texto>", xml, re.S)
    cuerpo = " ".join(re.sub(r"<[^>]+>", " ", t) for t in textos)
    cuerpo = re.sub(r"\s+", " ", cuerpo)
    # límites de artículo: "Artículo N.-" o "Artículo N°.-"
    partes = re.split(r"(Art[íi]culo\s+(\d+)[°º]?\.-)", cuerpo)
    mapa: dict[str, str] = {}
    for i in range(1, len(partes) - 1, 3):
        num = partes[i + 1]
        mapa.setdefault(num, "")  # primera aparición gana
        mapa[num] += partes[i + 2]
    return mapa

# claves que el CEC cita: número -> frases que deberían aparecer en él
CLAVES = {
    "80":  ["casco"],
    "120": ["1,50 metros"],
    "124": [],
    "130": ["dos en fondo|no podrán|en fondo"],
    "131": ["tomarse|agarrarse|aferrarse"],
    "134": ["preferencia|paso"],
    "135": ["virar|borde"],
    "138": ["brazo|rumbo"],
    "199": ["luz roja|PARE"],
    "200": ["señales de tránsito"],
    "201": ["casco|señales debidas"],
    "202": ["transgresiones|leves"],
    "204": ["Juzgado|Policía Local|escalas"],
    "205": ["recargos|UTM"],
    "222": ["ciclovías|pista derecha"],
    "223": ["freno|menores"],
    "224": ["estacionan|paraderos"],
}

def main() -> int:
    mapa = articulos(obtener_xml())
    print(f"Total artículos detectados: {len(mapa)}")
    fallos = []
    for num, frases in CLAVES.items():
        texto = mapa.get(num)
        print(f"\n=== Art. {num}: {'PRESENTE' if texto else 'AUSENTE'} ({len(texto) if texto else 0} chars)")
        if texto:
            print("   ", texto[:230])
        for f in frases:
            ok = any(re.search(p, texto or "", re.I) for p in f.split("|"))
            if not ok:
                fallos.append(f"art. {num}: no contiene /{f}/")
            print(f"    {'OK ' if ok else 'FALTA'} contiene {f}")
    # dónde quedaron frases clave que el CEC atribuye a otros números
    for frase, esperado in [("1,50 metros", "120"), ("brazo", "138"), ("señalizador", "138")]:
        hits = [n for n, t in mapa.items() if re.search(frase, t, re.I)]
        marca = "" if esperado in hits else "  <-- OJO: NO está en el artículo citado"
        print(f"\n'{frase}' aparece en arts. {sorted(hits, key=int)[:6]}{marca}")
    if fallos:
        print("\nFALLOS:", *fallos, sep="\n  ")
        return 1
    print("\nTODO OK")
    return 0

if __name__ == "__main__":
    sys.exit(main())
