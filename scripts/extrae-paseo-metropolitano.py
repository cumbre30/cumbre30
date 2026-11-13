#!/usr/bin/env python3
# ============================================================
# Extrae los tramos «Paseo Metropolitano» del grafo OSM propio
# (public/red-ciclista.json) como polilíneas ordenadas.
# NO modifica nada: sólo produce un JSON de diagnóstico con las
# cadenas por grupo de nombre, largos medidos y extremos.
# ============================================================
import json, math, collections

SRC = "/home/z/my-project/public/red-ciclista.json"
OUT = "/home/z/my-project/scripts/paseo-metropolitano-extract.json"

d = json.load(open(SRC))
nodes, edges, names = d["nodes"], d["edges"], d["names"]
classes = d["classes"]

def haversine(a, b):
    lat1, lon1 = nodes[a]; lat2, lon2 = nodes[b]
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

# grupos de nombre con "Paseo Metropolitano"
grupos = {}
for a, b, cls, nidx, cic in edges:
    nm = names[nidx]
    if "Paseo Metropolitano" in nm:
        grupos.setdefault(nm, []).append((a, b, cls, cic))

resultado = {}
for nm, aristas in sorted(grupos.items()):
    # aristas NO dirigidas para construir cadenas
    adj = collections.defaultdict(list)
    for i, (a, b, cls, cic) in enumerate(aristas):
        adj[a].append((b, i)); adj[b].append((a, i))
    usadas = set()
    componentes = []
    for i, (a, b, cls, cic) in enumerate(aristas):
        if i in usadas: continue
        # BFS por la componente
        cola = [a]; comp = {a}
        aris_comp = []
        while cola:
            u = cola.pop()
            for v, j in adj[u]:
                aris_comp.append(j)
                if v not in comp:
                    comp.add(v); cola.append(v)
        for j in set(aris_comp): usadas.add(j)
        componentes.append(set(aris_comp))

    comps_info = []
    for aris in componentes:
        nodos = set()
        for j in aris:
            a, b = aristas[j][0], aristas[j][1]
            nodos.add(a); nodos.add(b)
        grado = collections.Counter()
        for j in aris:
            grado[aristas[j][0]] += 1; grado[aristas[j][1]] += 1
        # caminar SIN saltos: recorre aristas no usadas; al atascarse
        # cierra la polilínea y abre otra desde el mismo punto si quedan
        # aristas (así las bifurcaciones quedan como polilíneas propias).
        usadas_c = set()
        def vecinos(n):
            return [(v, j) for v, j in adj[n] if j not in usadas_c]
        cadenas = []
        pendientes = set(aris)
        while pendientes:
            # inicio: extremo (grado 1) con aristas libres; si no, cualquier nodo
            inis = [n for n in nodos if grado[n] == 1 and vecinos(n)]
            ini = inis[0] if inis else next(n for n in nodos if vecinos(n))
            cadena = [ini]; cur = ini
            while True:
                sig = vecinos(cur)
                if not sig: break
                v, j = sig[0]
                usadas_c.add(j); pendientes.discard(j)
                cadena.append(v); cur = v
            cadenas.append(cadena)
        cadenas_largo = [sum(haversine(c[k], c[k+1]) for k in range(len(c)-1)) for c in cadenas]
        comps_info.append({
            "cadenas": [[[nodes[n][0], nodes[n][1]] for n in c] for c in cadenas],
            "n_polilineas": len(cadenas),
            "cadena_nodos": sum(len(c) for c in cadenas),
            "largo_m": round(sum(cadenas_largo)),
            "largo_polilineas": [round(x) for x in cadenas_largo],
            "extremos": [[nodes[c[0]][0], nodes[c[0]][1]] for c in cadenas] + [[nodes[c[-1]][0], nodes[c[-1]][1]] for c in cadenas],
            "n_aristas": len(aris),
            "grado": {str(n): g for n, g in grado.items() if g > 2},
            "classes": sorted({classes[aristas[j][2]] for j in aris}),
            "bbox": [min(nodes[n][0] for n in nodos), min(nodes[n][1] for n in nodos),
                     max(nodes[n][0] for n in nodos), max(nodes[n][1] for n in nodos)],
        })
    comps_info.sort(key=lambda c: -c["largo_m"])
    resultado[nm] = {
        "n_aristas_total": len(aristas),
        "n_componentes": len(componentes),
        "largo_total_m": sum(c["largo_m"] for c in comps_info),
        "componentes": comps_info,
    }

json.dump(resultado, open(OUT, "w"), ensure_ascii=False)
for nm, r in resultado.items():
    print(f"\n== {nm} · {r['n_componentes']} componentes · {r['largo_total_m']} m")
    for c in r["componentes"]:
        print(f"   - {c['largo_m']:>5} m · {c['n_polilineas']} polilíneas {c['largo_polilineas']} · {c['cadena_nodos']:>3} nodos · classes={','.join(c['classes'])} · cruces={len(c['grado'])}")
