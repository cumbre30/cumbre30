"use client";

// ============================================================
// CATÁLOGO público (fase D): lista del servidor por viewport con
// búsqueda y filtros (la consulta corre en columnas bbox/celdas —
// nunca decodifica polilíneas). Cada resultado abre su ficha
// pública: geometría PROTEGIDA, extremos como zona aproximada,
// creador, versión, vigencia del servidor y acciones: ver en el
// mapa, cómo llegar (destino = inicio aproximado) y GPX protegido.
// Sin sesión o sin red: mensaje honesto.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { Download, MapPin, Navigation, RefreshCw, Search } from "lucide-react";
import { catalogoRutas, detalleRuta, type RutaPublica, type RespuestaDetalle } from "@/lib/rutasApi";
import { polylineDecode } from "@/lib/routeGeo";
import { buildRutaGpxBlob } from "@/lib/gpx";
import { ETIQUETAS_DIFICULTAD } from "@/lib/dificultad";
import ComunidadTab from "@/components/ComunidadTab";
import { t, useLang } from "@/lib/i18n";

export type BboxMapa = { n: number; s: number; e: number; o: number };

/** Descarga el GPX PROTEGIDO de una ruta pública (CT-P4: lo único
 *  que se exporta de una ruta pública es la geometría protegida). */
