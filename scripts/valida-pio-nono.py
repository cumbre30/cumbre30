"""Validación independiente de los % de la ruta a Pío Nono.

Compara lo que la app muestra (chip «Ciclovía 69% · Compartida», de las
propiedades de la ruta dibujada) contra el registro real de tramos
(public/red-ciclista.json: cicloviaPolylines + clases por arista),
usando el MISMO criterio de la app (punto medio de cada segmento a
menos de 22 m de un punto de ciclovía registrada).
"""
import json, math

def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

def dist_ps(p, a, b):
    # distancia aproximada punto-segmento (proyección sobre el segmento)
    ax, ay = b[1]-a[1], b[0]-a[0]
    bx, by = p[1]-a[1], p[0]-a[0]
    l2 = ax*ax + ay*ay
    if l2 == 0:
        return hav(p, a)
    t = max(0, min(1, (bx*ax + by*ay)/l2))
    return hav(p, [a[0] + t*ay, a[1] + t*ax])

ruta = json.load(open("/tmp/ruta-pio-nono.json"))
grafo = json.load(open("/home/z/my-project/public/red-ciclista.json"))

print("=== Registro del grafo ===")
print("clases:", grafo.get("classes"))
print("polilíneas ciclovía:", len(grafo.get("cicloviaPolylines", [])))
print("aristas:", len(grafo.get("edges", [])), "| nodos:", len(grafo.get("nodes", [])))

# puntos de ciclovía registrados (para el snap a 22 m, criterio app)
pts_ciclo = []
for poly in grafo.get("cicloviaPolylines", []):
    for nid in poly:
        pts_ciclo.append(grafo["nodes"][nid])
print("puntos de ciclovía registrados:", len(pts_ciclo))

# índice de aristas por clase: (a,b,ciclovia,classIdx)
edges = grafo["edges"]
nodes = grafo["nodes"]

def clase_cercana(p):
    best, bd = None, 1e9
    for e in edges:
        a, b = nodes[e[0]], nodes[e[1]]
        d = dist_ps(p, a, b)
        if d < bd:
            bd, best = d, e
    return best, bd

feats = ruta["remaining"]["features"]
print("\n=== Tramos dibujados (route-remaining) ===")
tot, tot_ciclo = 0.0, 0.0
tot_snap = 0.0
comp = {}
for f in feats:
    cs = f["geometry"]["coordinates"]
    props = f.get("properties", {})
    flag_app = props.get("ciclo") is True
    L = 0.0
    Lc = 0.0
    for i in range(len(cs) - 1):
        a, b = [cs[i][1], cs[i][0]], [cs[i+1][1], cs[i+1][0]]
        d = hav(a, b)
        L += d
        mid = [(a[0]+b[0])/2, (a[1]+b[1])/2]
        # criterio app: punto medio a <22 m de ciclovía registrada
        hit = min(hav(mid, q) for q in pts_ciclo) < 22 if pts_ciclo else False
        if hit:
            Lc += d
            tot_snap += d
        # clase de la vía bajo el tramo (para «compartida» vs calzada)
        e, de = clase_cercana(mid)
        cls = grafo["classes"][e[2]] if e else "?"
        ciclo_reg = e[4] == 1 if e else False
        clave = (cls, bool(ciclo_reg))
        comp.setdefault(clave, 0.0)
        comp[clave] += d
    tag = "ciclovía" if flag_app else "compartida/calzada"
    print(f"  tramo {f['properties'].get('name','?')[:38]:38} app={tag} {L:7.0f} m | snap<22m ciclo: {Lc/L*100:5.1f}%")
    tot += L
    if flag_app:
        tot_ciclo += L

pct_app = tot_ciclo/tot*100 if tot else 0
pct_snap = tot_snap/tot*100 if tot else 0
print(f"\n% ciclovía según la app (propiedades de la ruta): {pct_app:.1f}%")
print(f"% ciclovía por snap<22m al registro:              {pct_snap:.1f}%")
print(f"chip mostrado: {ruta.get('chip')}")

print("\n=== Composición real de la ruta por clase de vía ===")
for (cls, creg), L in sorted(comp.items(), key=lambda kv: -kv[1]):
    print(f"  {cls:16} ciclo_reg={str(creg):5} {L:7.0f} m  ({L/tot*100:5.1f}%)")
