#!/usr/bin/env python3
"""Genera src/lib/park.ts con el polígono real del parque (OSM) y POIs calibrados.

⚠️ park.ts ahora incluye secciones mantenidas A MANO (NAV_DESTINATIONS con
Plaza México y la Cumbre corregida 2026-11-05, y los comentarios con fuentes).
Re-ejecutar este script PISARÍA esas secciones: si regeneras, vuelve a
agregarlas desde el park.ts vigente en git.
"""
import json, math

d = json.load(open("/home/z/my-project/scripts/osm-calibrated.json"))
park = d["park"]
pois = d["pois"]

def nearest_vertex(ref):
    rlat, rlon = ref
    best, bi = 1e9, None
    for lat, lon in park:
        # aproximación planar a esta escala
        dd = (lat - rlat) ** 2 + ((lon - rlon) * math.cos(math.radians(rlat))) ** 2
        if dd < best:
            best, bi = dd, (lat, lon)
    return bi, math.sqrt(best) * 111_000  # metros aprox

gates_ref = {
    "pio-nono": (-33.4337, -70.6366),
    "pv-norte": (-33.4130, -70.6063),
}
gates = {}
for k, ref in gates_ref.items():
    pos, dist = nearest_vertex(ref)
    gates[k] = pos
    print(f"acceso {k}: {pos} (ref a {dist:.0f} m)")

bbox_lat = (min(p[0] for p in park), max(p[0] for p in park))
bbox_lon = (min(p[1] for p in park), max(p[1] for p in park))
print(f"bbox: lat {bbox_lat}, lon {bbox_lon}")

zone_pos = {
    "antiluen": (pois["antilen"]["lat"], pois["antilen"]["lon"]),
    "jardin-japones": (pois["jardin"]["lat"], pois["jardin"]["lon"]),
    "zoologico": (pois["zoo"]["lat"], pois["zoo"]["lon"]),
    "anahuac": (pois["anahuac"]["lat"], pois["anahuac"]["lon"]),
}

def fmt_point(p):
    return f"{{ lat: {p[0]}, lon: {p[1]} }}"

def fmt_poly(points, per_line=3):
    lines = []
    for i in range(0, len(points), per_line):
        chunk = ", ".join(fmt_point(p) for p in points[i:i + per_line])
        lines.append("  " + chunk + ",")
    return "\n".join(lines)

poly_txt = fmt_poly(park)

route = [
    # (lat, lon, kmh, alt, comentario) — geografía real: la cumbre es el
    # Santuario de la Virgen (863 m, Wikipedia), NO el sector Tupahue.
    (-33.4343, -70.6360, 10, 700, "Bellavista (fuera del parque)"),
    (-33.4300, -70.6350, 12, 706, "ingreso por Pío Nono"),
    (-33.4296, -70.6340, 11, 722, "Zoológico Nacional"),
    (-33.4277, -70.6337, 12, 758, "camino a la cumbre (lado del Funicular)"),
    (-33.4262, -70.6334, 10, 812, "recta final junto al Santuario"),
    (-33.42527, -70.63324, 8, 863, "Cumbre — Virgen de la Inmaculada"),
    (-33.4234, -70.6327, 14, 848, "Plaza México (fuente, buses panorámicos)"),
    (-33.4195, -70.6280, 16, 822, "Av. Pedro Bannen hacia Tupahue"),
    (-33.4171, -70.6235, 12, 785, "Casa de la Cultura Anáhuac (curva)"),
    (-33.4148, -70.6190, 18, 790, "tramo Tupahue → Jardín Japonés"),
    (-33.4133, -70.6147, 20, 792, "Jardín Japonés"),
    (-33.4112, -70.6138, 18, 798, "Av. Carlos Martner hacia Antilén"),
    (-33.4091, -70.6137, 16, 802, "cruce Piscina Antilén (cumbre Chacarillas)"),
    (-33.4112, -70.6135, 24, 794, "vuelta por Carlos Martner"),
    (-33.4118, -70.6105, 35, 762, "bajada a PdV Norte — pico sobre el límite"),
    (-33.4118, -70.6080, 16, 738, "salida Acceso Pedro de Valdivia Norte"),
    (-33.4113, -70.6068, 12, 730, "Av. Pedro de Valdivia (fuera)"),
]

