#!/usr/bin/env python3
# ============================================================
# Cambios del cliente (2026-11-22):
#   1. Segmentos SIN categorías: fuera la categoría «Predefinidas»
#      (los 7 oficiales del cerro); «Mías» (trazados propios) queda
#      como único contenido. Los oficiales siguen listados SOLO en
#      Estadísticas → Pro (única sede del cronometraje).
#   2. Amigos fuera del Perfil Ciclista: el mismo AmigosTab ya vive
#      en Comunidad → Siguiendo (duplicado exacto). La invitación por
#      enlace (/geo?agregar=usuario) pasa a aterrizar allí, y esa
#      subsección queda libre para invitados (AmigosTab no llama al
#      servidor sin sesión).
#   3. Limpieza i18n: 9 claves ex.seg* de la categoría retirada +
#      menu.amigos (sin huérfanas).
# ============================================================
import re, sys

def edita(ruta, reemplazos, conteo_exacto=True):
    t = open(ruta, encoding="utf-8").read()
    for viejo, nuevo in reemplazos:
        n = t.count(viejo)
        if n != 1:
            print(f"FALLO en {ruta}: patrón aparece {n} veces (esperaba 1):\n  {viejo[:100]!r}")
            sys.exit(1)
        t = t.replace(viejo, nuevo)
    open(ruta, "w", encoding="utf-8").write(t)
    print(f"✓ {ruta}: {len(reemplazos)} edición(es)")

# ------------------------------------------------------------
# 1) ExplorarView.tsx
# ------------------------------------------------------------
EV = "src/components/ExplorarView.tsx"
edita(EV, [
    # cabecera del archivo
    (
"""//   · Rutas: Mis rutas · Mis segmentos (Predefinidas del cerro
//     de serie + Mías del ciclista) · Explorar mapa · Crear ·
//     Guardados.""",
"""//   · Rutas: Mis rutas · Mis segmentos (trazados propios; los
//     oficiales del cerro viven solo en Estadísticas → Pro,
//     decisión del cliente 2026-11-22) · Explorar mapa · Crear ·
//     Guardados.""",
    ),
    # import de SEGMENTS ya sin uso
    (
'import { SEGMENTS } from "@/lib/segments";\n',
"",
    ),
    # props: llega la invitación para prellenar AmigosTab
    (
"""function ExplorarView({
  sub,
  onSub,
  onGoHistorial,
  ...mapProps
}: Omit<MapViewProps, "orden"> & {
  sub: ExplorarSub;
  onSub: (s: ExplorarSub) => void;
  /** «Desde una actividad»: hoy el camino real es un trazado guardado
   *  (mapa → Mis trazados → Crear ruta). El Historial queda a un
   *  toque para revisar los rides que ya terminaron. */
  onGoHistorial?: () => void;
}) {""",
"""function ExplorarView({
  sub,
  onSub,
  onGoHistorial,
  invitado,
  ...mapProps
}: Omit<MapViewProps, "orden"> & {
  sub: ExplorarSub;
  onSub: (s: ExplorarSub) => void;
  /** «Desde una actividad»: hoy el camino real es un trazado guardado
   *  (mapa → Mis trazados → Crear ruta). El Historial queda a un
   *  toque para revisar los rides que ya terminaron. */
  onGoHistorial?: () => void;
  /** Invitación de amigo (/geo?agregar=usuario): prellena el campo de
   *  AmigosTab en «Siguiendo» — única sede del módulo desde 2026-11-22. */
  invitado?: string | null;
}) {""",
    ),
    # estado segCat fuera
    (
"""  // Categorías de la subsección Segmentos (cliente 2026-11-21): los
  // tramos OFICIALES del cerro vienen de serie (lib/segments) como
  // categoría «Predefinidas» — partida por defecto, sin lista vacía
  // inicial — y lo creado por el ciclista vive en «Mías».
  const [segCat, setSegCat] = useState<"pre" | "mias">("pre");""",
"""  // Segmentos (cliente 2026-11-22): sin categorías — solo «Mías», los
  // trazados propios del ciclista. Los 7 oficiales del cerro se listan
  // únicamente en Estadísticas → Pro (única sede del cronometraje).""",
    ),
    # AmigosTab recibe la invitación
    (
"""              <div className="mt-2">
                <AmigosTab />
              </div>""",
"""              <div className="mt-2">
                <AmigosTab invitado={invitado} />
              </div>""",
    ),
])

