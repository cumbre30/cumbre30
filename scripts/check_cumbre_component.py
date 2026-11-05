#!/usr/bin/env python3
# ¿Qué hay alrededor del nodo de la cumbre? Componente conexa y nodos
# alcanzables cerca de la Virgen.
import json, math
from collections import deque

net = json.load(open("/home/z/my-project/public/red-ciclista.json"))
nodes = net["nodes"]
edges = net["edges"]
classes = net["classes"]
names = net["names"]

adj = [[] for _ in nodes]
for a, b, cls, name, ciclo in edges:
    pa, pb = nodes[a], nodes[b]
    d = math.hypot((pb[0] - pa[0]) * 110.9, (pb[1] - pa[1]) * 92.9)
    adj[a].append((b, d, classes[cls] if cls < len(classes) else "?", names[name] if name < len(names) else "?"))
    adj[b].append((a, d, classes[cls] if cls < len(classes) else "?", names[name] if name < len(names) else "?"))

def nearest_idx(p):
    best, bi = 1e9, -1
    for i, n in enumerate(nodes):
        d = math.hypot((n[0] - p[0]) * 110.9, (n[1] - p[1]) * 92.9)
        if d < best:
            best, bi = d, i
    return bi

CUMBRE = (-33.42527, -70.63324)
i_c = nearest_idx(CUMBRE)
print(f"nodo más cercano a la Virgen: idx={i_c} {nodes[i_c]}")

# componente conexa del nodo cumbre (BFS)
seen = {i_c}
q = deque([i_c])
while q:
    u = q.popleft()
    for v, *_ in adj[u]:
        if v not in seen:
            seen.add(v)
            q.append(v)
print(f"tamaño de la componente del nodo cumbre: {len(seen)}")
if len(seen) <= 25:
    for u in sorted(seen):
        outs = [(nodes[v], c, nm, round(dd, 1)) for v, dd, c, nm in adj[u]]
        print(f"  nodo {u} {nodes[u]} -> {outs}")

# BFS desde la plaza (nodo alcanzable) y distancia mínima de esa
# componente al punto de la Virgen
i_p = nearest_idx((-33.4234, -70.6327))
seen2 = {i_p}
q = deque([i_p])
while q:
    u = q.popleft()
    for v, *_ in adj[u]:
        if v not in seen2:
            seen2.add(v)
            q.append(v)
best, bu = 1e9, -1
for i, n in enumerate(nodes):
    d = math.hypot((n[0] - CUMBRE[0]) * 110.9, (n[1] - CUMBRE[1]) * 92.9)
    if i in seen2 and d < best:
        best, bu = d, i
print(f"componente de la plaza: {len(seen2)} nodos; nodo alcanzable más cercano a la Virgen: {best*1000:.0f} m (idx={bu} {nodes[bu]})")

# aristas que salen del nodo cumbre, con sus clases
print("\naristas del nodo cumbre:")
for v, dd, c, nm in adj[i_c]:
    print(f"  -> nodo {v} {nodes[v]}  clase={c}  nombre={nm!r}  {dd*1000:.0f} m")
