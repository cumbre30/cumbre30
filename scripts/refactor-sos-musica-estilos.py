# Ronda de cambios (cliente 2026-11-17):
#  1) Panel de música: control prioritario, texto en icono de información.
#  2) Velocímetro: 2 estilos nuevos (anillo 360°, bloque de segmentos).
#  3) Minimapa: estilos estéticos (clásico/tarjeta/plano) además del tamaño.
#  4) SOS: 5 columnas × 2 filas (130-134 emergencias; parque y apoyo con
#     sectores municipales + informaciones + tenencia Carabineros PdV).
#  5) Capa del mapa: sectores de emergencia por color.
#  6) i18n es/en/pt.
import pathlib, re, sys

def edit(path, replaces, obligatorios=True):
    p = pathlib.Path(path)
    s = p.read_text()
    for viejo, nuevo in replaces:
        if viejo not in s:
            if obligatorios:
                print(f"✗ FALTA en {path}: {viejo[:70]!r}")
                sys.exit(1)
            continue
        s = s.replace(viejo, nuevo, 1)
    p.write_text(s)
    print(f"✓ {path} ({len(replaces)} reemplazos)")

def add_lucide(path, nombres):
    """Añade nombres al import de lucide-react si faltan."""
    p = pathlib.Path(path)
    s = p.read_text()
    m = re.search(r'import \{([^}]*)\} from "lucide-react";', s)
    assert m, path
    actuales = [x.strip() for x in m.group(1).split(",")]
    faltan = [n for n in nombres if n not in actuales]
    if faltan:
        nuevo = "import { " + ", ".join(actuales + faltan) + ' } from "lucide-react";'
        s = s[: m.start()] + nuevo + s[m.end():]
        p.write_text(s)
    print(f"✓ {path}: lucide +{faltan or 'nada'}")

