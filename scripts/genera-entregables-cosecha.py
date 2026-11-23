#!/usr/bin/env python3
# Entregables de la cosecha Ciclismo → download/
#  · cosecha-buscalibre-ciclismo-general.csv: los 14 ítems de la categoría
#    (incluye excluidos del lote, con el motivo)
#  · lote-ciclismo-propuesto.csv: los 35 borradores propuestos (con reseña)
#  · informe-cosecha-ciclismo.md: informe editorial para revisión
import json, csv, re, glob

BASE = "/home/z/my-project/scripts/data"
DL = "/home/z/my-project/download"

# ---------- 1. cosecha Buscalibre (14 ítems, con motivo de exclusión) ----------
bruta = json.load(open(f"{BASE}/buscalibre/cosecha-bruta.json"))
enriq = json.load(open(f"{BASE}/buscalibre/cosecha-enriquecida.json"))
lote = json.load(open(f"{BASE}/lote-ciclismo-candidatos.json"))
en_lote = {norm for norm in [x["titulo"] for x in lote]}

MOTIVOS = {
    "cicloturismo-bikepacking": None,
    "viajar-en-bici-manual-practico-de-cicloturismo-de-alforjas": None,
    "ciclomontanismo-viajar-en-bicicleta-por-las-montanas": None,
    "viajar-en-bici-2-ed-manual-practico-de-cicloturismo": "2ª edición de «Viajar en bici» (ya propuesta la 1ª)",
    "crea-tu-entrenamiento-por-intervalos-en-10-minutos-ciclismo-y-ciclistas": None,
    "manual-de-la-bicicleta": None,
    "guia-general-del-ciclismo": None,
    "curso-de-mountain-bike": None,
    "mountain-biking": "Libro en inglés dentro de la categoría ES (política v4.2: enlace iría a Amazon)",
    "ciclismo-entrenamiento-avanzado": None,
    "manual-de-reparacion-de-bicicletas": None,
    "digital-hinault-el-tejon": "Sin autor verificado (Open Library no indexa la edición)",
    "digital-tadej-pogacar": "La obra entra por su edición EN (bestseller Amazon #18, McGrath)",
    "ciclismo-para-ninos": None,
}
filas = []
for it in enriq:
    slug = it["slug"]
    motivo = next((m for k, m in MOTIVOS.items() if slug.startswith(k)), None)
    gb = it["gb"] or {}
    anio_m = re.search(r"\d{4}", str(gb.get("anio") or ""))
    filas.append([
        gb.get("titulo") or re.sub(r"[-_]", " ", slug).title(), ", ".join(gb.get("autores") or []) or "",
        anio_m.group(0) if anio_m else "", it["isbn"] if re.match(r"^\d{13}$", it["isbn"]) else "",
        gb.get("descripcion", "")[:220], motivo or "EN EL LOTE PROPUESTO",
        f"https://www.buscalibre.cl/libro-{slug}/{it['isbn']}/p/{it['pid']}" if it.get("pid") else "",
    ])
filas.sort(key=lambda x: (x[5] != "EN EL LOTE PROPUESTO", x[0].lower()))
# overlay de autores verificados desde la curación (candidatos incluye
# los excluidos con autor confirmado, p.ej. Pogačar ES y los ES del lote)
cand = json.load(open(f"{BASE}/lote-ciclismo-candidatos.json"))
for fila in filas:
    if fila[1].strip():
        continue
    slug_fila = fila[6].split("/libro-")[1].split("/")[0] if "/libro-" in fila[6] else ""
    match = next((c for c in cand if c.get("autor") and slug_fila
                  and (c.get("url_buscalibre") or "").startswith(f"https://www.buscalibre.cl/libro-{slug_fila}")), None)
    if not match and fila[0]:
        match = next((c for c in cand if c.get("autor") and fila[0].lower() in c["titulo"].lower()), None)
    if match:
        fila[1] = match["autor"]
