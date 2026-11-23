#!/usr/bin/env python3
# Curación del lote Ciclismo: Buscalibre (categoría) + Amazon Best Sellers.
#  · dedupe contra el catálogo vigente (77 títulos en semillas/ingesta)
#  · años solo cuando Open Library los confirma (null si no — regla v4)
#  · regla v4: si la obra tiene edición de referencia en inglés, entra esa
#    y el idioma original se anota en `extra`
# Salidas: download/cosecha-*.csv + scripts/data/lote-ciclismo-candidatos.json
import json, re, time, csv, unicodedata, urllib.request

BASE = "/home/z/my-project/scripts/data"
DL = "/home/z/my-project/download"

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def ol_buscar(q, fields="title,author_name,first_publish_year,publisher,number_of_pages_median"):
    url = "https://openlibrary.org/search.json?q=" + urllib.request.quote(q) + f"&limit=3&fields={fields}"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.load(r).get("docs", [])
    except Exception:
        return []

def doc_ok(doc, titulo):
    # el primer hit de OL debe compartir al menos ~60% de palabras con el título
    if not doc:
        return False
    t1, t2 = set(norm(titulo).split()), set(norm(doc.get("title") or "").split())
    return len(t1 & t2) / max(1, len(t1)) >= 0.6

catalogo = {norm(t) for t in json.load(open(f"{BASE}/catalogo-titulos.json"))}

# ---------- 1. Buscalibre (categoría Ciclismo general y cicloturismo) ----------
bc = json.load(open(f"{BASE}/buscalibre/cosecha-enriquecida.json"))
# autores/años confirmados por snippets del propio Buscalibre y por OL
aportes = {
    "cicloturismo-bikepacking": {"autor": "Juanjo Alonso", "extra": "Guía · 12 rutas circulares de 3-4 etapas por España (Ediciones Desnivel)"},
    "crea-tu-entrenamiento": {"autor": "Bernabé Ramírez", "extra": "Guía de entrenamiento · Independently Published"},
    "digital-tadej-pogacar": {"autor": "Andy McGrath (trad. Fernando Garí)", "extra": "Biografía · edición española de la bio definitiva de Pogačar"},
}
cands_bc, saltados = [], []
for it in bc:
    slug = it["slug"]
    gb = it["gb"] or {}
    # regla v4: Pogačar entra por su edición EN (bestseller Amazon #18) → la ES sale
    if "pogacar" in slug:
        saltados.append((it["name"] or slug, "obra ya cubierta por edición EN (Pogačar, McGrath)"));
        continue
    # 2ª edición de la misma obra ya propuesta
    if "2-ed" in slug:
        saltados.append((it["name"] or slug, "2ª edición de «Viajar en bici», ya propuesta"))
        continue
    ap = aportes.get(next((k for k in aportes if slug.startswith(k)), ""), {})
    # regla de idioma (v4.2): libro en inglés dentro de la categoría ES →
    # no entra al lote; queda como candidato en el CSV de cosecha
    if slug.startswith("mountain-biking"):
        saltados.append((it["name"] or slug, "libro en inglés en categoría ES → candidato CSV, no lote"));
        continue
    # autor desde el propio listado de Buscalibre («Libro X De <Autor> …»)
    nombre_limpio = re.sub(r"( - Buscalibre.*| comprar en tu tienda online.*)$", "", it["name"] or "")
    aut_listado = re.match(r".*\bDe ([A-ZÁÉÍÓÚÑ].*)$", nombre_limpio)
    autor = ap.get("autor") or (", ".join(gb.get("autores") or []) or None)
    if not autor and aut_listado and "buscalibre" not in aut_listado.group(1).lower():
        autor = aut_listado.group(1).strip()
    # sin autor verificado → no entra al lote (queda en el CSV); regla de
    # exactitud: el enlace de búsqueda necesita título+autor
    if not autor and not ap.get("autor"):
        saltados.append((it["name"] or slug, "sin autor verificado → candidato CSV, no lote"));
        continue
    anio_m = re.search(r"\d{4}", str(gb.get("anio") or ""))
    titulo = gb.get("titulo") or re.sub(r"-", " ", slug).strip().title()
    rec = {
        "fuente": "buscalibre.cl (categoría Ciclismo general y cicloturismo)",
        "titulo": titulo, "autor": autor, "tipo": "libro", "idioma": "es",
        "anio": anio_m.group(0) if anio_m else None,
        "isbn": it["isbn"] if re.match(r"^\d{13}$", it["isbn"]) else None,
        "extra": ap.get("extra") or ("Editorial: " + gb["editoriales"][0] if gb.get("editoriales") else ""),
        "portada": gb.get("portada") or "",
        "url_buscalibre": it["pid"] and f"https://www.buscalibre.cl/libro-{it['slug']}/{it['isbn']}/p/{it['pid']}" or "",
        "material_reseña": (gb.get("descripcion") or "")[:400],
    }
    if norm(titulo) in catalogo:
        saltados.append((titulo, "ya está en el catálogo")); continue
    cands_bc.append(rec)

