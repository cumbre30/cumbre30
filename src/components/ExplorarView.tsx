"use client";

// ============================================================
// ExplorarView - rediseño de la pestaña Explorar (mockup del
// cliente, 2026-11-21): «Rutas, segmentos y comunidad» es el
// protagonista y el MAPA pasa a ser una subsección más («Explorar
// mapa»), dejando de ser la pantalla entera.
//
//   · Hero + conmutador grande: Rutas y segmentos · Comunidad.
//   · Rutas: Mis rutas · Mis segmentos · Explorar mapa · Crear ·
//     Guardados.
//   · Comunidad: Descubrir · Rutas compartidas · Experiencias ·
//     Siguiendo · Mi aporte.
//
// Todo cuelga de lo ya construido — sin duplicar lógica:
//   · Biblioteca (rutasStore) y su overlay completo siguen viviendo
//     en MapView; el módulo la abre con órdenes y la sección que
//     corresponde (tabInicial).
//   · Trazados del usuario (trazasUsuario), catálogo público
//     (rutasApi), amigos y el mapa completo con todas sus
//     herramientas (búsqueda, capas, avisos, editor, trazados).
// Las acciones cruzan secciones con un bus de órdenes puntual
// (OrdenExplorar): el mapa se monta al entrar a «Explorar mapa» y
// aplica la orden una sola vez.
// Experiencias: la app registra la experiencia al cerrar un ride
// con ruta proyectada (fase F §6/§8); aún no hay muro público, así
// que la sección muestra un estado honesto con el CTA al catálogo.
// ============================================================

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Bookmark,
  Compass,
  Heart,
  Map as MapIcon,
  MessagesSquare,
  Navigation,
  PencilRuler,
  Route,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import { useTrazas, removeTraza, type TrazaGuardada } from "@/lib/trazasUsuario";
import { catalogoRutas, misFavoritas, type RutaFavorita, type RutaPublica } from "@/lib/rutasApi";
import { useMe } from "@/hooks/useMe";
import { buildRutaGpxBlob } from "@/lib/gpx";
import { PARK_POLYGON } from "@/lib/park";
import { ETIQUETAS_DIFICULTAD, type Dificultad } from "@/lib/dificultad";
import CatalogoTab from "@/components/CatalogoTab";
import { AmigosTab } from "@/components/AmigosTab";
import type { MapViewProps, OrdenExplorar } from "@/components/MapView";
import { t, useLang } from "@/lib/i18n";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-card text-sm text-muted-foreground">
      {t("pg.cargandoMapa")}
    </div>
  ),
});

/** Subsecciones del módulo (conmutador + subnavs del mockup). */
export type ExplorarSub =
  | "rutas"
  | "segmentos"
  | "mapa"
  | "crear"
  | "guardados"
  | "descubrir"
  | "compartidas"
  | "experiencias"
  | "siguiendo"
  | "aporte";

type Seccion = "rutas" | "comunidad";

/** Snapshot de servidor ESTABLE (patrón BibliotecaRutas): un literal
 *  nuevo por llamada de getServerSnapshot dispara el aviso de
 *  useSyncExternalStore y una hidratación inestable. */
const SERVIDOR_VACIO: RutaV2[] = [];

/** Bbox del parque para «Rutas que podrían gustarte»: el catálogo es
 *  geográfico y la app vive alrededor del Parque Metropolitano. */
function bboxParque(): { n: number; s: number; e: number; o: number } {
  let n = -90;
  let s = 90;
  let e = -180;
  let o = 180;
  for (const p of PARK_POLYGON) {
    n = Math.max(n, p.lat);
    s = Math.min(s, p.lat);
    e = Math.max(e, p.lon);
    o = Math.min(o, p.lon);
  }
  return { n, s, e, o };
}

const difEtiqueta = (n: number): string => {
  const d = Math.min(5, Math.max(1, Math.round(n))) as Dificultad;
  return ETIQUETAS_DIFICULTAD[d];
};