# ---------------- rideTheme.ts ----------------
edit("src/lib/rideTheme.ts", [
    (
        'export type SpeedoStyle = "digital" | "arco" | "dial" | "aguja";',
        'export type SpeedoStyle = "digital" | "arco" | "dial" | "aguja" | "anillo" | "bloque";'
    ),
    (
        'export type MinimapSize = "compacto" | "normal" | "grande";',
        'export type MinimapSize = "compacto" | "normal" | "grande";\n'
        '// Estilo estético del minimapa (v1.12.13): el marco y el acabado,\n'
        '// independiente del tamaño.\n'
        'export type MinimapStyle = "clasico" | "tarjeta" | "plano";'
    ),
    (
        "  minimapSize: MinimapSize;\n};",
        "  minimapSize: MinimapSize;\n  minimapStyle: MinimapStyle;\n};"
    ),
    (
        '  minimapSize: "normal",\n};',
        '  minimapSize: "normal",\n  minimapStyle: "clasico",\n};'
    ),
    (
        '  { id: "aguja", label: "Aguja", proOnly: true },\n];',
        '  { id: "aguja", label: "Aguja", proOnly: true },\n'
        '  // Nuevos diseños (cliente 2026-11-17, sólo estética):\n'
        '  { id: "anillo", label: "Anillo", proOnly: true },\n'
        '  { id: "bloque", label: "Bloque", proOnly: true },\n];'
    ),
    (
        'export const MINIMAP_SIZES: { id: MinimapSize; label: string; proOnly: boolean }[] = [\n'
        '  { id: "compacto", label: "Compacto", proOnly: false },\n'
        '  { id: "normal", label: "Normal", proOnly: false },\n'
        '  { id: "grande", label: "Grande", proOnly: true },\n'
        '];',
        'export const MINIMAP_SIZES: { id: MinimapSize; label: string; proOnly: boolean }[] = [\n'
        '  { id: "compacto", label: "Compacto", proOnly: false },\n'
        '  { id: "normal", label: "Normal", proOnly: false },\n'
        '  { id: "grande", label: "Grande", proOnly: true },\n'
        '];\n\n'
        'export const MINIMAP_STYLES: { id: MinimapStyle; label: string; proOnly: boolean }[] = [\n'
        '  { id: "clasico", label: "Clásico", proOnly: false },\n'
        '  { id: "tarjeta", label: "Tarjeta", proOnly: true },\n'
        '  { id: "plano", label: "Plano", proOnly: true },\n'
        '];'
    ),
    (
        "      minimapSize: MINIMAP_SIZES.some((m) => m.id === p.minimapSize) ? (p.minimapSize as MinimapSize) : DEFAULT_RIDE_THEME.minimapSize,\n    };",
        "      minimapSize: MINIMAP_SIZES.some((m) => m.id === p.minimapSize) ? (p.minimapSize as MinimapSize) : DEFAULT_RIDE_THEME.minimapSize,\n"
        "      minimapStyle: MINIMAP_STYLES.some((m) => m.id === p.minimapStyle) ? (p.minimapStyle as MinimapStyle) : DEFAULT_RIDE_THEME.minimapStyle,\n    };"
    ),
    (
        "// --- tamaño del velocímetro por preset ---",
        "// --- clases del marco del minimapa por estilo ---\n"
        "export function minimapStyleCls(style: MinimapStyle): string {\n"
        "  switch (style) {\n"
        '    case "tarjeta":\n'
        '      return "rounded-3xl border-2 border-emerald-600/70 shadow-xl ring-1 ring-emerald-500/20";\n'
        '    case "plano":\n'
        '      return "rounded-xl border-0 shadow-none ring-1 ring-border";\n'
        "    default:\n"
        '      return "rounded-2xl border border-border shadow-lg";\n'
        "  }\n"
        "}\n\n"
        "// --- tamaño del velocímetro por preset ---"
    ),
    (
        "//   · minimapSize - compacto / normal / grande (altura del minimapa).",
        "//   · minimapSize - compacto / normal / grande (altura del minimapa).\n"
        "//   · minimapStyle - clásico / tarjeta / plano (marco estético).\n"
        "//   · speedoStyle también agrega anillo (círculo 360°) y bloque\n"
        "//     (tablero de segmentos) desde v1.12.13, sólo estética."
    ),
])

