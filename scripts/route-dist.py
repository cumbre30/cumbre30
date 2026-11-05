#!/usr/bin/env python3
# Distancias reales por el grafo OSM (Dijkstra por distancia) para los
# detalles de los segmentos Pro.
import json, math, heapq

net = json.load(open("/home/z/my-project/public/red-ciclista.json"))
nodes = net["nodes"]
edges = net["edges"]

adj = [[] for _ in nodes]
for a, b, cls, name, ciclo in edges:
    pa, pb = nodes[a], nodes[b]
    d = math.hypot((pb[0] - pa[0]) * 110.9, (pb[1] - pa[1]) * 92.9)
    adj[a].append((b, d))
    adj[b].append((a, d))

def nearest_idx(p):
    best, bi = 1e9, -1
    for i, n in enumerate(nodes):
        d = math.hypot((n[0] - p[0]) * 110.9, (n[1] - p[1]) * 92.9)
        if d < best:
            best, bi = d, i
    return bi

def dijkstra(src):
    dist = [float("inf")] * len(nodes)
    dist[src] = 0.0
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist

CUMBRE = (-33.42527, -70.63324)
PLAZA = (-33.4234, -70.6327)
PIO = (-33.430691, -70.63592)
PDV = (-33.411769, -70.607988)
ANTILEN = (-33.409051, -70.61374)

i_cumbre = nearest_idx(CUMBRE)
i_plaza = nearest_idx(PLAZA)

# La cumbre cae en un fragmento aislado (mirador del Santuario); la app
# termina en el nodo alcanzable más cercano (bestNode de findRoute).
# Emulamos eso: componente principal = la del nodo de Plaza México.
adj2 = [[] for _ in nodes]
for a, b, *_ in edges:
    adj2[a].append(b)
    adj2[b].append(a)

from collections import deque
seen = {i_plaza}
q = deque([i_plaza])
while q:
    u = q.popleft()
    for v in adj2[u]:
        if v not in seen:
            seen.add(v)
            q.append(v)

best, i_cumbre_real = 1e9, i_cumbre
for i, n in enumerate(nodes):
    if i in seen:
        d = math.hypot((n[0] - CUMBRE[0]) * 110.9, (n[1] - CUMBRE[1]) * 92.9)
        if d < best:
            best, i_cumbre_real = d, i
print(f"nodo cumbre (fragmento): {nodes[i_cumbre]}")
print(f"nodo cumbre alcanzable (fin real de la ruta): {nodes[i_cumbre_real]} a {best*1000:.0f} m de la Virgen")
print(f"nodo plaza: {nodes[i_plaza]}")
print()
for nombre, p in [("Pío Nono → Cumbre", PIO), ("PdV Norte → Cumbre", PDV), ("Antilén → Cumbre", ANTILEN), ("Pío Nono → Plaza México", PIO), ("PdV Norte → Plaza México", PDV)]:
    d = dijkstra(nearest_idx(p))
    destino = i_cumbre_real if "Cumbre" in nombre else i_plaza
    print(f"  {nombre:26} {d[destino]:.2f} km por el grafo")