# Bloque grande de la sección segmentos: reemplazo por anclas
t = open(EV, encoding="utf-8").read()
inicio = '            <section className="mt-4" data-testid="ex-contenido-segmentos">\n'
fin = "            </section>\n"
i = t.index(inicio)
j = t.index(fin, i)
nuevo_bloque = inicio + """              <p className="text-[13px] text-muted-foreground">{t("ex.segSub")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatCard n={trazasSegmento.length} label={t("ex.segStatGuardados")} />
                <StatCard n={trazasSegmento.filter((tz) => tz.origen === "motor").length} label={t("ex.segStatMotor")} />
                <StatCard n={trazasSegmento.filter((tz) => tz.origen === "gpx").length} label={t("ex.segStatGpx")} />
              </div>
              {trazasSegmento.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("ex.vacioSegmentos")}</p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {trazasSegmento.map((tz) => (
                    <li key={tz.id} className="rounded-xl border border-border bg-card px-2.5 py-2" data-testid={`ex-segmento-${tz.id}`}>
                      <div className="flex items-center gap-2">
                        <MilestoneIcon />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">{tz.nombre}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {tz.distKm.toFixed(1)} km{tz.gainM > 0 ? ` · +${Math.round(tz.gainM)} m` : ""} · {tz.createdAt.slice(0, 10)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        <MiniBoton onClick={() => mapaConOrden({ tipo: "encuadrar", rutaLocal: { id: tz.id, nombre: tz.nombre, coords: tz.coords } })}>
                          {t("ex.verEnMapa")}
                        </MiniBoton>
                        <MiniBoton onClick={() => mapaConOrden({ tipo: "desde-traza", traza: tz })}>{t("ex.crearElegir")}</MiniBoton>
                        <MiniBoton
                          onClick={() => removeTraza(tz.id)}
                          className="hover:border-red-400 hover:text-red-500"
                          aria-label={t("bib.accEliminar")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </MiniBoton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => mapaConOrden({ tipo: "trazar-segmento" })}
                data-testid="ex-trazar-segmento"
                className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                {t("ex.trazarSegmento")}
              </button>
""" + fin
t = t[:i] + nuevo_bloque + t[j + len(fin):]
open(EV, "w", encoding="utf-8").write(t)
assert "segCat" not in t and "SEGMENTS" not in t and "ex.segCatPre" not in t, "restos de la categoría en ExplorarView"
print("✓ ExplorarView: sección Segmentos ahora es solo «Mías»")

# ------------------------------------------------------------
# 2) PerfilTab.tsx
# ------------------------------------------------------------
PT = "src/components/PerfilTab.tsx"
edita(PT, [
    (
""" * PerfilTab - Perfil Ciclista (v1.13.16, reorganizado en v1.14.0):
 * 4ª pestaña de la barra inferior con TRES secciones (SubTabs):""",
""" * PerfilTab - Perfil Ciclista (v1.13.16, reorganizado en v1.14.0):
 * 4ª pestaña de la barra inferior con DOS secciones (SubTabs):""",
    ),
    (
""" *   · Amigos - el listado y la invitación por enlace (trasladado del
 *     menú lateral).
 *
""",
""" *
 * Amigos ya no vive aquí (2026-11-22): estaba duplicado con Comunidad
 * → Siguiendo (el mismo AmigosTab); quedó solo allí, junto al resto
 * del módulo comunitario.
 *
""",
    ),
    ('import { AmigosTab } from "@/components/AmigosTab";\n', ""),
    ('type Seccion = "adn" | "desafios" | "amigos";', 'type Seccion = "adn" | "desafios";'),
    (
"""export function PerfilTab({
  onGoCuenta,
  onGoPro,
  invitado,
}: {
  onGoCuenta?: () => void;
  onGoPro?: () => void;
  invitado?: string | null;
}) {""",
"""export function PerfilTab({
  onGoCuenta,
  onGoPro,
}: {
  onGoCuenta?: () => void;
  onGoPro?: () => void;
}) {""",
    ),
    (
"""  // Secciones del Perfil (v1.14.0). La invitación por enlace de amigo
  // (/geo?agregar=usuario) aterriza directo en Amigos.
  const [seccion, setSeccion] = useState<Seccion>(invitado ? "amigos" : "adn");
  useEffect(() => {
    if (invitado) setSeccion("amigos");
  }, [invitado]);""",
"""  // Secciones del Perfil (v1.14.0). La invitación por enlace de amigo
  // (/geo?agregar=usuario) ya NO aterriza aquí: va a Comunidad →
  // Siguiendo (AmigosTab, 2026-11-22).
  const [seccion, setSeccion] = useState<Seccion>("adn");""",
    ),
    (
"""      {/* Tres secciones (v1.14.0): ADN · Desafíos y recompensas · Amigos */}
      <SubTabs
        ariaLabel={t("pc.seccionesAria")}
        value={seccion}
        onChange={(k) => setSeccion(k as Seccion)}
        tabs={[
          { key: "adn", label: t("pc.secAdn") },
          { key: "desafios", label: t("menu.premios") },
          { key: "amigos", label: t("menu.amigos") },
        ]}
      />

      {seccion === "adn" && adn}
      {seccion === "desafios" && <DesafiosYRecompensas onGoPerfil={onGoCuenta} onGoPro={onGoPro} />}
      {seccion === "amigos" && <AmigosTab onGoPerfil={onGoCuenta} invitado={invitado} />}""",
"""      {/* Dos secciones (v1.14.0; Amigos pasó a Comunidad → Siguiendo en
          2026-11-22, estaba duplicado con el mismo AmigosTab) */}
      <SubTabs
        ariaLabel={t("pc.seccionesAria")}
        value={seccion}
        onChange={(k) => setSeccion(k as Seccion)}
        tabs={[
          { key: "adn", label: t("pc.secAdn") },
          { key: "desafios", label: t("menu.premios") },
        ]}
      />

      {seccion === "adn" && adn}
      {seccion === "desafios" && <DesafiosYRecompensas onGoPerfil={onGoCuenta} onGoPro={onGoPro} />}""",
    ),
])