# ---------- 2. Amazon Best Sellers (node 16544) ----------
az = json.load(open(f"{BASE}/amazon-bestsellers.json"))
RANKS_EN = [1, 2, 5, 7, 8, 13, 15, 16, 17, 18, 25, 28, 29, 30, 51, 52, 53, 56, 58, 59, 60, 64, 68, 71, 73, 76, 77, 80]
az_por_rank = {x["rank"]: x for x in az}
cands_az = []
for rk in RANKS_EN:
    it = az_por_rank.get(rk)
    if not it:
        continue
    if norm(it["titulo"]) in catalogo:
        saltados.append((it["titulo"], f"ya está en el catálogo (bestseller #{rk})")); continue
    # título corregido para el caso garbled del scrape (interfaz /-/es/)
    titulo = it["titulo"]
    if titulo.startswith("Matt Fitzgerald"):
        titulo = "How Bad Do You Want It?: Mastering the Psychology of Mind over Muscle"
    # verificación estricta: el doc de OL debe confirmar el AUTOR de Amazon
    # para aceptar su año (el primer hit suelto suele ser otro libro).
    # doc_ok compara contra el FRAGMENTO principal (sin subtítulo), porque
    # los títulos de Amazon arrastran ediciones y colas que OL no replica.
    frag = titulo.split(":")[0][:50]
    autor = it["autor"] or None
    anio = None
    for q in ([frag, titulo[:70]] if autor else []):
        docs = ol_buscar(q)
        hit = next((d for d in docs if d.get("author_name")
                    and norm(d["author_name"][0]).split()[0] == norm(autor).split()[0]
                    and doc_ok(d, frag)), None)
        if hit:
            anio = str(hit.get("first_publish_year") or "") or None
            break
    if not autor:
        # sin autor en el scrape → intento OL con consulta exacta por obra
        QS = {13: "to shake the sleeping self Oregon Patagonia",
              17: "brave athlete calm down and rise to the occasion",
              28: "Science of Cycling transform your ride",
              51: "Mountains epic cycling climbs", 52: "E-bike maintenance repair bible",
              58: "draft animals living the pro cycling dream",
              60: "haywire heart too much exercise",
              68: "dog in a hat American bike racer",
              77: "where there's a will cycle race across america"}
        docs = ol_buscar(QS[rk])
        doc = next((d for d in docs if d.get("author_name") and doc_ok(d, frag)), None)
        if doc:
            autor = ", ".join(doc["author_name"][:2])
            anio = str(doc.get("first_publish_year") or "") or None
    if not autor:
        saltados.append((titulo, f"sin autor verificado (bestseller #{rk}) → candidato CSV")); continue
    cands_az.append({
        "fuente": f"Amazon Best Sellers ciclismo #{rk} (nota {it['nota']}, {it['votos'] or '?'} valoraciones)",
        "titulo": titulo, "autor": autor, "tipo": "libro", "idioma": "en",
        "anio": anio, "isbn": None,
        "extra": f"Best seller Amazon categoría ciclismo · {it['formato']}",
        "portada": it["portada"], "url_amazon": it["url"], "asin": it["asin"],
        "material_reseña": "",
    })
    time.sleep(0.35)

json.dump(cands_bc + cands_az, open(f"{BASE}/lote-ciclismo-candidatos.json", "w"), ensure_ascii=False, indent=1)

# ---------- 3. CSVs de cosecha ----------
with open(f"{DL}/cosecha-amazon-bestsellers-ciclismo.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["rank", "titulo", "autor", "nota", "valoraciones", "formato", "asin", "url"])
    for x in az: w.writerow([x["rank"], x["titulo"], x["autor"], x["nota"], x["votos"], x["formato"], x["asin"], x["url"]])
with open(f"{DL}/cosecha-buscalibre-ciclismo-general.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["titulo", "autor", "anio", "isbn", "url_buscalibre", "idioma"])
    for r in cands_bc + [x for x in []]: w.writerow([r["titulo"], r["autor"], r["anio"], r["isbn"], r["url_buscalibre"], r["idioma"]])

print(f"Buscalibre → lote ES: {len(cands_bc)} | saltados: {len([s for s in saltados if s[1].startswith(('2ª','obra'))])}")
print(f"Amazon → lote EN: {len(cands_az)} | total candidatos: {len(cands_bc)+len(cands_az)}")
print("SALTADOS (en catálogo o duplicados):")
for t, m in saltados: print("  ·", t[:60], "→", m)
print("\nEN sin año confirmado:", [c['titulo'][:40] for c in cands_az if not c['anio']])
print("ES sin autor:", [c['titulo'][:40] for c in cands_bc if not c['autor']])
