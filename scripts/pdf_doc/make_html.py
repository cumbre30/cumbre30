#!/usr/bin/env python3
"""Convierte el PDF técnico en un HTML autocontenido (páginas embebidas en base64).

Uso: python3 scripts/pdf_doc/make_html.py
Salida: download/Cumbre30-Doc-Tecnica.html
"""
import base64
import io
import os
import subprocess

SRC = "/home/z/my-project/download/cumbre30-doc-tecnica-motor-gps-minimapa-pipeline.pdf"
OUT = "/home/z/my-project/download/Cumbre30-Doc-Tecnica.html"
TMP = "/tmp/pdfpages"

os.makedirs(TMP, exist_ok=True)
for f in os.listdir(TMP):
    os.remove(os.path.join(TMP, f))

# Renderizar páginas a JPEG (110 DPI, calidad 80)
subprocess.run([
    "pdftoppm", "-r", "110", "-jpeg", "-jpegopt", "quality=80",
    SRC, os.path.join(TMP, "p"),
], check=True)

pages = sorted(os.listdir(TMP))
n = len(pages)
print(f"Páginas renderizadas: {n}")

def b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")

# Índice de capítulos -> página física (verificada contra el PDF)
indice = [
    ("Portada", 1), ("Contenido", 2), ("1. Arquitectura general", 3),
    ("2. Motor GPS de rides", 4), ("3. Datos y navegación", 6), ("4. Minimapa", 8),
    ("5. Optimización de datos locales", 10), ("6. Backend: base de datos y autenticación", 11),
    ("7. Integraciones de API", 13), ("8. Doble compilación web y APK", 15),
    ("9. Despliegue en Vercel", 16), ("10. Checklist de réplica", 18),
]

nav = "".join(
    f'<a href="#pg{i}">{t}</a>' for t, i in indice
)

imgs = []
for i, name in enumerate(pages, start=1):
    data = b64(os.path.join(TMP, name))
    imgs.append(
        f'<section id="pg{i}" class="pg"><img src="data:image/jpeg;base64,{data}" '
        f'alt="Página {i} de {n}" loading="lazy"/></section>'
    )

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Cumbre30 · Documentación técnica — Motor GPS, Minimapa y Pipeline de Producción</title>
<style>
  :root {{ --azul:#0c2238; --acento:#3ba7c4; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:#eef2f5; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
  header {{ position:sticky; top:0; z-index:10; background:var(--azul); color:#fff; padding:10px 16px;
           display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,.25); }}
  header h1 {{ font-size:14px; margin:0 12px 0 0; font-weight:600; letter-spacing:.3px; }}
  nav {{ display:flex; flex-wrap:wrap; gap:4px 10px; }}
  nav a {{ color:#cfe8f2; font-size:12px; text-decoration:none; padding:2px 6px; border-radius:4px; }}
  nav a:hover {{ background:rgba(255,255,255,.15); color:#fff; }}
  main {{ max-width:940px; margin:0 auto; padding:18px 10px 40px; }}
  .pg {{ margin:0 0 18px; }}
  .pg img {{ width:100%; height:auto; display:block; border-radius:6px;
            box-shadow:0 2px 10px rgba(12,34,56,.18); background:#fff; }}
  .salto {{ text-align:center; color:#6b7c8a; font-size:11px; margin:-12px 0 14px; letter-spacing:1px; }}
</style>
</head>
<body>
<header>
  <h1>Cumbre30 · Doc técnica</h1>
  <nav>{nav}</nav>
</header>
<main>
{"".join(imgs)}
</main>
</body>
</html>"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

print(f"OK -> {OUT}")
print(f"Tamaño: {os.path.getsize(OUT)/1e6:.2f} MB")
