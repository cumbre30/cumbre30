#!/usr/bin/env python3
"""Extrae del grafo propio (public/red-ciclista.json) la geometría de las
vías cuyo nombre contiene 'Cerro'/'Cerrito' cerca de PdV Norte, y los nodos
del grafo más cercanos a una coordenada dada."""
import json, math, sys

D = json.load(open('/home/z/my-project/public/red-ciclista.json'))
nodes, names, edges = D['nodes'], D['names'], D['edges']

def haversine(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 6371000 * 2 * math.asin(math.sqrt(h))

# 1) nombres con Cerro
idx = [i for i, n in enumerate(names) if 'cerr' in n.lower()]
print('== nombres con "cerr":')
for i in idx:
    # cuenta edges con ese nombre
    ne = sum(1 for e in edges if len(e) > 3 and e[3] == i)
    print(f'  [{i}] {names[i]}  ({ne} edges)')

# 2) geometría de las vías con esos nombres en el sector PdV Norte
TARGET = (-33.415479, -70.617402)
print('\n== polylines por nombre (solo edges cerca del acceso PdV):')
for i in idx:
    name = names[i]
    pts = []
    for e in edges:
        if len(e) > 3 and e[3] == i:
            a, b = nodes[e[0]], nodes[e[1]]
            if haversine(a, TARGET) < 1500 or haversine(b, TARGET) < 1500:
                pts.extend([tuple(a), tuple(b)])
    if pts:
        # dedup conservando orden aproximado
        seen, ordered = set(), []
        for p in pts:
            k = (round(p[0], 6), round(p[1], 6))
            if k not in seen:
                seen.add(k); ordered.append(k)
        print(f'  -- {name}: {len(ordered)} nodos')
        for k in ordered:
            print(f'     {k[0]:.6f},{k[1]:.6f}')

# 3) nodos más cercanos a TARGET
print('\n== 8 nodos de grafo más cercanos al acceso objetivo', TARGET, ':')
dists = sorted(((haversine(n, TARGET), i) for i, n in enumerate(nodes)))
for d, i in dists[:8]:
    print(f'  node[{i}] {nodes[i][0]:.6f},{nodes[i][1]:.6f}  d={d:.0f} m')
