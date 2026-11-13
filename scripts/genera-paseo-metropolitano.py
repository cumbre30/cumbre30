#!/usr/bin/env python3
# ============================================================
# Genera src/lib/paseoMetropolitano.ts a partir de la extracción
# del grafo OSM propio (scripts/paseo-metropolitano-extract.json).
# NO toca archivos existentes: sólo crea el nuevo módulo con la
# variable PASEO_METROPOLITANO_TRAMOS.
# ============================================================
import json, math

EXT = json.load(open("/home/z/my-project/scripts/paseo-metropolitano-extract.json"))
OUT = "/home/z/my-project/src/lib/paseoMetropolitano.ts"

def chain(nombre, idx=0):
    """Primera polilínea (cadenas[0]) del componente idx, limpia."""
    c = EXT[nombre]["componentes"][idx]["cadenas"][0]
    # redondear y quitar duplicados consecutivos
    out = []
    for lat, lon in c:
        p = [round(lat, 6), round(lon, 6)]
        if not out or out[-1] != p:
            out.append(p)
    return out

def largo(pts):
    R = 6371000.0
    tot = 0.0
    for (a, b) in zip(pts, pts[1:]):
        p1, p2 = math.radians(a[0]), math.radians(b[0])
        dp = math.radians(b[0] - a[0]); dl = math.radians(b[1] - a[1])
        h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
        tot += 2*R*math.asin(math.sqrt(h))
    return tot

def fmt(pts, indent="      "):
    lines = []
    for i, (lat, lon) in enumerate(pts):
        sep = ", " if i < len(pts) - 1 else ","
        lines.append(f"{indent}[{lat}, {lon}]{sep}")
    return "\n".join(lines)

# --- tramos ---------------------------------------------------
bicen = chain("Paseo Metropolitano - Parque Bicentenario de la Infancia")
senti = chain("Paseo Metropolitano - Sendero de los Sentidos")
bella = chain("Paseo Metropolitano - Sendero Bellavista")
spdvn = chain("Paseo Metropolitano - Sendero Pedro de Valdivia Norte")
tpdvn = chain("Paseo Metropolitano - Tramo Pedro de Valdivia Norte")
jj1   = chain("Paseo Metropolitano - Tramo Jardín Japonés / Pirámide", 0)
jj2   = chain("Paseo Metropolitano - Tramo Jardín Japonés / Pirámide", 1)
conec = chain("Paseo Metropolitano", 0)  # conector Ermitaño → La Cascada (556 m)
# nota: el grupo «Paseo Metropolitano» tiene además un ramal de acceso
# de 159 m (74+85, 1 bifurcación) y stubs de 13 y 3 m — no se dibujan.
casc  = chain("Paseo Metropolitano - Sendero La Cascada")

# JJ/Pirámide: las 2 cadenas OSM se tocan (-33.391014, -70.60183x) → una sola polilínea.
# Orientar jj2: su extremo más cercano a jj1[-1] va primero.
def dist(a, b):
    return math.hypot((a[0]-b[0])*111000, (a[1]-b[1])*92000)
if dist(jj1[-1], jj2[-1]) < dist(jj1[-1], jj2[0]):
    jj2 = jj2[::-1]
jj = jj1 + jj2[1:]

# validación: saltos absurdos entre puntos consecutivos
for nombre, pts in [("bicen", bicen), ("senti", senti), ("bella", bella), ("spdvn", spdvn),
                    ("tpdvn", tpdvn), ("jj", jj), ("conec", conec), ("casc", casc)]:
    mx = max(math.hypot((b[0]-a[0])*111000, (b[1]-a[1])*92000) for a, b in zip(pts, pts[1:]))
    assert mx < 250, f"{nombre}: salto de {mx:.0f} m"  # hay aristas rectas de hasta 144 m en el way OSM
    print(f"{nombre:>7}: {len(pts):>3} pts · {largo(pts):>6.0f} m · salto máx {mx:.0f} m")

