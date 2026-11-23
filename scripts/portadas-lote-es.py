#!/usr/bin/env python3
# Portadas de la oleada ES vía z-ai image-search (OSS, URLs garantizadas).
# Verifica cada URL con curl (content-type image/*, tamaño > 4 KB) y
# prefiere resultados verticales (formato portada). Aplica anio OL confirmado.
import json, re, subprocess, time
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
F = BASE / "lote-es-fichas-final.json"
lote = json.loads(F.read_text())

# año confirmado por Open Library en la pasada de curación
for l in lote:
    if l["titulo"] == "Medicina del ciclismo" and l["anio"] is None:
        l["anio"] = 2002  # OL: Medicina del Ciclismo (Medicina Deportiva), Paidotribo, 2002

def buscar_portada(titulo, autor):
    q = f'portada del libro "{titulo}" {autor.split(",")[0]}'
    out = Path("/tmp/imgsearch.json")
    r = subprocess.run(["z-ai", "image-search", "-q", q, "--gl", "us", "--count", "5",
                        "--no-rank", "--output", str(out)],
                       capture_output=True, text=True, timeout=120)
    if not out.exists():
        return None
    try:
        d = json.loads(out.read_text())
    except Exception:
        return None
    res = d.get("results") or []
    def score(x):
        try:
            w = int(re.sub(r"\D", "", x.get("original_width") or "0") or 0)
            h = int(re.sub(r"\D", "", x.get("original_height") or "0") or 0)
        except Exception:
            w = h = 0
        vertical = 1.0 if h > w else 0.0
        grande = min(h / 300, 1.0) if h else 0
        return vertical + grande
    return sorted(res, key=score, reverse=True)

def url_ok(url):
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w",
                        "%{http_code} %{size_download} %{content_type}", "-L", "--max-time", "20", url],
                       capture_output=True, text=True, timeout=40)
    m = re.match(r"(\d+) (\d+) ([^\s]+)", r.stdout.strip())
    if not m:
        return False
    code, size, ct = int(m.group(1)), int(m.group(2)), m.group(3)
    return code == 200 and size > 4000 and ct.startswith("image/")

n_ok = 0
for i, l in enumerate(lote, 1):
    res = buscar_portada(l["titulo"], l["autor"])
    elegida = None
    for x in (res or [])[:4]:
        u = x.get("original_url") or ""
        if u and url_ok(u):
            elegida = u
            break
    l["portada"] = elegida
    n_ok += bool(elegida)
    print(f"{i:2d}/25 {'✓' if elegida else '✗'} {l['titulo'][:56]}")
    time.sleep(1)

F.write_text(json.dumps(lote, ensure_ascii=False, indent=1))
print(f"\nportadas resueltas: {n_ok}/25 · guardado {F}")
