#!/usr/bin/env python3
"""Extrae accesos, senderos oficiales y anclas del grafo OSM (red-ciclista.json).

Salida: /tmp/parque_data.json con:
- gates: nodo de cada calle de acceso más cercano al borde del polígono
- trails: cadenas de coordenadas de cada sendero oficial + largo (m) + extremos
- anclas: nodos de lugares de interés (Santuario, Bannen, Torreón, Caupolicán...)
"""
import json, math

G = json.load(open("public/red-ciclista.json"))
nodes, edges, names = G["nodes"], G["edges"], G["names"]
# edges: [from, to, classIdx, nameIdx, flag] (observado en el archivo)

# Polígono del parque (park.ts) para medir distancias al borde
import re, pathlib
src = pathlib.Path("src/lib/park.ts").read_text(encoding="utf-8")
pairs = re.findall(r"\{ lat: (-?[\d.]+), lon: (-?[\d.]+) \}", src)
POLY = [(float(a), float(b)) for a, b in pairs]
print("polígono:", len(POLY), "vértices")

def d2seg(p, a, b):
    px, py = p[1], p[0]; ax, ay = a[1], a[0]; bx, by = b[1], b[0]
    dx, dy = bx-ax, by-ay
    L = dx*dx + dy*dy
    t = 0 if L == 0 else max(0, min(1, ((px-ax)*dx + (py-ay)*dy)/L))
    gx, gy = ax+t*dx, ay+t*dy
    return math.hypot(px-gx, py-gy) * 111320 * math.cos(math.radians(p[0])), math.hypot(py-gy)*110540, math.hypot(px-gx)*94000

def dist_to_boundary(p):
    # métrica local en metros (aprox: mezcla de componentes para Santiago)
    best = 1e18
    for i in range(len(POLY)):
        a = POLY[i]; b = POLY[(i+1) % len(POLY)]
        # conversión deg->m local (Santiago): 1°lat≈110540 m, 1°lon≈93500 m
        ax, ay = a[1]*93500*math.cos(math.radians(-33.41)), a[0]*110540
        bx, by = b[1]*93500*math.cos(math.radians(-33.41)), b[0]*110540
        px, py = p[1]*93500*math.cos(math.radians(-33.41)), p[0]*110540
        dx, dy = bx-ax, by-ay
        L = dx*dx + dy*dy
        t = 0 if L == 0 else max(0, min(1, ((px-ax)*dx + (py-ay)*dy)/L))
        gx, gy = ax+t*dx, ay+t*dy
        d = math.hypot(px-gx, py-gy)
        if d < best: best = d
    return best

def nearest_node(p):
    best, bi = 1e18, -1
    px, py = p[1]*93500*math.cos(math.radians(-33.41)), p[0]*110540
    for i, n in enumerate(nodes):
        nx, ny = n[1]*93500*math.cos(math.radians(-33.41)), n[0]*110540
        d = math.hypot(px-nx, py-ny)
        if d < best: best, bi = d, i
    return bi, best

name_idx = {n: i for i, n in enumerate(names)}

# ── 1. Accesos: calle → nodo más cercano al borde del polígono ──
GATES_STREETS = {
    "santos-dumont": ["Avenida Santos Dumont", "Santos Dumont"],
    "aurora-de-chile": ["Aurora de Chile"],
    "zapadores": ["Avenida Los Zapadores"],
    "carlos-reed": ["Avenida Carlos Reed", "Carlos Reed"],
    "paseo-metropolitano": ["Paseo Metropolitano"],
    "la-piramide-camino": ["Camino La Pirámide"],
    "bannen": None,  # ancla
}
gates = {}
for gid, streets in GATES_STREETS.items():
    if streets is None: continue
    best = None
    for s in streets:
        ni = name_idx.get(s)
        if ni is None: continue
        for e in edges:
            if e[3] == ni:
                for nodeIdx in (e[0], e[1]):
                    p = tuple(nodes[nodeIdx])
                    d = dist_to_boundary(p)
                    if best is None or d < best[2]:
                        best = (s, nodeIdx, d, p)
    if best:
        gates[gid] = {"calle": best[0], "nodo": best[1], "distBorde_m": round(best[2]), "lat": best[3][0], "lon": best[3][1]}
print("\n== ACCESOS =="); print(json.dumps(gates, indent=1, ensure_ascii=False))