TRAMOS = [
    ("pm-bicentenario", "Tramo Parque Bicentenario de la Infancia",
     "Tramo I del Paseo Metropolitano (2012) · parquemet.cl", 1100, [bicen],
     ["Acceso Pío Nono", "Parque Bicentenario de la Infancia (Recoleta)",
      "Rutas 2 y 5 (pavimento Pío Nono)"],
     "Anillo norte del cerro: ruta exclusiva para peatones y bicicletas."),
    ("pm-sentidos", "Sendero de los Sentidos",
     "Mapa oficial Parquemet 2024 · simbología Paseo Metropolitano", 540, [senti],
     ["Acceso Pío Nono / cima poniente", "Sendero Bellavista (continuación del anillo)"],
     "Sendero interpretativo de uso mixto en la ladera poniente."),
    ("pm-bellavista", "Sendero Bellavista",
     "Nombre OSM: «Paseo Metropolitano - Sendero Bellavista»", None, [bella],
     ["Mirador Terraza Bellavista (ladera sur)", "Sendero de los Sentidos y Tramo Pedro de Valdivia Norte (anillo)"],
     "Une la cima poniente con la ladera sur; geometría completa en el grafo OSM."),
    ("pm-sendero-pdv", "Sendero Pedro de Valdivia Norte",
     "Nombre OSM: «Paseo Metropolitano - Sendero Pedro de Valdivia Norte»", None, [spdvn],
     ["Jardín Mapulemu / Plaza Gabriela Mistral", "Av. Pedro de Valdivia Norte (Rutas 1, 4 y 5) y punto soporte PdV"],
     "Tramo del anillo descubierto en esta investigación: no estaba registrado en el proyecto."),
    ("pm-tramo-pdv", "Tramo Pedro de Valdivia Norte",
     "Mapa oficial Parquemet 2024: «Tramo Pedro de Valdivia» 1,5 km · nombre OSM «Paseo Metropolitano - Tramo Pedro de Valdivia Norte»", 1500, [tpdvn],
     ["Jardín Mapulemu", "Jardín Japonés (empalme con el Tramo Jardín Japonés / Pirámide)"],
     "Tramo del anillo descubierto en esta investigación: no estaba registrado en el proyecto."),
    ("pm-jj-piramide", "Tramo Jardín Japonés / Pirámide",
     "Mapa oficial Parquemet 2024: «Tramo Pirámide / Jardín Japonés» 3,7 km · tramos IV (2014) + V (2020) en parquemet.cl", 3700, [jj],
     ["Jardín Japonés", "Acceso La Pirámide (Bosque Santiago)",
      "Rutas 4 y 5 (pavimento crestería Zañartu · Claudio Gay · Pablo Neruda)",
      "Bajada con control 30 km/h Cima Chacarillas → La Pirámide",
      "MTB 3 · Travesía Paseo Metropolitano"],
     "El tramo más largo del anillo: 3.778 m medidos contra 3,7 km oficiales (Δ 2 %)."),
    ("pm-conector-ermitano", "Conector El Ermitaño · La Cascada",
     "Nombre OSM: «Paseo Metropolitano» (tramo suelto entre El Ermitaño y La Cascada)", None, [conec],
     ["Sector El Ermitaño / La Cantera (Acceso Paseo Metropolitano)", "Cabeza del Sendero La Cascada"],
     "Enlace del anillo poniente con el oriente; descubierto en esta investigación."),
    ("pm-la-cascada", "Sendero La Cascada",
     "Mapa oficial Parquemet 2024: «Tramo La Cascada» 1,2 km", 1200, [casc],
     ["Conector El Ermitaño · La Cascada (poniente)", "Corredor alto oriente hacia Anfiteatro (anillo MTB 3)"],
     "Baja por la ladera oriente junto a la quebrada La Cascada."),
]

total = sum(largo(p[4][0]) for p in TRAMOS)
print(f"TOTAL anillo: {total:.0f} m")