# ---------------- Speedometer.tsx ----------------
ANILLO = '''  if (style === "anillo") {
    // Anillo completo 360° estilo fitness (cliente 2026-11-17): pista
    // circular fina, zonas ámbar (25-30) y roja (30-60) al final del
    // recorrido, punto en la punta del progreso y número gigante al
    // centro. ViewBox cuadrado 240×240.
    const S = 240;
    const C = S / 2;
    const RR = 96;
    const ST = 13;
    const LEN = 2 * Math.PI * RR;
    const fClamped = Math.max(0, Math.min(1, frac));
    const f25 = 25 / MAX_KMH;
    const f30 = 30 / MAX_KMH;
    const numPxR = Math.round(width * 0.3);
    const unitPxR = Math.max(11, Math.round(width * 0.05));
    const ang = -90 + 360 * fClamped;
    const [dx, dy] = polar(C, C, RR, ang);
    return (
      <svg
        viewBox={`0 0 ${S} ${S}`}
        style={{ width: Math.min(width, 230), maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        {/* pista */}
        <circle cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST} className="text-muted-foreground/20" />
        {/* zona ámbar 25-30 y roja 30-60 (arcos del final) */}
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          className="text-amber-500/40"
          strokeDasharray={`${LEN * (f30 - f25)} ${LEN + 4}`}
          strokeDashoffset={-LEN * f25}
        />
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          className="text-red-500/40"
          strokeDasharray={`${LEN * (1 - f30)} ${LEN + 4}`}
          strokeDashoffset={-LEN * f30}
        />
        {/* progreso */}
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          strokeLinecap="round"
          className={className}
          strokeDasharray={`${LEN * fClamped} ${LEN + 4}`}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: "stroke-dasharray 0.35s ease" }}
        />
        {/* punto en la punta del progreso */}
        {fClamped > 0.01 && fClamped < 0.99 && (
          <circle cx={dx} cy={dy} r={ST / 2 + 2} fill="currentColor" className={className} transform={`rotate(90 ${dx} ${dy})`} style={{ transition: "cx 0.35s ease, cy 0.35s ease" }} />
        )}
        <text
          x={C} y={C - 6}
          textAnchor="middle" dominantBaseline="central"
          fill="currentColor"
          className={`${className} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxR }}
        >
          {shown}
        </text>
        <text
          x={C} y={C + numPxR * 0.42}
          textAnchor="middle"
          fill="currentColor"
          className="font-sans font-semibold text-muted-foreground"
          style={{ fontSize: unitPxR }}
        >
          km/h
        </text>
      </svg>
    );
  }

'''
BLOQUE = '''  if (style === "bloque") {
    // Tablero de segmentos (cliente 2026-11-17): 30 bloques verticales
    // (2 km/h cada uno) que se encienden hasta la velocidad; ámbar
    // 25-30 y rojo 30-60 según posición, marca del límite del parque
    // (30 km/h) al centro y número grande a la izquierda. ViewBox 300×120.
    const SEG = 30;
    const X0 = 118;
    const X1 = 292;
    const Y0 = 44;
    const HH = 30;
    const GAP = 1.5;
    const SW = (X1 - X0 - GAP * (SEG - 1)) / SEG;
    const lit = Math.max(0, Math.min(SEG, Math.round(frac * SEG)));
    const numPxB = Math.round(width * 0.24);
    const unitPxB = Math.max(11, Math.round(width * 0.05));
    const segCls = (i: number) => {
      const vHasta = ((i + 1) / SEG) * MAX_KMH;
      if (vHasta > 30) return "text-red-500/75";
      if (vHasta > 25) return "text-amber-500/75";
      return className;
    };
    return (
      <svg
        viewBox="0 0 300 120"
        style={{ width, maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        {/* número grande a la izquierda */}
        <text
          x={14} y={54}
          textAnchor="start" dominantBaseline="central"
          fill="currentColor"
          className={`${className} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxB }}
        >
          {shown}
        </text>
        <text
          x={16} y={54 + numPxB * 0.55}
          textAnchor="start"
          fill="currentColor"
          className="font-sans font-semibold text-muted-foreground"
          style={{ fontSize: unitPxB }}
        >
          km/h
        </text>
        {/* escala */}
        <text x={X0} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9 }}>0</text>
        <text x={(X0 + X1) / 2} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-bold text-amber-600 dark:text-amber-400" style={{ fontSize: 9 }}>30</text>
        <text x={X1} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9 }}>60</text>
        {/* segmentos */}
        {Array.from({ length: SEG }, (_, i) => (
          <rect
            key={i}
            x={X0 + i * (SW + GAP)}
            y={Y0}
            width={SW}
            height={HH}
            rx={2.5}
            fill="currentColor"
            className={i < lit ? segCls(i) : "text-muted-foreground/15"}
            style={{ transition: "fill 0.3s ease" }}
          />
        ))}
        {/* marca del límite del parque (30 km/h) */}
        <line
          x1={X0 + 15 * (SW + GAP) - GAP / 2}
          y1={Y0 - 5}
          x2={X0 + 15 * (SW + GAP) - GAP / 2}
          y2={Y0 + HH + 5}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="text-amber-600 dark:text-amber-400"
        />
        <text x={(X0 + X1) / 2} y={Y0 + HH + 20} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9.5 }}>
          límite del parque
        </text>
      </svg>
    );
  }

'''
edit("src/components/Speedometer.tsx", [
    (
        "// Velocímetro de Cumbre30 - cuatro estilos (Pro):",
        "// Velocímetro de Cumbre30 - seis estilos (Pro desde v1.12.13):"
    ),
    (
        "//   · aguja   - analógico: aguja giratoria, marcas de escala y\n//               zonas ámbar (25-30) y roja (30-60) en la pista.",
        "//   · aguja   - analógico: aguja giratoria, marcas de escala y\n//               zonas ámbar (25-30) y roja (30-60) en la pista.\n//   · anillo  - círculo 360° estilo fitness: progreso fino, zonas\n//               ámbar/roja al final y número gigante al centro.\n//   · bloque  - tablero de 30 segmentos horizontales con la marca\n//               del límite del parque (30 km/h) al centro."
    ),
    (
        '''  return (
    <svg
      viewBox="0 0 300 220"
      style={{ width, maxWidth: "100%" }}
      className="mx-auto block"
      role="img"
      aria-label={t("vel.ariaActual", shown)}
    >
      <GaugeArc frac={frac} className={colorCls} ticks={style === "dial"} />''',
        ANILLO + BLOQUE + '''  return (
    <svg
      viewBox="0 0 300 220"
      style={{ width, maxWidth: "100%" }}
      className="mx-auto block"
      role="img"
      aria-label={t("vel.ariaActual", shown)}
    >
      <GaugeArc frac={frac} className={colorCls} ticks={style === "dial"} />'''
    ),
])

