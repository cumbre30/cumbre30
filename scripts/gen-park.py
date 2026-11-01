#!/usr/bin/env python3
"""Genera src/lib/park.ts con el polígono real del parque (OSM) y POIs calibrados."""
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
    # (lat, lon, kmh, alt, comentario)
    (-33.4343, -70.6360, 10, 700, "Bellavista (fuera del parque)"),
    (-33.4300, -70.6350, 12, 706, "ingreso por Pío Nono"),
    (-33.4296, -70.6340, 11, 722, "Zoológico Nacional"),
    (-33.4250, -70.6315, 14, 745, "camino interior"),
    (-33.4200, -70.6280, 15, 768, ""),
    (-33.4171, -70.6235, 12, 785, "Casa de la Cultura Anáhuac (curva)"),
    (-33.4100, -70.6215, 16, 830, "tramo a la cumbre"),
    (-33.4040, -70.6170, 8, 875, "Cumbre"),
    (-33.4050, -70.6150, 24, 848, "inicio bajada"),
    (-33.4075, -70.6135, 28, 815, "bajada"),
    (-33.4091, -70.6137, 35, 795, "cruce Piscina Antilén — pico sobre el límite"),
    (-33.4112, -70.6142, 31, 788, ""),
    (-33.4133, -70.6147, 32, 782, "Jardín Japonés"),
    (-33.4130, -70.6130, 27, 772, ""),
    (-33.4128, -70.6115, 25, 760, ""),
    (-33.4122, -70.6095, 22, 748, ""),
    (-33.4118, -70.6085, 16, 738, "salida Acceso Pedro de Valdivia Norte"),
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