bloques = []
for tid, nombre, origen, oficial, segs, conex, nota in TRAMOS:
    medido = round(sum(largo(s) for s in segs))
    # construir segmentos manualmente
    seg_parts = []
    for s in segs:
        seg_parts.append("    [\n" + fmt(s) + "\n    ]")
    seg_js = ",\n".join(seg_parts)
    conex_js = ",\n".join(f'        "{c}"' for c in conex)
    oficial_js = str(oficial) if oficial is not None else "null"
    bloques.append(f"""  {{
    id: "{tid}",
    nombre: "{nombre}",
    origen: "{origen}",
    largoOficialM: {oficial_js},
    largoMedidoM: {medido},
    segmentos: [
{seg_js},
    ],
    conexiones: [
{conex_js},
    ],
    nota: "{nota}",
  }}""")

total_txt = f"{round(total):,}".replace(",", ".")
archivo = f"""// ============================================================
// PASEO METROPOLITANO — categoría propia del anillo del cerro
// (cliente 2026-11-13: «hay varios tramos en el cerro con el
// nombre de paseo metropolitano, crea una nueva categoría en la
// capa de mapas… son mixtos: peatonal y ciclista, algunos
// conectan con rutas pavimentadas y MTB»).
//
// FUENTES:
//  · Mapa oficial Parquemet 2024 (simbología Paseo Metropolitano):
//    Tramo Pirámide / Jardín Japonés 3,7 km · Tramo La Cascada
//    1,2 km · Tramo Pedro de Valdivia 1,5 km · Sendero de los
//    Sentidos 540 m.
//  · parquemet.cl (lugares/paseo-metropolitano-tramo-i): tramos
//    I–V construidos entre 2012 y 2020, recorrido de casi 20 km
//    por 4 comunas, uso de PEATONES Y BICICLETAS (ruta exclusiva).
//  · Geometría: grafo OSM propio (public/red-ciclista.json) por
//    nombre exacto de cada way; largos medidos contra los oficiales
//    con Δ < 5 % en todos los tramos con largo publicado.
//
// IMPORTANTE (cliente: «no modifiques lo que ya tenemos, guardar
// en otra variable»): estos tramos viven SOLO aquí, en su propia
// variable — no toca SENDEROS (senderos.ts), ni la capa «Senderos
// peatonales», ni rutas ni ruteo. Los tramos ya existen como vías
// del grafo, así que ninguna regla de navegación cambia.
// Investigación 2026-11-13: 4 tramos NO registrados antes en el
// proyecto (Bicentenario de la Infancia, Sendero y Tramo Pedro de
// Valdivia Norte, conector El Ermitaño – La Cascada). El anillo
// medido suma {total_txt} m en 8 tramos; el Paseo Metropolitano
// proyectado por Parquemet sigue en construcción hacia Aurora de
// Chile (4 km pendientes), por eso la capa no cubre los 20 km.
// ============================================================

export type TramoPaseoMetropolitano = {{
  id: string;
  nombre: string;
  /** Fuente del tramo (mapa oficial Parquemet, parquemet.cl u OSM). */
  origen: string;
  /** Largo según mapa oficial Parquemet / parquemet.cl (null: sin dato publicado). */
  largoOficialM: number | null;
  /** Largo medido sobre la geometría del grafo OSM propio. */
  largoMedidoM: number;
  /** Polilíneas del tramo [lat, lon] (1+ si OSM parte el way). */
  segmentos: [number, number][][];
  /** Conexiones verificables con rutas pavimentadas, MTB, accesos y POI. */
  conexiones: string[];
  nota: string | null;
}};

export const PASEO_METROPOLITANO_TRAMOS: TramoPaseoMetropolitano[] = [
{",\n".join(bloques)},
];

/** Total medido del anillo (para etiquetas de la capa). */
export const PASEO_MET_TOTAL_M: number = PASEO_METROPOLITANO_TRAMOS.reduce(
  (acc, t) => acc + t.largoMedidoM,
  0,
);
"""

open(OUT, "w").write(archivo)
print(f"OK -> {{OUT}} ({len(archivo)} bytes)")