# ---------------- MusicaPanel.tsx ----------------
add_lucide("src/components/MusicaPanel.tsx", ["Info"])
edit("src/components/MusicaPanel.tsx", [
    (
        "  const vivo = useRef(true);",
        "  const [infoOpen, setInfoOpen] = useState(false);\n  const vivo = useRef(true);"
    ),
    # Texto explicativo permanente -> icono de información desplegable
    (
        '''        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("mus.titulo")}</p>
        <button
          onClick={onCerrar}''',
        '''        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("mus.titulo")}</p>
        {/* Explicación larga en el icono de información (cliente
            2026-11-17): el control de música es lo prioritario. */}
        <button
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
          aria-label={t("mus.aria")}
          title={t("mus.aria")}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCerrar}'''
    ),
    (
        '''      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t("mus.sub")}</p>''',
        '''      {infoOpen && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t("mus.sub")}</p>
      )}'''
    ),
])

# ---------------- RideView.tsx: SOS 5x2 + estilo minimapa ----------------
add_lucide("src/components/RideView.tsx", ["Info"])
edit("src/components/RideView.tsx", [
    (
        'import { minimapHeight, useRideTheme } from "@/lib/rideTheme";',
        'import { minimapHeight, minimapStyleCls, useRideTheme } from "@/lib/rideTheme";'
    ),
])
SOS_VIEJO_INI = '''            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sos.emergencias")}</p>'''
SOS_VIEJO_FIN = "            {p.position ? ("
p = pathlib.Path("src/components/RideView.tsx")
s = p.read_text()
i1 = s.find(SOS_VIEJO_INI)
i2 = s.find(SOS_VIEJO_FIN)
assert i1 != -1 and i2 != -1 and i1 < i2, "anclas SOS"
SOS_NUEVO = '''            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sos.emergencias")}</p>
              {/* Emergencias (cliente 2026-11-17): fila única de 5 columnas
                  con los números nacionales, de izquierda a derecha:
                  130 CONAF · 131 Ambulancia · 132 Bomberos · 133 Carabineros
                  · 134 PDI. */}
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {[
                  { tel: "tel:130", n: "130", s: t("sos.conaf") },
                  { tel: "tel:131", n: "131", s: t("sos.ambulancia") },
                  { tel: "tel:132", n: "132", s: t("sos.bomberos") },
                  { tel: "tel:133", n: "133", s: t("sos.carabineros") },
                  { tel: "tel:134", n: "134", s: t("sos.pdi") },
                ].map((x) => (
                  <a
                    key={x.n}
                    href={x.tel}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card py-2.5 text-center hover:border-red-500/70"
                  >
                    <Phone className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-[13px] font-bold tabular-nums text-foreground">{x.n}</span>
                    <span className="px-0.5 text-[8.5px] leading-tight text-muted-foreground">{x.s}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("sos.parqueYApoyo")}</p>
              {/* Parque y apoyo (cliente 2026-11-17): emergencias del parque
                  (1466, insignia roja del cliente) + los 3 municipales por
                  sector (Providencia sur 1414 · Recoleta poniente 1440 ·
                  Huechuraba norte 1417) + informaciones con horario. La
                  tenencia de Carabineros va como nota informativa. */}
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                <a
                  href="tel:1466"
                  className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card py-2.5 text-center hover:border-red-500/70"
                >
                  <Phone className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-[13px] font-bold tabular-nums text-foreground">1466</span>
                  <span className="px-0.5 text-[8.5px] leading-tight text-muted-foreground">{t("sos.emergParquemet")}</span>
                </a>
                {[
                  { tel: "tel:1414", n: "1414", s: "Providencia", sec: t("sos.sectorSur"), rojo: false },
                  { tel: "tel:1440", n: "1440", s: "Recoleta", sec: t("sos.sectorPoniente"), rojo: false },
                  { tel: "tel:1417", n: "1417", s: "Huechuraba", sec: t("sos.sectorNorte"), rojo: false },
                  { tel: "tel:+56227301404", n: "+56 2 2730 1404", s: t("sos.informaciones"), sec: t("sos.horario"), rojo: false },
                ].map((x) => (
                  <a
                    key={x.tel}
                    href={x.tel}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card py-2.5 text-center hover:border-emerald-500/70"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-bold tabular-nums text-foreground">{x.n}</span>
                    <span className="px-0.5 text-[8.5px] leading-tight font-semibold text-foreground/80">{x.s}</span>
                    <span className="px-0.5 text-[8.5px] leading-tight text-muted-foreground">{x.sec}</span>
                  </a>
                ))}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("sos.tenencia")}</span>
              </p>
            </div>
'''
s = s[:i1] + SOS_NUEVO + s[i2:]
# styleClass al MiniMap de RideView
a = "        heightClass={mm.base}"
assert a in s
s = s.replace(a, '        heightClass={mm.base}\n        styleClass={minimapStyleCls(theme.minimapStyle)}')
p.write_text(s)
print("✓ RideView.tsx (SOS 5x2 + styleClass)")