route_txt_lines = []
for lat, lon, kmh, alt, cmt in route:
    c = f" // {cmt}" if cmt else ""
    route_txt_lines.append(f"  {{ lat: {lat}, lon: {lon}, kmh: {kmh}, alt: {alt} }},{c}")
route_txt = "\n".join(route_txt_lines)

ts = f'''// ============================================================
// Datos calibrados del Parque Metropolitano de Santiago
// (Cerro San Cristóbal). Límite real simplificado desde
// OpenStreetMap way/168227059 (147 vértices, tolerancia ~13 m)
// y POIs geocodificados con Nominatim.
// El límite vigente al interior del parque es 30 km/h (Parquemet).
// ============================================================

export const LIMIT_KMH = 30;
export const CAUTION_KMH = LIMIT_KMH - 3; // aviso previo a los 27 km/h

export type LatLng = {{ lat: number; lon: number }};

/** Polígono real del Parque Metropolitano (OSM way/168227059). */
export const PARK_POLYGON: LatLng[] = [
{poly_txt}
];

export type Gate = {{
  id: string;
  name: string;
  position: LatLng;
}};

/** Accesos principales donde Parquemet fiscaliza / pide enrolamiento. */
export const GATES: Gate[] = [
  {{ id: "pio-nono", name: "Acceso Pío Nono", position: {fmt_point(gates["pio-nono"])} }},
  {{ id: "pv-norte", name: "Acceso Pedro de Valdivia Norte", position: {fmt_point(gates["pv-norte"])} }},
];

export type RiskZone = {{
  id: string;
  name: string;
  position: LatLng;
  radiusM: number;
  /** Mensaje de voz al aproximarse. */
  voice: string;
}};

/** Zonas de riesgo: puntos sensibles de control y accidentes. */
export const RISK_ZONES: RiskZone[] = [
  {{
    id: "anahuac",
    name: "Curva Casa de la Cultura Anáhuac",
    position: {fmt_point(zone_pos["anahuac"])},
    radiusM: 140,
    voice: "Atención, curva cerrada de la Casa Anáhuac. Reduce velocidad.",
  }},
  {{
    id: "antiluen",
    name: "Cruce Piscina Antilén",
    position: {fmt_point(zone_pos["antiluen"])},
    radiusM: 130,
    voice: "Proximidad a la piscina Antilén. Cruza con precaución, área peatonal.",
  }},
  {{
    id: "jardin-japones",
    name: "Jardín Japonés",
    position: {fmt_point(zone_pos["jardin-japones"])},
    radiusM: 120,
    voice: "Jardín Japonés a la vista. Peatones cruzando.",
  }},
  {{
    id: "salida-pv",
    name: "Salida Pedro de Valdivia",
    position: {fmt_point(gates["pv-norte"])},
    radiusM: 130,
    voice: "Tramo previo a la salida Pedro de Valdivia. Confluencia de ciclistas y vehículos.",
  }},
  {{
    id: "zoologico",
    name: "Zoológico Nacional",
    position: {fmt_point(zone_pos["zoologico"])},
    radiusM: 120,
    voice: "Zona de Zoológico. Niños y peatones en el camino.",
  }},
];

// ============================================================
// Ruta de simulación: Pío Nono → Cumbre → bajada por Antilén
// → Jardín Japonés → salida Pedro de Valdivia Norte.
// kmh = velocidad objetivo en el tramo; alt = altitud (m s.n.m.)
// ============================================================

export type SimWaypoint = LatLng & {{ kmh: number; alt: number }};

export const SIM_ROUTE: SimWaypoint[] = [
{route_txt}
];
'''

open("/home/z/my-project/src/lib/park.ts", "w").write(ts)
print("park.ts generado:", len(park), "vértices,", len(route), "waypoints")
print("⚠️  RECUERDA: park.ts lleva NAV_DESTINATIONS y comentarios a mano —")
print("     este script los borra; restáuralos desde git si regeneraste.")
