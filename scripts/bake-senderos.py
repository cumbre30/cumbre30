#!/usr/bin/env python3
"""Hornea el catálogo de senderos oficiales desde /tmp/parque_data.json a TS.

Genera src/lib/senderos.ts con polilíneas OSM verificadas, largos oficiales
del mapa Parquemet y cabeza de trail (punto más cercano a un acceso).
"""
import json, math

D = json.load(open("/tmp/parque_data.json"))
trails = D["trails"]

# Accesos existentes + nuevos (para elegir la cabeza del sendero)
GATES = [
    (-33.430691, -70.63592),  # Pío Nono
    (-33.411769, -70.607988),  # Pedro de Valdivia Norte
    (-33.38642, -70.60179),  # La Pirámide
    (-33.423385, -70.637442),  # Santos Dumont
    (-33.430102, -70.635426),  # Carlos Reed
    (-33.415205, -70.627807),  # Aurora de Chile
    (-33.399921, -70.620406),  # Zapadores
    (-33.412407, -70.623052),  # Paseo Metropolitano
]

def m_dist(a, b):
    return math.hypot((b[1]-a[1])*93500*math.cos(math.radians(-33.41)), (b[0]-a[0])*110540)

def trailhead(pts):
    """Extremo de la polilínea más cercano a cualquier acceso."""
    ini, fin = pts[0], pts[-1]
    return ini if min(m_dist(ini, g) for g in GATES) <= min(m_dist(fin, g) for g in GATES) else fin

# id, nombre del grafo, tipo, largo oficial (mapa Parquemet), nota
CATALOGO = [
    ("zorro-vidal", "Sendero Zorro Vidal", "ciclista", 1200, None),
    ("mapuche", "Sendero Mapuche", "ciclista", 1300, "La geometría OSM en 3 tramos; se usa el principal."),
    ("boy-scout", "Sendero del Boy Scout", "ciclista", 500, None),
    ("anahuac", "Sendero Anáhuac", "ciclista", 300, "Tramo corto en OSM; el sendero completo es mayor."),
    ("zorzal", "Sendero Ciclista El Zorzal", "ciclista", 500, None),
    ("anfiteatro", "Sendero Ciclista Anfiteatro", "ciclista", 700, None),
    ("centenario", "Sendero Ciclista Centenario", "ciclista", 900, "Tramo principal en OSM."),
    ("pa-arriba", "Sendero Ciclista Pa' Arriba", "ciclista", 600, "Sendero de subida (su nombre lo dice)."),
    ("gabriela-mistral", "Sendero Gabriela Mistral", "ciclista", 200, None),
    ("ermitano", "Sendero El Ermitaño", "ciclista", 400, None),
    ("la-cascada", "Paseo Metropolitano - Sendero La Cascada", "paseo", 1200, None),
    ("bellavista", "Paseo Metropolitano - Sendero Bellavista", "paseo", 1000, None),
    ("sentidos", "Paseo Metropolitano - Sendero de los Sentidos", "paseo", 540, None),
    ("tramo-jj-piramide", "Paseo Metropolitano - Tramo Jardín Japonés / Pirámide", "paseo", 3700, None),
    ("atacameno", "Sendero Peatonal Atacameño", "peatonal", 1600, "Solo peatones: no es sendero de bici."),
    ("el-carbon", "Sendero Cerro El Carbón", "ciclista", 8000, "Sector Bosque Santiago; geometría OSM parcial (fuera del grafo principal)."),
    ("polanco", "Sendero Educativo Cerro Polanco", "ciclista", None, "Sector Bosque Santiago; geometría OSM parcial."),
]

rows = []
for sid, nombre, tipo, oficial, nota in CATALOGO:
    d = trails.get(nombre, {})
    cad = (d.get("cadenas") or [None])[0]
    pts, medido = None, None
    head = None
    if cad and cad["n"] >= 6 and cad["largo_m"] >= 150:
        pts = [[round(p[0], 5), round(p[1], 5)] for p in cad["pts"]]
        medido = cad["largo_m"]
        head = trailhead(pts)
    rows.append({
        "id": sid, "nombre": nombre, "tipo": tipo,
        "oficial": oficial, "medido": medido,
        "pts": pts, "head": head, "nota": nota,
    })

