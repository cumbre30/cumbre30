#!/usr/bin/env python3
"""Segunda ronda de búsqueda de fichas con verificación de relevancia del slug."""
import json, re, subprocess, time, unicodedata

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s

BUSQUEDAS = [
    # (titulo_db, query, palabras_slug_obligatorias)
    ("Cuentos de ciclismo", 'site:buscalibre.cl "cuentos de ciclismo"', ["cuentos", "ciclismo"]),
    ("La bicicleta, mi cámara y yo", 'buscalibre "bicicleta" "camara y yo" Gil Ochoa', ["camara"]),
    ("Navarra en Bicicleta", 'buscalibre.cl "navarra en bicicleta" libro Ayesa', ["navarra"]),
    ("Bicicleta: salud y ejercicio", 'buscalibre libro "salud y ejercicio" bicicleta Carmichael Pavelka', ["salud"]),
    ("Desde Monterrey en bicicleta", '"desde monterrey en bicicleta" buscalibre libro', ["monterrey"]),
    ("La bicicleta de Katmandú", '"bicicleta de katmandu" buscalibre libro Ovares', ["katmandu"]),
]

pat = re.compile(r"https://www\.buscalibre\.(cl|us|com\.co|com\.mx|com\.ar)/(libro-[a-z0-9\-]+/[0-9X]{10,13}/p/\d+)")
salida = {}
for titulo, q, req in BUSQUEDAS:
    raw = subprocess.run(["z-ai", "function", "-n", "web_search", "-a", json.dumps({"query": q, "num": 8})],
                         capture_output=True, text=True, timeout=120).stdout
    m = re.search(r"\[.*\]", raw, re.S)
    cand = []
    if m:
        try:
            for r in json.loads(m.group(0)):
                mm = pat.search(r.get("url", ""))
                if mm:
                    cand.append((mm.group(1), mm.group(2)))
        except Exception:
            pass
    orden = {"cl": 0, "us": 1, "com.mx": 2, "com.ar": 3, "com.co": 4}
    ok = None
    for d, ruta in sorted(cand, key=lambda x: orden.get(x[0], 9)):
        slug = ruta.split("/")[0].replace("libro-", "").replace("-", " ")
        if all(w in slug for w in req):
            ok = f"https://www.buscalibre.cl/{ruta}"
            break
    salida[titulo] = ok
    print(f"{titulo}: {ok or '✗'}")
    time.sleep(2)

json.dump(salida, open("/home/z/my-project/scripts/data/fichas-previos-r2.json", "w"), ensure_ascii=False, indent=1)
