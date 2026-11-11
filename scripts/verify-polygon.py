#!/usr/bin/env python3
"""Sanidad del PARK_POLYGON editado: sin autointersecciones y el acceso
PdV cae sobre el borde (tolerancia 80 m de parkInsideTest)."""
import re, math

src = open('/home/z/my-project/src/lib/park.ts').read()
m = re.search(r'export const PARK_POLYGON: LatLng\[\] = \[(.*?)\];', src, re.S)
body = m.group(1)
pts = [(float(a), float(b)) for a, b in re.findall(r'\{\s*lat:\s*(-33\.\d+),\s*lon:\s*(-70\.\d+)\s*\}', body)]
print('vertices:', len(pts))

def hav(p, q):
    la1, lo1, la2, lo2 = map(math.radians, [p[0], p[1], q[0], q[1]])
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 6371000*2*math.asin(math.sqrt(h))

def inside(lat, lon, poly):
    ins = False
    j = len(poly)-1
    for i in range(len(poly)):
        yi, xi = poly[i]; yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj-xi)*(lat-yi)/(yj-yi)+xi:
            ins = not ins
        j = i
    return ins

def dist_to_edge(p, a, b):
    kx = math.cos(math.radians(p[0]))
    px, py = p[1]*kx, p[0]
    ax, ay = a[1]*kx, a[0]; bx, by = b[1]*kx, b[0]
    dx, dy = bx-ax, by-ay
    l2 = dx*dx+dy*dy
    t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/l2)) if l2 else 0
    return math.hypot(px-(ax+dx*t), py-(ay+dy*t))*111320

# 1) distancia del acceso PdV al borde del polígono
T = (-33.415479, -70.617402)
d = min(dist_to_edge(T, pts[i], pts[(i+1) % len(pts)]) for i in range(len(pts)))
print(f'acceso PdV: dist al borde = {d:.1f} m (parkInsideTest tolera 80 m)')

# 2) puntos que deben seguir DENTRO (ciclovía / caminos del parque plano)
test_in = [
    (-33.415539, -70.613809, 'CicloRecreoVía tramo oriente (25305)'),
    (-33.4142, -70.6082, 'CicloRecreoVía oeste (SIM)'),
    (-33.413435, -70.618046, 'ladera r1 idx127'),
    (-33.4121, -70.6076, 'explanada'),
]
for lat, lon, name in test_in:
    d = min(dist_to_edge((lat, lon), pts[i], pts[(i+1) % len(pts)]) for i in range(len(pts)))
    print(f'  DENTRO esperado {name}: inPoly={inside(lat, lon, pts)} distBorde={d:.0f} m')

# 3) puntos que deben quedar FUERA (vecindario al sur de la avenida)
test_out = [
    (-33.4159, -70.6145, 'manzana sur de la avenida'),
    (-33.4165, -70.6155, 'Abate Molina / casas'),
]
for lat, lon, name in test_out:
    d = min(dist_to_edge((lat, lon), pts[i], pts[(i+1) % len(pts)]) for i in range(len(pts)))
    print(f'  FUERA esperado {name}: inPoly={inside(lat, lon, pts)} distBorde={d:.0f} m')

# 4) autointersecciones: segmentos no adyacentes que se crucen en el tramo editado
def seg_int(p1, p2, p3, p4):
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    d1, d2 = cross(p3, p4, p1), cross(p3, p4, p2)
    d3, d4 = cross(p1, p2, p3), cross(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))

bad = 0
n = len(pts)
for i in range(n):
    a1, a2 = pts[i], pts[(i+1) % n]
    for j in range(i+2, n):
        if i == 0 and j == n-1: continue
        b1, b2 = pts[j], pts[(j+1) % n]
        if seg_int(a1, a2, b1, b2):
            bad += 1
            print(f'  CRUCE entre seg {i} y seg {j}: {a1}->{a2} x {b1}->{b2}')
print('autointersecciones:', bad)