# ---------------- ConfigTab.tsx: Seg de estilo del minimapa ----------------
p = pathlib.Path("src/components/ConfigTab.tsx")
s = p.read_text()
m = re.search(r'import \{([^}]*)\} from "@/lib/rideTheme";', s)
assert m, "import rideTheme en ConfigTab"
actuales = [x.strip() for x in m.group(1).split(",")]
faltan = [n for n in ["MINIMAP_STYLES", "type MinimapStyle"] if n not in actuales]
if faltan:
    nuevo = "import { " + ", ".join(actuales + faltan) + ' } from "@/lib/rideTheme";'
    s = s[: m.start()] + nuevo + s[m.end():]
a = '''      case "minimapa":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <Seg
                options={MINIMAP_SIZES}'''
assert a in s, "case minimapa"
s = s.replace(a, '''      case "minimapa":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.estiloMinimapa")}</p>
              <div className="mt-2.5">
                <Seg
                  options={MINIMAP_STYLES}
                  value={theme.minimapStyle}
                  pro={pro}
                  onPick={(v: MinimapStyle) => pick(theme.minimapStyle, v, (x) => saveRideTheme({ minimapStyle: x }))}
                  onLocked={(label) => locked(t("cfg.lockEstiloMinimapa", label.toLowerCase()))}
                />
              </div>
              <p className="mt-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.tamanoMinimapa")}</p>
              <div className="mt-2.5">
              <Seg
                options={MINIMAP_SIZES}''')