# ── 2. Senderos oficiales: polilíneas por nombre ──
TRAILS = {
    "Sendero Zorro Vidal": {"oficial_m": 1200},
    "Sendero Mapuche": {"oficial_m": 1300},
    "Sendero del Boy Scout": {"oficial_m": 500},
    "Sendero Anáhuac": {"oficial_m": 300},
    "Sendero Ciclista El Zorzal": {"oficial_m": 500},
    "Sendero Ciclista Anfiteatro": {"oficial_m": 700},
    "Sendero Ciclista Centenario": {"oficial_m": 900},
    "Sendero Ciclista Pa' Arriba": {"oficial_m": 600},
    "Sendero Gabriela Mistral": {"oficial_m": 200},
    "Sendero El Ermitaño": {"oficial_m": 400},
    "Sendero Peatonal Atacameño": {"oficial_m": 1600},
    "Sendero Cerro El Carbón": {"oficial_m": 8000},
    "Sendero Educativo Cerro Polanco": {"oficial_m": None},
    "Paseo Metropolitano - Sendero Bellavista": {"oficial_m": 1000},
    "Paseo Metropolitano - Sendero de los Sentidos": {"oficial_m": 540},
    "Paseo Metropolitano - Sendero La Cascada": {"oficial_m": 1200},
    "Paseo Metropolitano - Tramo Jardín Japonés / Pirámide": {"oficial_m": 3700},
}

def chains_for(ni):
    """Une aristas con ese nameIdx en cadenas ordenadas."""
    adj = {}
    for e in edges:
        if e[3] != ni: continue
        adj.setdefault(e[0], []).append(e[1])
        adj.setdefault(e[1], []).append(e[0])
    if not adj: return []
    visited, chains = set(), []
    for start in list(adj):
        if start in visited: continue
        # extremo de la cadena desde start
        chain = [start]; visited.add(start)
        cur = start
        while True:
            nxt = [v for v in adj.get(cur, []) if v not in visited]
            if not nxt: break
            cur = nxt[0]; visited.add(cur); chain.append(cur)
        chains.append(chain)
    return chains

def chain_len(chain):
    L = 0
    for i in range(1, len(chain)):
        a, b = nodes[chain[i-1]], nodes[chain[i]]
        L += math.hypot((b[1]-a[1])*93500*math.cos(math.radians(-33.41)), (b[0]-a[0])*110540)
    return L

trails = {}
for tname, meta in TRAILS.items():
    ni = name_idx.get(tname)
    if ni is None:
        trails[tname] = {"error": "sin nombre en grafo", "oficial_m": meta["oficial_m"]}
        continue
    chains = chains_for(ni)
    chains = sorted(chains, key=len, reverse=True)
    out = []
    for ch in chains[:3]:
        if len(ch) < 3: continue
        pts = [[nodes[i][0], nodes[i][1]] for i in ch]
        L = chain_len(ch)
        out.append({"pts": pts, "largo_m": round(L), "n": len(pts),
                    "ini": pts[0], "fin": pts[-1]})
    trails[tname] = {"oficial_m": meta["oficial_m"], "cadenas": out}
print("\n== SENDEROS ==")
for k, v in trails.items():
    if "cadenas" in v and v["cadenas"]:
        c = v["cadenas"][0]
        of = v["oficial_m"]
        ok = "OK" if (of and abs(c["largo_m"]-of)/max(of,1) < 0.35) else ("?" if of else "-")
        print(f"  {k}: {c['largo_m']} m (oficial {of} m) [{ok}] cadenas={len(v['cadenas'])} pts={c['n']} ini=({c['ini'][0]:.5f},{c['ini'][1]:.5f}) fin=({c['fin'][0]:.5f},{c['fin'][1]:.5f})")
    else:
        print(f"  {k}: {v}")

# ── 3. Anclas ──
ANCHOR_NAMES = ["Pedro Bannen", "Torreón Victoria", "Plaza Caupolicán", "Santuario", "Teleférico", "Pump Track", "Funicular"]
anchors = {}
for nm in names:
    for a in ANCHOR_NAMES:
        if a.lower() in nm.lower():
            ni = name_idx[nm]
            pts = []
            for e in edges:
                if e[3] == ni and len(pts) < 2:
                    pts = [nodes[e[0]], nodes[e[1]]]
            anchors[nm] = pts[:1]
print("\n== ANCLAS ==")
for k, v in anchors.items():
    if v: print(f"  {k}: ({v[0][0]:.5f}, {v[0][1]:.5f})")

json.dump({"gates": gates, "trails": trails, "anchors": anchors},
          open("/tmp/parque_data.json", "w"), ensure_ascii=False)
print("\nOK -> /tmp/parque_data.json")