function ExplorarView({
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
}) {
  useLang();
  const [seccion, setSeccion] = useState<Seccion>("rutas");
  // Bus de órdenes hacia el mapa embebido: un contador por orden y el
  // objeto completo en estado; MapView aplica cada n una sola vez.
  const [orden, setOrden] = useState<OrdenExplorar | undefined>(undefined);
  const ordenNRef = useRef(0);
  const enviar = useCallback((o: Omit<OrdenExplorar, "n">) => {
    ordenNRef.current += 1;
    setOrden({ ...o, n: ordenNRef.current });
  }, []);
  /** Navegar al mapa SIN orden (limpia la anterior: al remontarse el
   *  mapa no debe repetir «trazar ruta» de hace tres clics). */
  const irAlMapa = useCallback(() => {
    setOrden(undefined);
    onSub("mapa");
  }, [onSub]);
  const mapaConOrden = useCallback(
    (o: Omit<OrdenExplorar, "n">) => {
      onSub("mapa");
      enviar(o);
    },
    [onSub, enviar]
  );

  // ----------------------------------------------------------------
  // Datos reales: biblioteca local + trazados + favoritas + catálogo
  // ----------------------------------------------------------------
  const rutas = useSyncExternalStore(rutasStore.subscribe, () => rutasStore.get(), () => SERVIDOR_VACIO);
  const trazas = useTrazas();
  const { me } = useMe();
  const userEmail = me?.user.email ?? null;
  const [favoritas, setFavoritas] = useState<RutaFavorita[] | null>(null);
  const [destacadas, setDestacadas] = useState<RutaPublica[] | null>(null);
  const [destacadasNota, setDestacadasNota] = useState(false);
  // Favoritas y destacadas son LECTURAS CON SESIÓN: sin cuenta no se
  // golpea el servidor (evita 401 ruidosos de invitados); el estado
  // honesto es la lista vacía. El catálogo inline de «Rutas
  // compartidas» (CatalogoTab) mantiene su comportamiento propio.
  useEffect(() => {
    let alive = true;
    const ir = async () => {
      if (!userEmail) {
        if (alive) {
          setFavoritas([]);
          setDestacadas([]);
          setDestacadasNota(true);
        }
        return;
      }
      const f = await misFavoritas();
      if (alive) setFavoritas(f.ok && f.favoritas ? f.favoritas : []);
      const c = await catalogoRutas({ ...bboxParque(), take: 6 });
      if (!alive) return;
      if (c.ok && c.routes.length > 0) {
        setDestacadas(c.routes);
        setDestacadasNota(false);
      } else {
        setDestacadas([]);
        setDestacadasNota(true);
      }
    };
    const id = setTimeout(() => void ir(), 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [userEmail]);

  const listaPublicadas = rutas.filter((r) => r.serverId);
  const listaBorradores = rutas.filter((r) => r.status === "borrador");
  const trazasSegmento = trazas.filter((tz) => tz.kind === "segmento");

  /** Descarga el GPX de una ruta local (mismo patrón que la ficha). */
  const descargarGpx = (r: RutaV2): void => {
    const slug = (r.nombre || "ruta-cumbre30").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ruta-cumbre30";
    const blob = buildRutaGpxBlob({ nombre: r.nombre, descripcion: r.descripcion, coords: r.coords, eleM: r.eleM });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const seccionRutas: { id: ExplorarSub; label: string }[] = [
    { id: "rutas", label: t("ex.tabRutas") },
    { id: "segmentos", label: t("ex.tabSegmentos") },
    { id: "mapa", label: t("ex.tabMapa") },
    { id: "crear", label: t("ex.tabCrear") },
    { id: "guardados", label: t("ex.tabGuardados") },
  ];
  const seccionComunidad: { id: ExplorarSub; label: string }[] = [
    { id: "descubrir", label: t("ex.tabDescubrir") },
    { id: "compartidas", label: t("ex.tabCompartidas") },
    { id: "experiencias", label: t("ex.tabExperiencias") },
    { id: "siguiendo", label: t("ex.tabSiguiendo") },
    { id: "aporte", label: t("ex.tabAporte") },
  ];

  const esRutas = seccion === "rutas";
  const subnav = esRutas ? seccionRutas : seccionComunidad;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="explorar-view">
      {sub !== "mapa" ? (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
          {/* Hero */}
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{t("ex.heroEyebrow")}</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground">{t("ex.heroTitulo")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("ex.heroSub")}</p>

          {/* Conmutador grande (mockup: switcher de 2 opciones) */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5" role="tablist" aria-label={t("ex.heroTitulo")}>
            {(
              [
                { id: "rutas" as Seccion, ico: <Route className="h-5 w-5" />, b: t("ex.swRutas"), small: t("ex.swRutasSub") },
                { id: "comunidad" as Seccion, ico: <Users className="h-5 w-5" />, b: t("ex.swComunidad"), small: t("ex.swComunidadSub") },
              ]
            ).map((sw) => (
              <button
                key={sw.id}
                role="tab"
                aria-selected={seccion === sw.id}
                data-testid={`ex-switch-${sw.id}`}
                onClick={() => {
                  setSeccion(sw.id);
                  onSub(sw.id === "rutas" ? "rutas" : "descubrir");
                }}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors ${
                  seccion === sw.id
                    ? "border-emerald-600/60 bg-emerald-600/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${seccion === sw.id ? "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400" : "bg-accent text-muted-foreground"}`}>
                  {sw.ico}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold">{sw.b}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{sw.small}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Subnav de la sección activa */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto border-b border-border pb-2.5" role="tablist" aria-label={esRutas ? t("ex.swRutas") : t("ex.swComunidad")}>
            {subnav.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                aria-selected={sub === tb.id}
                data-testid={`ex-tab-${tb.id}`}
                onClick={() => (tb.id === "mapa" ? irAlMapa() : onSub(tb.id))}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  sub === tb.id
                    ? "bg-emerald-600 text-white"
                    : "border border-border bg-card text-muted-foreground hover:border-emerald-500"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* Contenido de la subsección */}
          {esRutas && sub === "rutas" && (
            <section className="mt-4" data-testid="ex-contenido-rutas">
              <p className="text-[13px] text-muted-foreground">{t("ex.rutasSub")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatCard n={rutas.length} label={t("ex.statCreadas")} />
                <StatCard n={listaPublicadas.length} label={t("ex.statPublicadas")} />
                <StatCard n={listaBorradores.length} label={t("ex.statBorradores")} />
              </div>
              {rutas.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("ex.vacioRutas")}</p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {rutas.map((r) => (
                    <FilaRutaModulo
                      key={r.id}
                      r={r}
                      onEncuadrar={() => mapaConOrden({ tipo: "encuadrar", rutaLocal: r })}
                      onNavegar={() => mapaConOrden({ tipo: "navegar-ruta", rutaLocal: r })}
                      onEditar={r.status === "borrador" ? () => mapaConOrden({ tipo: "editar-borrador", rutaLocal: r }) : undefined}
                      onPublicar={r.status === "borrador" && !r.serverId ? () => mapaConOrden({ tipo: "publicar", rutaLocal: r }) : undefined}
                      onGpx={() => descargarGpx(r)}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => mapaConOrden({ tipo: "biblioteca", tabBiblioteca: "mias" })}
                  data-testid="ex-biblioteca"
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:border-emerald-500"
                >
                  {t("ex.bibAbierta")}
                </button>
                <button
                  onClick={() => mapaConOrden({ tipo: "trazar-ruta" })}
                  data-testid="ex-crear-ruta"
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  {t("ex.nuevaRuta")}
                </button>
              </div>
            </section>
          )}

          {esRutas && sub === "segmentos" && (
            <section className="mt-4" data-testid="ex-contenido-segmentos">
              <p className="text-[13px] text-muted-foreground">{t("ex.segSub")}</p>
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
            </section>
          )}

          {esRutas && sub === "crear" && (
            <section className="mt-4" data-testid="ex-contenido-crear">
              <p className="text-[13px] text-muted-foreground">{t("ex.crearSub")}</p>
              <div className="mt-3 grid gap-2.5">
                <CardCrear
                  ico={<PencilRuler className="h-5 w-5" />}
                  titulo={t("ex.crearDibujar")}
                  sub={t("ex.crearDibujarSub")}
                  cta={t("ex.crearComenzar")}
                  primario
                  onClick={() => mapaConOrden({ tipo: "trazar-ruta" })}
                />
                <CardCrear
                  ico={<Upload className="h-5 w-5" />}
                  titulo={t("ex.crearGpx")}
                  sub={t("ex.crearGpxSub")}
                  cta={t("ex.crearSeleccionar")}
                  onClick={() => mapaConOrden({ tipo: "importar-gpx" })}
                />
                <CardCrear
                  ico={<Activity className="h-5 w-5" />}
                  titulo={t("ex.crearActividad")}
                  sub={t("ex.crearActividadSub")}
                  cta={t("ex.crearElegir")}
                  onClick={() => mapaConOrden({ tipo: "actividades" })}
                  secundario={onGoHistorial}
                  secundarioLabel={t("menu.historial")}
                />
              </div>
            </section>
          )}

          {esRutas && sub === "guardados" && (
            <section className="mt-4" data-testid="ex-contenido-guardados">
              <p className="text-[13px] text-muted-foreground">{t("ex.guardadosSub")}</p>
              {favoritas === null ? (
                <p className="mt-5 text-center text-xs text-muted-foreground">{t("cat.cargando")}</p>
              ) : favoritas.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("ex.vacioGuardados")}</p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {favoritas.map((f) => (
                    <li key={f.id}>
                      <button
                        onClick={() => mapaConOrden({ tipo: "biblioteca", tabBiblioteca: "favoritas" })}
                        className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-left hover:border-emerald-500"
                        data-testid={`ex-favorita-${f.id}`}
                      >
                        <Heart className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">{f.nombre}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {f.creador} · {f.distKm.toFixed(1)} km{f.gainM != null ? ` · +${Math.round(f.gainM)} m` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!esRutas && sub === "descubrir" && (
            <section className="mt-4" data-testid="ex-contenido-descubrir">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 to-card p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{t("ex.descEyebrow")}</p>
                <h3 className="mt-1.5 max-w-[20rem] text-xl font-bold leading-tight text-foreground">{t("ex.descTitulo")}</h3>
                <p className="mt-1.5 max-w-[22rem] text-[13px] text-muted-foreground">{t("ex.descSub")}</p>
                <button
                  onClick={() => onSub("compartidas")}
                  data-testid="ex-desc-cta"
                  className="mt-3 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  {t("ex.descCta")}
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <MiniPanel titulo={t("ex.descCerca")} sub={t("ex.descCercaSub")} />
                <MiniPanel titulo={t("ex.descInspiracion")} sub={t("ex.descInspiracionSub")} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">{t("ex.descGustarte")}</h4>
                <button onClick={() => onSub("compartidas")} className="text-[11px] font-bold text-emerald-600 hover:underline dark:text-emerald-400">
                  {t("ex.descVerTodas")}
                </button>
              </div>
              {destacadas === null ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">{t("cat.cargando")}</p>
              ) : destacadas.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {destacadasNota ? t("ex.descVacio") : t("bib.vacioCatalogo")}
                </p>
              ) : (
                <ul className="mt-2.5 grid gap-2">
                  {destacadas.map((r) => (
                    <TarjetaPublica key={r.id} r={r} onVerEnMapa={() => mapaConOrden({ tipo: "ver-ruta", rutaPublica: r })} onIrAInicio={() => mapaConOrden({ tipo: "ir-inicio", rutaPublica: r })} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {!esRutas && sub === "compartidas" && (
            <section className="mt-4" data-testid="ex-contenido-compartidas">
              <p className="text-[13px] text-muted-foreground">{t("ex.compSub")}</p>
              <div className="mt-3">
                <CatalogoTab
                  activo
                  onVerEnMapa={(r) => mapaConOrden({ tipo: "ver-ruta", rutaPublica: r })}
                  onIrAInicio={(r) => mapaConOrden({ tipo: "ir-inicio", rutaPublica: r })}
                  fichaExterna={null}
                  onFichaCerrada={() => undefined}
                />
              </div>
            </section>
          )}

          {!esRutas && sub === "experiencias" && (
            <section className="mt-4" data-testid="ex-contenido-experiencias">
              <p className="text-[13px] text-muted-foreground">{t("ex.expSub")}</p>
              <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-center">
                <MessagesSquare className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <p className="mt-2 text-sm font-bold text-foreground">{t("ex.expVacioTitulo")}</p>
                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-snug text-muted-foreground">{t("ex.expVacioSub")}</p>
                <button
                  onClick={() => onSub("compartidas")}
                  className="mt-3 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  {t("ex.expVacioCta")}
                </button>
              </div>
            </section>
          )}

          {!esRutas && sub === "siguiendo" && (
            <section className="mt-4" data-testid="ex-contenido-siguiendo">
              <p className="text-[13px] text-muted-foreground">{t("ex.sigSub")}</p>
              <div className="mt-2">
                <AmigosTab />
              </div>
            </section>
          )}

          {!esRutas && sub === "aporte" && (
            <section className="mt-4" data-testid="ex-contenido-aporte">
              <p className="text-[13px] text-muted-foreground">{t("ex.apSub")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatCard n={listaPublicadas.length} label={t("ex.apStatPublicadas")} />
                <StatCard n={listaBorradores.length} label={t("ex.apStatBorradores")} />
                <StatCard n={favoritas?.length ?? 0} label={t("ex.apStatFavoritas")} />
              </div>
              {listaPublicadas.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("ex.apVacio")}</p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {listaPublicadas.map((r) => (
                    <FilaRutaModulo
                      key={r.id}
                      r={r}
                      onEncuadrar={() => mapaConOrden({ tipo: "encuadrar", rutaLocal: r })}
                      onNavegar={() => mapaConOrden({ tipo: "navegar-ruta", rutaLocal: r })}
                      onGpx={() => descargarGpx(r)}
                    />
                  ))}
                </ul>
              )}
              <button
                onClick={() => mapaConOrden({ tipo: "biblioteca", tabBiblioteca: "mias" })}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                {t("ex.apPublicar")}
              </button>
            </section>
          )}
        </div>
      ) : (
        /* «Explorar mapa»: el mapa completo como UNA subsección del
           módulo — compacto arriba, mapa llenando el resto. El wrapper
           es flex-column: MapView (flex-1, hijos absolutos) exige un
           padre flex para tomar la altura restante. */
        <div className="flex min-h-0 flex-1 flex-col" data-testid="ex-contenido-mapa">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{t("ex.heroEyebrow")}</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{t("ex.tabMapa")}</p>
            <p className="text-[11px] text-muted-foreground">{t("ex.mapaSub")}</p>
            {/* Conmutador compacto: desde el mapa también se puede
                saltar de sección sin abandonar el módulo. */}
            <div className="mt-2 flex gap-1.5">
              {(["rutas", "comunidad"] as Seccion[]).map((s) => (
                <button
                  key={s}
                  data-testid={`ex-switchm-${s}`}
                  onClick={() => {
                    setSeccion(s);
                    onSub(s === "rutas" ? "rutas" : "descubrir");
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    seccion === s
                      ? "bg-emerald-600 text-white"
                      : "border border-border bg-card text-muted-foreground hover:border-emerald-500"
                  }`}
                >
                  {s === "rutas" ? t("ex.swRutas") : t("ex.swComunidad")}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label={esRutas ? t("ex.swRutas") : t("ex.swComunidad")}>
              {subnav.map((tb) => (
                <button
                  key={tb.id}
                  role="tab"
                  aria-selected={sub === tb.id}
                  data-testid={`ex-tabmapa-${tb.id}`}
                  onClick={() => (tb.id === "mapa" ? irAlMapa() : onSub(tb.id))}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    sub === tb.id
                      ? "bg-emerald-600 text-white"
                      : "border border-border bg-card text-muted-foreground hover:border-emerald-500"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <MapView {...mapProps} orden={orden} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Caja de estadística (mockup: .stat). */
function StatCard({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <strong className="block text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{String(n).padStart(2, "0")}</strong>
      <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

/** Fila de ruta local con acciones cortas (navegar / editar / GPX). */
function FilaRutaModulo({
  r,
  onEncuadrar,
  onNavegar,
  onEditar,
  onPublicar,
  onGpx,
}: {
  r: RutaV2;
  onEncuadrar: () => void;
  onNavegar?: () => void;
  onEditar?: () => void;
  onPublicar?: () => void;
  onGpx?: () => void;
}) {
  const esBorrador = r.status === "borrador";
  return (
    <li className="rounded-xl border border-border bg-card px-2.5 py-2" data-testid={`ex-ruta-${r.id}`}>
      <div className="flex items-center gap-2">
        <MapIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
            <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${esBorrador ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"}`}>
              {esBorrador ? t("bib.badgeBorrador") : t("bib.badgeTrazada")}
            </span>
            {r.serverId && <span className="shrink-0 rounded bg-emerald-600/10 px-1 py-px text-[9px] font-bold text-emerald-700 dark:text-emerald-300">{t("pub.badgePublicada")}</span>}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {r.distKm.toFixed(1)} km{r.gainM != null ? ` · +${Math.round(r.gainM)} m` : ""}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {onNavegar && r.coords.length > 1 && <MiniBoton onClick={onNavegar}><Navigation className="mr-1 inline h-3 w-3" />{t("navf.navegar")}</MiniBoton>}
        <MiniBoton onClick={onEncuadrar}>{t("ex.verEnMapa")}</MiniBoton>
        {onEditar && <MiniBoton onClick={onEditar}>{t("bib.accEditar")}</MiniBoton>}
        {onPublicar && <MiniBoton onClick={onPublicar}>{t("pub.publicar")}</MiniBoton>}
        {onGpx && <MiniBoton onClick={onGpx}>GPX</MiniBoton>}
      </div>
    </li>
  );
}

/** Tarjeta de ruta pública del catálogo (descubrir): datos reales,
 *  dificultad con etiquetas y «ver en el mapa» (geometría protegida). */
function TarjetaPublica({ r, onVerEnMapa, onIrAInicio }: { r: RutaPublica; onVerEnMapa: () => void; onIrAInicio: () => void }) {
  return (
    <li className="rounded-xl border border-border bg-card px-2.5 py-2.5" data-testid={`ex-publica-${r.id}`}>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
        <span className="ml-auto shrink-0 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
          {t(r.modalidad === "mtb" ? "edi.modalidadMtb" : "edi.modalidadPavimento")}
        </span>
      </div>
      <p className="truncate text-[10px] text-muted-foreground">{r.creador}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {r.distKm.toFixed(1)} km{r.gainM != null ? ` · +${Math.round(r.gainM)} m` : ""}
        {" · "}
        {t("edi.difFisica")} {difEtiqueta(r.dificultadFisica)}
      </p>
      <div className="mt-1.5 flex gap-1.5">
        <MiniBoton onClick={onVerEnMapa} className="border-emerald-600/50 text-emerald-700 dark:text-emerald-300">
          {t("ex.verEnMapa")}
        </MiniBoton>
        {r.inicioAproxLat != null && r.inicioAproxLon != null && (
          <MiniBoton onClick={onIrAInicio}>{t("cat.irALlegar")}</MiniBoton>
        )}
      </div>
    </li>
  );
}

/** Tarjeta del modo «Crear» (mockup: 3 opciones). */
function CardCrear({
  ico,
  titulo,
  sub,
  cta,
  onClick,
  primario,
  secundario,
  secundarioLabel,
}: {
  ico: React.ReactNode;
  titulo: string;
  sub: string;
  cta: string;
  onClick: () => void;
  primario?: boolean;
  /** Acción secundaria honesta (p. ej. revisar rides en el Historial). */
  secundario?: () => void;
  secundarioLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">{ico}</span>
      <p className="mt-2 text-sm font-bold text-foreground">{titulo}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{sub}</p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onClick}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold ${primario ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-border bg-background text-foreground hover:border-emerald-500"}`}
        >
          {cta}
        </button>
        {secundario && secundarioLabel && (
          <button onClick={secundario} className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-muted-foreground hover:border-emerald-500 hover:text-foreground">
            {secundarioLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Mini panel informativo (mockup: .mini). */
function MiniPanel({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <p className="mt-1.5 text-xs font-bold text-foreground">{titulo}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Botón pequeño de acción (una fila puede llevar varios). */
function MiniBoton({ children, onClick, className, ariaLabel }: { children: React.ReactNode; onClick: () => void; className?: string; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-bold text-foreground hover:border-emerald-500 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** Icono de segmento (tramo) para la lista de Mis segmentos. */
function MilestoneIcon() {
  return <Bookmark className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
}

export default ExplorarView;
