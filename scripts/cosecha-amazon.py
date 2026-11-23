#!/usr/bin/env python3
# Parser del Best Sellers de Amazon (node 16544 = Cycling / Ciclismo).
# Entrada: /tmp/az-probe.html (pg 1) y /tmp/az-p2.html (pg 2)
# Salida: scripts/data/amazon-bestsellers.json + CSV en download/
import re, html, json, os, csv, sys

def limpiar(s):
    s = html.unescape(s or "")
    return re.sub(r"\s+", " ", s).strip()

def parsear(ruta):
    raw = open(ruta, encoding="utf-8", errors="ignore").read()
    bloques = re.split(r'id="p13n-asin-index-\d+"', raw)[1:]
    items = []
    for b in bloques:
        asin_m = re.search(r'data-asin="([A-Z0-9]{10})"', b)
        rank_m = re.search(r'<span class="zg-bdg-text">#(\d+)</span>', b)
        if not asin_m or not rank_m:
            continue
        asin, rank = asin_m.group(1), int(rank_m.group(1))
        img_m = re.search(r'<img alt="([^"]+)" src="(https://[^"]+\.(?:jpg|png))"', b)
        titulo = limpiar(img_m.group(1)) if img_m else ""
        portada = img_m.group(2) if img_m else ""
        # autor: primer link-child tras el título
        aut_m = re.search(r'class="a-size-small a-link-child"[^>]*>.*?line-clamp-1[^>]*>([^<]+)<', b, re.S)
        autor = limpiar(aut_m.group(1)) if aut_m else ""
        rat_m = re.search(r'<span class="a-icon-alt">([\d.,]+) de 5 estrellas</span>', b)
        nota = (rat_m.group(1).replace(",", ".") if rat_m else None)
        cnt_m = re.search(r'class="a-size-small">([\d.,]+)</span>\s*</a>', b)
        votos = limpiar(cnt_m.group(1)).replace(".", "") if cnt_m else None
        fmt_m = re.search(r'class="a-size-small a-color-secondary a-text-normal">([^<]+)</span>', b)
        formato = limpiar(fmt_m.group(1)) if fmt_m else ""
        items.append({
            "rank": rank, "asin": asin, "titulo": titulo, "autor": autor,
            "nota": float(nota) if nota else None,
            "votos": int(votos) if votos and votos.isdigit() else None,
            "formato": formato, "portada": portada,
            "url": f"https://www.amazon.com/dp/{asin}",
        })
    return items

vistos, todos = set(), []
for ruta in sys.argv[1:]:
    for it in parsear(ruta):
        if it["asin"] in vistos or not it["titulo"]:
            continue
        vistos.add(it["asin"])
        todos.append(it)

todos.sort(key=lambda x: x["rank"])
os.makedirs("/home/z/my-project/scripts/data", exist_ok=True)
json.dump(todos, open("/home/z/my-project/scripts/data/amazon-bestsellers.json", "w"), ensure_ascii=False, indent=1)
print(f"Amazon Best Sellers ciclismo: {len(todos)} items únicos")
for it in todos[:12]:
    print(f"  #{it['rank']:>2} {it['titulo'][:60]} — {it['autor']} (nota {it['nota']})")