# cierre del div extra: el bloque actual cierra el div tras el Seg; añadir un </div> más
a2 = '''              />
            </div>
          </Card>
        );
      case "accesibilidad":'''
assert a2 in s, "cierre case minimapa"
s = s.replace(a2, '''              />
              </div>
            </div>
          </Card>
        );
      case "accesibilidad":''')
p.write_text(s)
print("✓ ConfigTab.tsx (estilo del minimapa)")

# ---------------- MiniMap.tsx: prop styleClass ----------------
p = pathlib.Path("src/components/MiniMap.tsx")
s = p.read_text()
ok_props = "heightClass: string;" in s
if ok_props:
    s = s.replace("heightClass: string;", "heightClass: string;\n  styleClass?: string;", 1)
idx_destr = s.find("heightClass,")
if idx_destr != -1:
    s = s[:idx_destr] + "styleClass,\n    " + s[idx_destr:]
# primer uso en el JSX (className con heightClass)
m = re.search(r"className=\{[`\"'][^`\"']*heightClass", s)
if m:
    # insertar la clase extra al final de la plantilla del className
    seg = s[m.start():m.start() + 300]
    if "${heightClass}" in seg:
        s = s[:m.start()] + seg.replace("${heightClass}", "${heightClass} ${styleClass ?? \"\"}", 1) + s[m.start() + 300:]
    else:
        s = s[:m.start()] + seg.replace("heightClass", '`${heightClass} ${styleClass ?? ""}`', 1) + s[m.start() + 300:]
    print("✓ MiniMap.tsx (styleClass aplicado)")
else:
    print("⚠ MiniMap: no encontré el className con heightClass — revisar manualmente")
p.write_text(s)

# ---------------- MapView.tsx: capa de sectores ----------------
edit("src/components/MapView.tsx", [
    (
        'import { NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";',
        'import { NAV_DESTINATIONS, PARK_POLYGON, RISK_ZONES, type LatLng } from "@/lib/park";\nimport { SECTORES_EMERGENCIA } from "@/lib/sectoresEmergencia";'
    ),
    (
        '  { id: "urbana", titulo: "mapa.capaUrbana", sub: "mapa.capaUrbanaSub", emoji: "🏙️", items: CAPA_URBANA.length },\n];',
        '  { id: "urbana", titulo: "mapa.capaUrbana", sub: "mapa.capaUrbanaSub", emoji: "🏙️", items: CAPA_URBANA.length },\n'
        '  { id: "sectores", titulo: "mapa.capaSectores", sub: "mapa.capaSectoresSub", emoji: "🚨", items: SECTORES_EMERGENCIA.length },\n];'
    ),
    (
        '''          {/* Límite del parque */}
          <Polygon
            positions={PARK_POLYGON.map((p) => [p.lat, p.lon])}
            pathOptions={{ color: "#34d399", weight: 2, fillColor: "#10b981", fillOpacity: 0.08 }}
          />''',
        '''          {/* Límite del parque */}
          <Polygon
            positions={PARK_POLYGON.map((p) => [p.lat, p.lon])}
            pathOptions={{ color: "#34d399", weight: 2, fillColor: "#10b981", fillOpacity: 0.08 }}
          />

          {/* Capa Sectores de emergencia (cliente 2026-11-17): división
              orientativa del parque por sector municipal, destacada por
              color con el teléfono de contacto de cada patrulla. */}
          {capasVis["sectores"] &&
            SECTORES_EMERGENCIA.map((sec) => (
              <Polygon
                key={sec.id}
                positions={sec.polygon.map((p) => [p.lat, p.lon])}
                pathOptions={{ color: sec.color, weight: 2, dashArray: "6 4", fillColor: sec.color, fillOpacity: 0.14 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="text-xs font-medium">
                    {sec.emoji} {sec.nombre} · {t(sec.sectorKey)} · {sec.telefono}
                  </span>
                </Tooltip>
              </Polygon>
            ))}'''
    ),
    (
        '''                {m.id === "pois" && (''',
        '''                {m.id === "sectores" && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">{t("mapa.sectoresNota")}</p>
                      <SwitchCapa on={on} onClick={() => onVer("sectores")} label="sectores" />
                    </div>
                    <ul>
                      {SECTORES_EMERGENCIA.map((sec) => (
                        <FilaPunto
                          key={sec.id}
                          p={{ nombre: `${sec.nombre} · ${t(sec.sectorKey)}`, detalle: `${t("sos.emergencias")} ${sec.telefono}`, emoji: sec.emoji }}
                          color={sec.color}
                          onFocus={() => onFocus({ kind: "punto", p: sec.polygon[Math.floor(sec.polygon.length / 2)] })}
                        />
                      ))}
                    </ul>
                  </>
                )}
                {m.id === "pois" && ('''
    ),
], obligatorios=True)
# default de capasVis: activar "sectores" si hay un objeto literal de defaults
p = pathlib.Path("src/components/MapView.tsx")
s = p.read_text()
m = re.search(r"capasVis\] = useState<Record<string, boolean>>\(\{([^}]*)\}\)", s)
if m:
    if '"sectores"' not in m.group(1) and "sectores" not in m.group(1):
        s = s[:m.start(1)] + " sectores: true," + s[m.start(1):]
        p.write_text(s)
        print("✓ MapView: capasVis sectores default ON")
    else:
        print("• MapView: capasVis ya considera sectores")