with open(f"{DL}/cosecha-buscalibre-ciclismo-general.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["titulo", "autor", "anio", "isbn", "descripcion (material)", "estado", "url_buscalibre"])
    w.writerows(filas)

# ---------- 2. lote propuesto (35 borradores, con reseña) ----------
lote_final = json.load(open(f"{BASE}/lote-ciclismo-final.json"))
with open(f"{DL}/lote-ciclismo-propuesto.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["idioma", "titulo", "autor", "anio", "categorias", "extra", "resena", "url_compra", "portada", "proveedor"])
    for x in lote_final:
        w.writerow([x["idioma"], x["titulo"], x["autor"], x["anio"] or "", " · ".join(x["categorias"]), x["extra"],
                    x["resena"], x["urlExterna"], x.get("portada") or "", x["proveedor"]])

# ---------- 3. informe editorial ----------
az = json.load(open(f"{BASE}/amazon-bestsellers.json"))
es_lote = [x for x in lote if x["idioma"] == "es"]
en_lote = [x for x in lote if x["idioma"] == "en"]
inf = f"""# Cosecha ciclismo · Buscalibre + Amazon Best Sellers

**Fecha**: 2026-11-23 · **Lote propuesto**: {len(lote)} borradores ({len(es_lote)} en español + {len(en_lote)} en inglés), listos para siembra como `publicado=false`.

## Qué se cosechó

| Fuente | Resultado | Destino |
| --- | --- | --- |
| Buscalibre «Ciclismo general y cicloturismo» (1.231 libros) | 14 libros reales de la categoría | CSV de cosecha + 10 al lote |
| Amazon Best Sellers ciclismo (node 16544, top ~80) | 60 items únicos | CSV de cosecha + 25 al lote |

## Método y límites

- **Buscalibre está detrás de un CAPTCHA humano** (verificación de imágenes). No se automatiza por decisión propia; la cosecha se hizo por el **índice de búsqueda** (los mismos libros de la categoría, con título/autor/ISBN verificados contra Open Library).
- **Amazon Best Sellers** se cosechó directo (páginas 1-2 del nodo 16544, sin bloqueo), con nota y número de valoraciones tal como aparecen.
- **Regla de exactitud**: autor y año solo cuando Open Library o el listado de origen los confirman; si no, `anio=null` y el ítem no entra al lote.
- **Dedupe** contra el catálogo vigente (77 títulos): salieron The Rider, The Secret Race, Lands of Lost Borders, Epic Bike Rides of the World, It's All About the Bike y las dos ediciones de Zinn Road (ya en la biblioteca).
- **Regla v4 (edición de referencia)**: la biografía ES de Pogačar sale del lote porque la obra ya entra por su edición EN (McGrath, bestseller #18). El libro en inglés de la categoría ES (Mountain Biking, De Medeiros) queda solo como candidato CSV.

## Excluidos del lote y por qué

- **Hinault. El Tejón** — sin autor verificado en ninguna fuente abierta → queda en el CSV para completar a mano.
- **The Brave Athlete** fue rescatado con verificación OL (Simon Marshall, 2017); **Science of Cycling**, **The E-Bike Maintenance Bible** y **Where There's a Will** no lograron autor verificado → candidatos CSV.
- Libros no ciclistas del best seller (guías generales de viaje, libros infantiles no temáticos, no-ficción ajena: boxeo, rock, NFL, NBA, motos) se descartaron de plano: {len(az)} items cosechados → 25 al lote.

## Estado y pendiente

- La siembra está **validada end-to-end en Postgres local** (35 creados como borradores, re-run idempotente: 0 duplicados; no toca `publicado/destacado`).
- **Falta la conexión a Neon** para el push a producción (esta sesión no llegó la clave). Un solo comando lo aplica:
  `DATABASE_URL_NEON=$(cat /tmp/neonurl) node scripts/semilla-lote-ciclismo.mjs --neon`
- Tras el push: la API los sirve al instante como borradores (idioma=es → 10 nuevos, idioma=en → 25 nuevos); aparecen en la vista cuando el equipo los publique por oleadas.
"""
open(f"{DL}/informe-cosecha-ciclismo.md", "w", encoding="utf-8").write(inf)
print("CSVs e informe escritos en download/")
for x in glob.glob(f"{DL}/cosecha-*ciclismo*.csv") + glob.glob(f"{DL}/lote-ciclismo*.csv") + glob.glob(f"{DL}/informe-cosecha*"):
    import os; print(" ·", os.path.basename(x), os.path.getsize(x), "bytes")
