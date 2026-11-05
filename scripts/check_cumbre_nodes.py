#!/usr/bin/env python3
# Nodos del grafo a <=150 m de la Virgen, con su clase, nombre y si
# pertenecen a la componente principal (la de Plaza México).
import json, math
from collections import deque

net = json.load(open("/home/z/my-project/public/red-ciclista.json"))
nodes = net["nodes"]
edges = net["edges"]
classes = net["classes"]
names = net["names"]

adj = [[] for _ in nodes]
for a, b, *_ in edges:
    adj[a].append(b)
    adj[b].append(a)

i_p = None
best = 1e9
for i, n in enumerate(nodes):
    d = math.hypot((n[0] + 33.4234) * 110.9, (n[1] + 70.6327) * 92.9)
    if d < best:
        best, i_p = d, i

seen = {i_p}
q = deque([i_p])
while q:
    u = q.popleft()
    for v in adj[u]:
        if v not in seen:
            seen.add(v)
            q.append(v)

CUMBRE = (-33.42527, -70.63324)
grados = [0] * len(nodes)
for a, b, *_ in edges:
    grados[a] += 1
    grados[b] += 1

print("nodos a <=150 m de la Virgen (dist | idx | lat,lon | clase | nombre | componente | grado):")
cand = []
for i, n in enumerate(nodes):
    d = math.hypot((n[0] - CUMBRE[0]) * 110.9, (n[1] - CUMBRE[1]) * 92.9)
    if d <= 0.150:
        cand.append((d, i, n))
for d, i, n in sorted(cand):
    # clase/nombre: buscar una arista incidente
    cls, nm = "?", "?"
    for a, b, ci, ni, *_ in edges:
        if a == i or b == i:
            cls = classes[ci] if ci < len(classes) else "?"
            nm = names[ni] if ni < len(names) else ""
            break
    comp = "PRINCIPAL" if i in seen else "fragmento"
    print(f"  {d*1000:5.0f} m | {i:6} | ({n[0]:.6f},{n[1]:.6f}) | {cls:12} | {nm[:38]:38} | {comp} | grado {grados[i]}")
