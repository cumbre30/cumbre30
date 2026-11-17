#!/usr/bin/env python3
# Verifica que el bundle de producción sirva las features nuevas
# (busca un texto clave en los chunks JS de la página /demo).
import re
import sys
import urllib.request

TXT = sys.argv[1] if len(sys.argv) > 1 else "Rayos"
BASE = "https://cumbregeo.cl"

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "c30-verifica/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

html = get(f"{BASE}/demo").decode("utf-8", "replace")
chunks = sorted(set(re.findall(r"/_next/static/chunks/[A-Za-z0-9._-]+\.js", html)))
print(f"chunks: {len(chunks)}")
ok = False
for c in chunks:
    try:
        data = get(f"{BASE}{c}")
    except Exception as e:  # tile 404 de un chunk retirado no es señal
        continue
    if TXT.encode() in data:
        print(f"ENCONTRADO en {c}")
        ok = True
        break
print("DEPLOY_NUEVO_EN_PRODUCCION" if ok else "AUN_NO_VISIBLE")