else:
    print("⚠ capasVis: patrón de defaults no encontrado (revisar manualmente)")

# ---------------- i18n.ts ----------------
edit("src/lib/i18n.ts", [
    (
        '  "cfg.subMinimapa": ["Tamaño del minimapa de navegación", "Navigation minimap size", "Tamanho do minimapa de navegação"],',
        '''  "cfg.subMinimapa": ["Tamaño del minimapa de navegación", "Navigation minimap size", "Tamanho do minimapa de navegação"],
  // Estilos nuevos (cliente 2026-11-17) + SOS 5x2 + capa sectores
  "cfg.estiloMinimapa": ["Estilo", "Style", "Estilo"],
  "cfg.tamanoMinimapa": ["Tamaño", "Size", "Tamanho"],
  "cfg.lockEstiloMinimapa": ["El estilo {0} del minimapa", "The {0} minimap style", "O estilo {0} do minimapa"],
  "sos.conaf": ["CONAF · Incendios forestales", "CONAF · Forest fires", "CONAF · Incêndios florestais"],
  "sos.pdi": ["PDI", "PDI", "PDI"],
  "sos.sectorSur": ["sector sur", "south sector", "setor sul"],
  "sos.sectorPoniente": ["sector poniente", "west sector", "setor oeste"],
  "sos.sectorNorte": ["sector norte", "north sector", "setor norte"],
  "sos.informaciones": ["Informaciones", "Information", "Informações"],
  "sos.horario": ["09:00 a 17:00", "09:00 to 17:00", "09:00 às 17:00"],
  "sos.tenencia": ["Tenencia de Carabineros en acceso Pedro de Valdivia", "Carabineros police post at the Pedro de Valdivia entrance", "Destacamento da Carabineros no acesso Pedro de Valdivia"],
  "mapa.capaSectores": ["Sectores de emergencia", "Emergency sectors", "Setores de emergência"],
  "mapa.capaSectoresSub": ["Providencia (sur) · Recoleta (poniente) · Huechuraba (norte)", "Providencia (south) · Recoleta (west) · Huechuraba (north)", "Providencia (sul) · Recoleta (oeste) · Huechuraba (norte)"],
  "mapa.sectoresNota": ["División orientativa por sector de emergencia", "Orientation-only emergency sector split", "Divisão orientativa por setor de emergência"],'''
    ),
])
print("REFACTOR OK")