function descargarGpxPublico(r: { nombre: string; coords: { lat: number; lon: number }[] }): void {
  const nombreGpx = (r.nombre || "ruta-cumbre30").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ruta-cumbre30";
  const blob = buildRutaGpxBlob({ nombre: r.nombre, coords: r.coords });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreGpx}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CatalogoTab({
  activo,
  getBbox,
  onVerEnMapa,
  onIrAInicio,
  fichaExterna,
  onFichaCerrada,
}: {
  activo: boolean;
  getBbox?: () => BboxMapa | null;
  onVerEnMapa?: (r: RutaPublica) => void;
  onIrAInicio?: (r: RutaPublica) => void;
  /** Fase E: el tab Favoritas abre aquí la ficha de una ruta ajena. */
  fichaExterna?: string | null;
  onFichaCerrada?: () => void;
}) {
  useLang();
  const [q, setQ] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [dif, setDif] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rutas, setRutas] = useState<RutaPublica[]>([]);
  const [notaBbox, setNotaBbox] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<(RespuestaDetalle & { ok: true })["route"] | null>(null);
  const [fichaError, setFichaError] = useState<string | null>(null);
  const [buscadas, setBuscadas] = useState(0);

  const buscar = useCallback(async () => {
    const bbox = getBbox?.();
    if (!bbox) return; // sin viewport no se consulta (el botón avisa)
    setCargando(true);
    setError(null);
    const r = await catalogoRutas({
      ...bbox,
      q: q.trim() || undefined,
      modalidad: modalidad || undefined,
      dif: dif ? Number(dif) : undefined,
      take: 25,
    });
    setCargando(false);
    if (r.ok) {
      setRutas(r.routes);
      setNotaBbox(r.notaBbox);
      setBuscadas((v) => v + 1);
    } else {
      setError(r.error);
    }
  }, [getBbox, q, modalidad, dif]);

  // Primera búsqueda al activar el tab (con el bbox del mapa). Diferida
  // al siguiente tick: el efecto no marca estado de forma síncrona.
  useEffect(() => {
    if (!activo || buscadas > 0 || !getBbox?.()) return;
    const id = setTimeout(() => void buscar(), 0);
    return () => clearTimeout(id);
  }, [activo, buscadas, buscar, getBbox]);

  const abrirFicha = useCallback(async (id: string) => {
    setFichaId(id);
    setFicha(null);
    setFichaError(null);
    const r = await detalleRuta(id);
    if (r.ok) setFicha(r.route);
    else setFichaError(r.error);
  }, []);

  // Ficha pedida desde otro tab (Favoritas): se abre igual aquí y la
  // hoja vive en este componente aunque el tab no esté activo. Diferida
  // al siguiente tick (el efecto no marca estado de forma síncrona).
  useEffect(() => {
    if (!fichaExterna || fichaId === fichaExterna) return;
    const id = setTimeout(() => void abrirFicha(fichaExterna), 0);
    return () => clearTimeout(id);
  }, [fichaExterna, fichaId, abrirFicha]);
  const cerrarFicha = () => { setFichaId(null); onFichaCerrada?.(); };

  if (!activo && !fichaExterna) return null;

  return (
    <div data-testid="catalogo-tab">
      {activo && (<>
      {/* Búsqueda y filtros */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
            placeholder={t("cat.buscar")}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
            data-testid="cat-q"
          />
        </div>
        <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className="rounded-xl border border-border bg-card px-2 py-1.5 text-xs text-foreground" data-testid="cat-modalidad">
          <option value="">{t("cat.todas")}</option>
          <option value="urbana">{t("cat.urbana")}</option>
          <option value="montana">{t("cat.montana")}</option>
          <option value="mixta">{t("cat.mixta")}</option>
        </select>
        <select value={dif} onChange={(e) => setDif(e.target.value)} className="rounded-xl border border-border bg-card px-2 py-1.5 text-xs text-foreground" data-testid="cat-dif">
          <option value="">{t("cat.difTodas")}</option>
          <option value="2">≥ {t("cat.dif2")}</option>
          <option value="3">≥ {t("cat.dif3")}</option>
          <option value="4">≥ {t("cat.dif4")}</option>
        </select>
        <button
          onClick={() => { const b = getBbox?.(); if (!b) { setError(t("cat.sinViewport")); return; } void buscar(); }}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
          data-testid="cat-buscar"
        >
          <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />{t("cat.buscarBtn")}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300" data-testid="cat-error">{error}</p>}

      {notaBbox && rutas.length > 0 && <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground">{notaBbox}</p>}

      {/* Resultados */}
      {rutas.length === 0 && !error && !cargando && (
        <p className="mt-6 text-center text-xs text-muted-foreground" data-testid="cat-vacio">{t("cat.vacio")}</p>
      )}
      <ul className="mt-2 grid gap-1.5">
        {rutas.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => void abrirFicha(r.id)}
              className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2 py-1.5 text-left hover:border-emerald-500"
              data-testid={`cat-ruta-${r.id}`}
            >
              <span aria-hidden className="shrink-0 text-[13px]">🗺️</span>
              <span className="min-w-0 flex-1">
                <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {r.creador} · v{r.version} · {r.distKm.toFixed(1)} km{r.gainM != null ? ` · +${Math.round(r.gainM)} m` : ""} · {t(`cat.mod.${r.modalidad}`)}
                </span>
              </span>
              <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${r.estadoVigencia === "vigente" ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : r.estadoVigencia === "avisos" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"}`}>
                {r.estadoVigencia === "vigente" ? t("cat.vigente") : r.estadoVigencia === "avisos" ? t("cat.avisos") : t("cat.sinRevisar")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      </>)}

      {/* Ficha pública (sheet) */}
      {fichaId && (
        <div className="absolute inset-0 z-[10] flex flex-col justify-end bg-black/40" onClick={cerrarFicha}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()} data-testid="cat-ficha">
            <div className="mx-auto mb-2 h-1 w-10 rounded bg-border" aria-hidden />
            {fichaError && <p className="text-[11px] text-amber-700 dark:text-amber-300">{fichaError}</p>}
            {ficha ? (
              <>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-foreground">{ficha.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("cat.por")} {ficha.creador ?? ""} · v{ficha.version} · {t(`cat.mod.${ficha.modalidad}`)}
                    </p>
                  </div>
                  <button onClick={cerrarFicha} aria-label={t("bib.cerrar")} className="rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:border-red-400">✕</button>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{t("cat.geometriaProtegida")}</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg border border-border bg-card px-1 py-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground">{t("bib.dist")}</p>
                    <p className="text-xs font-bold text-foreground">{ficha.distKm.toFixed(1)} km</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-1 py-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground">{t("bib.elev")}</p>
                    {ficha.gainM != null ? <p className="text-xs font-bold text-foreground">+{Math.round(ficha.gainM)} m</p> : <p className="text-xs font-bold text-muted-foreground">— {t("bib.sinElev")}</p>}
                  </div>
                  <div className="rounded-lg border border-border bg-card px-1 py-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground">{t("cat.vigencia")}</p>
                    <p className="text-xs font-bold text-foreground">{ficha.estadoVigencia === "vigente" ? t("cat.vigente") : ficha.estadoVigencia === "avisos" ? t("cat.avisos") : t("cat.sinRevisar")}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ficha.dificultadFisica != null && (
                    <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      {t("edi.difFisica")}: {ficha.dificultadFisica} · {ETIQUETAS_DIFICULTAD[Math.min(5, Math.max(1, ficha.dificultadFisica))]}
                    </span>
                  )}
                  {ficha.dificultadTecnica != null && (
                    <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      {t("edi.difTecnica")}: {ficha.dificultadTecnica} · {ETIQUETAS_DIFICULTAD[Math.min(5, Math.max(1, ficha.dificultadTecnica))]}
                    </span>
                  )}
                  {(ficha.attrs ?? []).map((a) => (
                    <span key={a} className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{t(`cat.attr.${a}`)}</span>
                  ))}
                </div>
                {ficha.descripcion && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-foreground/90">{ficha.descripcion}</p>}
                {ficha.pois?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-muted-foreground">{t("bib.pois")} ({ficha.pois.length})</p>
                    <ul className="mt-1 grid gap-1">
                      {ficha.pois.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">{p.nombre}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  {onVerEnMapa && (
                    <button onClick={() => { onVerEnMapa(ficha); setFichaId(null); }} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500" data-testid="catficha-vermapa">
                      {t("bib.accEncuadrar")}
                    </button>
                  )}
                  {onIrAInicio && ficha.inicioAproxLat != null && ficha.inicioAproxLon != null && (
                    <button onClick={() => { onIrAInicio(ficha); setFichaId(null); }} className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-400" data-testid="catficha-irllegar">
                      <Navigation className="mr-1 inline h-3.5 w-3.5" />{t("cat.irALlegar")}
                    </button>
                  )}
                  <button
                    onClick={() => descargarGpxPublico({ nombre: ficha.nombre, coords: polylineDecode(ficha.polyline) })}
                    className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-400"
                    data-testid="catficha-gpx"
                  >
                    <Download className="mr-1 inline h-3.5 w-3.5" /> GPX
                  </button>
                </div>
                <p className="mt-1.5 text-[9.5px] text-muted-foreground">{t("cat.gpxNota")}</p>
                {ficha.comunidad && (
                  <ComunidadTab rutaId={ficha.id} datos={ficha.comunidad} />
                )}
              </>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("cat.cargando")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