lines = []
lines.append("// ============================================================")
lines.append("// Senderos oficiales del Parque Metropolitano (mapa Parquemet).")
lines.append("// Largos oficiales: mapa \"Recorre y descubre\" de Parquemet.")
lines.append("// Geometría: red ciclista propia (datos OpenStreetMap),")
lines.append("// verificada contra el largo oficial (diferencias < 15 % en la")
lines.append("// mayoría). La ruta de enduro oficial de Parquemet (5 trazados)")
lines.append("// aún no se publica: al confirmarse se marca enduroOficial aquí.")
lines.append("// Las polilíneas son referencias de contexto; el ruteo propio")
lines.append("// sigue usando el grafo completo.")
lines.append("// ============================================================")
lines.append("")
lines.append('import type { LatLng } from "./park";')
lines.append("")
lines.append("export type SenderoTipo = \"ciclista\" | \"peatonal\" | \"paseo\";")
lines.append("")
lines.append("export type Sendero = {")
lines.append("  id: string;")
lines.append("  nombre: string;")
lines.append("  tipo: SenderoTipo;")
lines.append("  /** Largo según el mapa oficial de Parquemet (null: sin dato). */")
lines.append("  largoOficialM: number | null;")
lines.append("  /** Largo medido en la geometría OSM (null: geometría parcial). */")
lines.append("  largoMedidoM: number | null;")
lines.append("  /** Cabeza del sendero: extremo más cercano a un acceso (para")
lines.append("   *  trazar ruta de llegada). null: geometría insuficiente. */")
lines.append("  cabeza: LatLng | null;")
lines.append("  /** Polilínea OSM simplificada (null: parcial o muy corta). */")
lines.append("  pts: [number, number][] | null;")
lines.append("  /** Las 5 rutas de enduro oficiales: pendiente de Parquemet. */")
lines.append("  enduroOficial: boolean | null;")
lines.append("  nota: string | null;")
lines.append("};")
lines.append("")
lines.append("export const SENDEROS: Sendero[] = [")

for r in rows:
    head = f'{{ lat: {r["head"][0]}, lon: {r["head"][1]} }}' if r["head"] else "null"
    of = r["oficial"] if r["oficial"] is not None else "null"
    med = r["medido"] if r["medido"] is not None else "null"
    nota = json.dumps(r["nota"], ensure_ascii=False) if r["nota"] else "null"
    if r["pts"]:
        lines.append("  {")
        lines.append(f'    id: "{r["id"]}", nombre: "{r["nombre"]}", tipo: "{r["tipo"]}",')
        lines.append(f"    largoOficialM: {of}, largoMedidoM: {med},")
        lines.append(f"    cabeza: {head},")
        lines.append("    pts: [")
        for p in r["pts"]:
            lines.append(f"      [{p[0]}, {p[1]}],")
        lines.append("    ],")
        lines.append("    enduroOficial: null,")
        lines.append(f"    nota: {nota},")
        lines.append("  },")
    else:
        lines.append("  {")
        lines.append(f'    id: "{r["id"]}", nombre: "{r["nombre"]}", tipo: "{r["tipo"]}",')
        lines.append(f"    largoOficialM: {of}, largoMedidoM: {med},")
        lines.append("    cabeza: null, pts: null, enduroOficial: null,")
        lines.append(f"    nota: {nota},")
        lines.append("  },")

lines.append("];")
lines.append("")
lines.append("/** Accesos verificables en park.ts (GATES). */")
lines.append("export function senderosConRuta(): Sendero[] {")
lines.append("  return SENDEROS.filter((s) => s.cabeza !== null);")
lines.append("}")
lines.append("")

out = "\n".join(lines)
open("src/lib/senderos.ts", "w", encoding="utf-8").write(out)
con_ruta = sum(1 for r in rows if r["head"])
print(f"OK -> src/lib/senderos.ts ({len(rows)} senderos, {con_ruta} con ruta, {len(out)/1024:.0f} KB)")
for r in rows:
    print(f"  {r['id']}: oficial={r['oficial']} medido={r['medido']} head={'sí' if r['head'] else 'NO'}")