# ------------------------------------------------------------
# 3) page.tsx
# ------------------------------------------------------------
PG = "src/app/page.tsx"
edita(PG, [
    (
"""  // Invitación de amigo (Ola 2): /geo?agregar=usuario abre el Perfil
  // Ciclista en su sección Amigos con el nombre prellenado (después del
  // montaje, sin romper la hidratación).
  const [invitado, setInvitado] = useState<string | null>(null);
  useEffect(() => {
    const quien = new URLSearchParams(window.location.search).get("agregar");
    if (quien) {
      setInvitado(quien);
      setScreen("ciclista");
    }
  }, []);""",
"""  // Invitación de amigo (Ola 2): /geo?agregar=usuario abre Comunidad →
  // Siguiendo (AmigosTab, única sede desde 2026-11-22) con el nombre
  // prellenado (después del montaje, sin romper la hidratación).
  const [invitado, setInvitado] = useState<string | null>(null);
  useEffect(() => {
    const quien = new URLSearchParams(window.location.search).get("agregar");
    if (quien) {
      setInvitado(quien);
      setScreen("explorar");
      setExplorarSub("siguiendo");
    }
  }, []);""",
    ),
    (
"""  const enMapaLibre = screen === "explorar" && explorarSub === "mapa";
  const sesionRequerida =
    esInvitado && screen !== "ride" && screen !== "perfil" && screen !== "config" && !enMapaLibre;""",
"""  const enMapaLibre = screen === "explorar" && explorarSub === "mapa";
  // Siguiendo (AmigosTab) también queda libre para invitados: es la
  // sede de la invitación por enlace y NO llama al servidor sin sesión.
  const enSiguiendo = screen === "explorar" && explorarSub === "siguiendo";
  const sesionRequerida =
    esInvitado && screen !== "ride" && screen !== "perfil" && screen !== "config" && !enMapaLibre && !enSiguiendo;""",
    ),
    (
"""            sub={explorarSub}
            onSub={setExplorarSub}
            onGoHistorial={() => go("historial")}""",
"""            sub={explorarSub}
            onSub={setExplorarSub}
            invitado={invitado}
            onGoHistorial={() => go("historial")}""",
    ),
    (
"""            onGoCuenta={() => go("perfil")}
            onGoPro={() => go("planes")} // desafíos Pro → comparación FREE/PRO
            invitado={invitado}
          />""",
"""            onGoCuenta={() => go("perfil")}
            onGoPro={() => go("planes")} // desafíos Pro → comparación FREE/PRO
          />""",
    ),
    (
"""            {/* Desafíos y recompensas + Amigos: secciones del Perfil Ciclista (v1.14.0) */}""",
"""            {/* Desafíos y recompensas: sección del Perfil Ciclista (v1.14.0); Amigos vive en Comunidad → Siguiendo desde 2026-11-22 */}""",
    ),
])

# ------------------------------------------------------------
# 4) i18n.ts: claves huérfanas fuera
# ------------------------------------------------------------
I18N = "src/lib/i18n.ts"
CLAVES = [
    "ex.segCatPre", "ex.segCatMias", "ex.segPreSub", "ex.segPreStatOf",
    "ex.segPreStatSub", "ex.segPreStatBaj", "ex.segPreCrono",
    "ex.segDirSubida", "ex.segDirBajada", "menu.amigos",
]
t = open(I18N, encoding="utf-8").read()
for k in CLAVES:
    m = re.search(rf'\n  "{re.escape(k)}": \[[^\]]*\],', t)
    if not m:
        print(f"FALLO: clave {k} no encontrada en i18n")
        sys.exit(1)
    t = t[:m.start()] + t[m.end():]
open(I18N, "w", encoding="utf-8").write(t)
print(f"✓ i18n: {len(CLAVES)} claves huérfanas retiradas")

# ------------------------------------------------------------
# Verificación global
# ------------------------------------------------------------
comprobaciones = [
    (EV, lambda t: "segCat" not in t),
    (EV, lambda t: "SEGMENTS" not in t),
    (EV, lambda t: 'invitado={invitado}' in t and '<AmigosTab invitado={invitado} />' in t),
    (PT, lambda t: "AmigosTab" not in t and "invitado" not in t and '"amigos"' not in t),
    (PG, lambda t: 'setExplorarSub("siguiendo")' in t and "enSiguiendo" in t),
    (PG, lambda t: "invitado={invitado}\n            onGoHistorial" in t),
    (I18N, lambda t: all(f'"{k}"' not in t for k in CLAVES)),
]
for ruta, cond in comprobaciones:
    if not cond(open(ruta, encoding="utf-8").read()):
        print(f"FALLO de verificación en {ruta}")
        sys.exit(1)
print("✓ Verificación global OK: Predefinidas fuera de Segmentos, Amigos solo en Comunidad")
