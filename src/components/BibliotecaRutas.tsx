"use client";

// ============================================================
// Biblioteca de rutas y ficha completa (fase C del módulo Rutas y
// Comunidad, arquitectura v2.1 tabla 6 «C»). Overlay a pantalla
// completa sobre el mapa — la bottom-nav y el creador de trazados
// NO cambian de conducta (regresión §11.1 fase C).
//
// · Cuatro secciones navegables con identidad verde: Mis rutas
//   (borradores del editor + trazadas migradas de fase A), Catálogo
//   (público — llega en fase D), Favoritas (fase E) y Recientes
//   (fichas abiertas en este dispositivo).
// · Ficha completa: banner de vigencia en sus tres estados básicos
//   (§7.4), perfil altimétrico NUEVO con recharts que se renderiza
//   SOLO cuando hay elevación por punto (§5.1 — jamás con ceros),
//   chips recreativos con su leyenda orientativa (§5.3), dificultad,
//   tiempo estimado como rango ±25 % y POIs.
// · Acciones: encuadrar en el mapa, editar en el editor (fase B),
//   «revisé esta ruta hoy» (§7.4), exportar GPX y eliminar.
// Textos vía i18n (claves bib.*).
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, MapPin, PencilRuler, Trash2, X, BookOpen, RefreshCw, Eye } from "lucide-react";

import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import { borradores } from "@/lib/rutasBorrador";
import { buildRutaGpxBlob } from "@/lib/gpx";
import { estadoVigencia, formatearTiempo, tiempoEstimadoRango, recientes, type EstadoVigencia } from "@/lib/rutasFicha";
import CatalogoTab, { type BboxMapa } from "@/components/CatalogoTab";
import { ETIQUETAS_DIFICULTAD } from "@/lib/dificultad";
import { t, useLang } from "@/lib/i18n";

/** Descarga un Blob como archivo (mismo patrón que el GPX de rides). */
function descargarGpx(r: RutaV2): void {
  const nombreGpx = (r.nombre || "ruta-cumbre30").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ruta-cumbre30";
  const blob = buildRutaGpxBlob({ nombre: r.nombre, descripcion: r.descripcion, coords: r.coords, eleM: r.eleM });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreGpx}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "mias" | "catalogo" | "favoritas" | "recientes";

/** Snapshot de servidor ESTABLE (referencia única): un literal nuevo
 *  por llamada de getServerSnapshot dispara el aviso de
 *  useSyncExternalStore y una hidratación inestable. */
const SERVIDOR_VACIO: RutaV2[] = [];

/** Banner informativo de vigencia (§7.4) — los tres estados básicos
 *  + retirada. Los reportes nunca cambian la geometría: 'avisos'
 *  avisa con su número, sin tocar la ruta. */
export function BannerVigencia({ estado, avisos }: { estado: EstadoVigencia; avisos: number }) {
  const base = "rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5";
  if (estado === "vigente") {
    return <div className={`${base} bg-emerald-600/10 text-emerald-700 dark:text-emerald-300`} data-testid="vigencia-vigente">✓ {t("bib.bannerVigente")}</div>;
  }
  if (estado === "avisos") {
    return <div className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-300`} data-testid="vigencia-avisos">⚠ {t("bib.bannerAvisos", String(avisos))}</div>;
  }
  if (estado === "retirada") {
    return <div className={`${base} bg-red-500/10 text-red-700 dark:text-red-300`} data-testid="vigencia-retirada">{t("bib.bannerRetirada")}</div>;
  }
  return <div className={`${base} bg-zinc-500/10 text-zinc-600 dark:text-zinc-300`} data-testid="vigencia-sin-revisar">{t("bib.bannerSinRevisar")}</div>;
}

/** Perfil altimétrico NUEVO (recharts, instalada y sin uso): se
 *  renderiza SOLO cuando la ruta tiene elevación por punto con al
 *  menos dos valores — jamás con datos inventados (§5.1). */
export function PerfilAltimetrico({ r }: { r: RutaV2 }) {
  const datos = useMemo(() => {
    const ele = r.eleM;
    if (!ele || !r.coords.length || ele.length !== r.coords.length) return null;
    const n = ele.length;
    const validos = ele.filter((e) => e != null);
    if (validos.length < 2) return null;
    const distKm = r.distKm || 0;
    return ele
      .map((e, i) => ({ km: Number(((distKm * i) / Math.max(1, n - 1)).toFixed(2)), m: e }))
      .filter((p) => p.m != null) as { km: number; m: number }[];
  }, [r.eleM, r.coords.length, r.distKm]);
  if (!datos) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2" data-testid="perfil-altimetrico">
      <p className="text-[10px] font-bold text-muted-foreground">{t("bib.perfilTitulo")}</p>
      <div className="mt-1 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
            <XAxis dataKey="km" tick={{ fontSize: 9 }} unit=" km" minTickGap={28} />
            <YAxis tick={{ fontSize: 9 }} unit=" m" width={44} />
            <Tooltip
              formatter={(v: number | string) => [`${v} m`, t("bib.perfilElev")]}
              labelFormatter={(l: number | string) => `${l} km`}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="m" stroke="#059669" fill="#05966933" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Fila compacta de ruta en la lista de una sección. */
function FilaRuta({ r, onFicha, testid }: { r: RutaV2; onFicha: (id: string) => void; testid: string }) {
  const esBorrador = r.status === "borrador";
  return (
    <li>
      <button
        onClick={() => onFicha(r.id)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2 py-1.5 text-left hover:border-emerald-500"
        data-testid={testid}
      >
        <span aria-hidden className="shrink-0 text-[13px]">🛣️</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
            <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${esBorrador ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"}`}>
              {esBorrador ? t("bib.badgeBorrador") : t("bib.badgeTrazada")}
            </span>
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {r.distKm.toFixed(1)} km{r.gainM != null ? ` · +${Math.round(r.gainM)} m` : ` · ${t("bib.sinElev")}`}
            {r.pois?.length ? ` · ${r.pois.length} POI` : ""}
          </span>
        </span>
        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export default function BibliotecaRutas({
  abierto,
  onClose,
  onEditar,
  onEncuadrar,
  onPublicar,
  getBbox,
  onVerEnMapa,
  onIrAInicio,
}: {
  abierto: boolean;
  onClose: () => void;
  /** Abrir la ruta en el editor (fase B). */
  onEditar?: (id: string) => void;
  /** Encuadrar la geometría en el mapa y cerrar la biblioteca. */
  onEncuadrar?: (r: RutaV2) => void;
  /** Fase D — abrir la vista previa de publicación de un borrador. */
  onPublicar?: (id: string) => void;
  /** Fase D — bbox del mapa grande para el catálogo. */
  getBbox?: () => BboxMapa | null;
  /** Fase D — dibujar la geometría protegida de una ruta pública. */
  onVerEnMapa?: (r: import("@/lib/rutasApi").RutaPublica) => void;
  /** Fase D — «cómo llegar»: destino = inicio aproximado. */
  onIrAInicio?: (r: import("@/lib/rutasApi").RutaPublica) => void;
}) {
  useLang();
  const [tab, setTab] = useState<Tab>("mias");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [recientesTick, setRecientesTick] = useState(0);
  // Store reactivo (patrón useTrazas): snapshot estable entre escrituras.
  const rutas = useSyncExternalStore(rutasStore.subscribe, () => rutasStore.get(), () => SERVIDOR_VACIO);
  if (!abierto) return null;

  const listaBorradores = rutas.filter((r) => r.status === "borrador");
  const listaMigradas = rutas.filter((r) => r.status === undefined && r.migradaDe === "c30.trazas");
  const recientesIds = recientes.ver();
  const listaRecientes = recientesTick >= 0 ? recientesIds.map((id) => rutas.find((r) => r.id === id)).filter((r): r is RutaV2 => !!r) : [];

  const abrirFicha = (id: string) => {
    setFichaId(id);
    recientes.registrar(id);
    setRecientesTick((v) => v + 1);
  };
  const ficha = fichaId ? rutas.find((r) => r.id === fichaId) : null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "mias", label: t("bib.tabMias"), count: listaBorradores.length + listaMigradas.length },
    { id: "catalogo", label: t("bib.tabCatalogo") },
    { id: "favoritas", label: t("bib.tabFavoritas") },
    { id: "recientes", label: t("bib.tabRecientes"), count: listaRecientes.length },
  ];

  const filaTestid = (r: RutaV2) => (r.status === "borrador" ? `bib-borrador-${r.id}` : `bib-trazada-${r.id}`);

  // Portal a body: el ancestro del mapa crea un stacking context
  // (absolute z-0); sin el portal, header y bottom-nav de la app
  // pintan SIEMPRE por encima del overlay por más z-index que use.
  return createPortal(
    <div className="fixed inset-0 z-[900] flex flex-col bg-background/98 backdrop-blur" data-testid="biblioteca-rutas">
      {/* Cabecera con identidad verde */}
      <div className="flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2.5">
        <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{t("bib.titulo")}</p>
        <button onClick={onClose} aria-label={t("bib.cerrar")} className="rounded-lg border border-border px-2 py-1 text-muted-foreground hover:border-red-400 hover:text-red-500" data-testid="bib-cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Cuatro secciones navegables */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-card/60 px-3 py-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            data-testid={`bib-tab-${tb.id}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
              tab === tb.id ? "bg-emerald-600 text-white" : "border border-border bg-card text-muted-foreground hover:border-emerald-500"
            }`}
          >
            {tb.label}
            {tb.count !== undefined && <span className="ml-1 opacity-80">({tb.count})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 pb-16">
        {tab === "mias" && (
          <>
            {listaBorradores.length === 0 && listaMigradas.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">{t("bib.vacioMias")}</p>
            ) : (
              <>
                {listaBorradores.length > 0 && (
                  <>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("bib.grupoBorradores")}</p>
                    <ul className="mb-3 grid gap-1.5">
                      {listaBorradores.map((r) => (
                        <FilaRuta key={r.id} r={r} onFicha={abrirFicha} testid={filaTestid(r)} />
                      ))}
                    </ul>
                  </>
                )}
                {listaMigradas.length > 0 && (
                  <>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("bib.grupoTrazadas")}</p>
                    <ul className="grid gap-1.5">
                      {listaMigradas.map((r) => (
                        <FilaRuta key={r.id} r={r} onFicha={abrirFicha} testid={filaTestid(r)} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </>
        )}

        {tab === "catalogo" && (
          <CatalogoTab activo onVerEnMapa={(r) => { onVerEnMapa?.(r); onClose(); }} onIrAInicio={(r) => { onIrAInicio?.(r); onClose(); }} getBbox={getBbox} />
        )}

        {tab === "favoritas" && (
          <div className="mt-8 text-center">
            <p className="text-2xl" aria-hidden>💚</p>
            <p className="mt-2 text-xs font-bold text-foreground">{t("bib.vacioFavoritas")}</p>
            <p className="mx-auto mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">{t("bib.vacioFavoritasSub")}</p>
          </div>
        )}

        {tab === "recientes" && (
          <>
            {listaRecientes.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">{t("bib.vacioRecientes")}</p>
            ) : (
              <ul className="grid gap-1.5">
                {listaRecientes.map((r) => (
                  <FilaRuta key={r.id} r={r} onFicha={abrirFicha} testid={filaTestid(r)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Ficha completa (sheet inferior) */}
      {ficha && (
        <div className="absolute inset-0 z-[10] flex flex-col justify-end bg-black/40" onClick={() => setFichaId(null)}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()} data-testid="bib-ficha">
            <div className="mx-auto mb-2 h-1 w-10 rounded bg-border" aria-hidden />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-foreground">{ficha.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ficha.status === "borrador" ? t("bib.badgeBorrador") : t("bib.badgeTrazada")}
                  {ficha.serverId && <span className="ml-1 rounded bg-emerald-600/10 px-1 py-px text-[9px] font-bold text-emerald-700 dark:text-emerald-300">{t("pub.badgePublicada")}</span>}
                  {ficha.modalidad ? ` · ${t("bib.modalidad")} ${t(ficha.modalidad === "mtb" ? "edi.modalidadMtb" : "edi.modalidadPavimento")}` : ""}
                </p>
              </div>
              <button onClick={() => setFichaId(null)} aria-label={t("bib.cerrar")} className="rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:border-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Banner de vigencia (§7.4) */}
            <div className="mt-2.5">
              <BannerVigencia
                estado={estadoVigencia(ficha.ultimaRevisionAt ?? null, 0, ficha.status)}
                avisos={0}
              />
            </div>

            {/* Datos objetivos */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg border border-border bg-card px-1 py-1.5" data-testid="ficha-dist">
                <p className="text-[9px] font-bold text-muted-foreground">{t("bib.dist")}</p>
                <p className="text-xs font-bold text-foreground">{ficha.distKm.toFixed(1)} km</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-1 py-1.5" data-testid="ficha-elev">
                <p className="text-[9px] font-bold text-muted-foreground">{t("bib.elev")}</p>
                {ficha.gainM != null ? (
                  <p className="text-xs font-bold text-foreground">+{Math.round(ficha.gainM)} m</p>
                ) : (
                  <p className="text-xs font-bold text-muted-foreground">— {t("bib.sinElev")}</p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card px-1 py-1.5" data-testid="ficha-tiempo">
                <p className="text-[9px] font-bold text-muted-foreground">{t("bib.tiempo")}</p>
                {(() => {
                  const est = tiempoEstimadoRango(ficha.distKm, ficha.gainM);
                  return (
                    <p className="text-xs font-bold text-foreground" title={est.preliminar ? t("bib.tiempoPreliminarSub") : t("bib.tiempoSub")}>
                      {formatearTiempo(est.hMin)} – {formatearTiempo(est.hMax)}
                    </p>
                  );
                })()}
              </div>
            </div>
            <p className="mt-1 text-[9.5px] text-muted-foreground">{t("bib.tiempoLeyenda")}</p>

            {/* Perfil altimétrico: SOLO cuando hay elevación por punto */}
            <div className="mt-2.5">
              <PerfilAltimetrico r={ficha} />
            </div>

            {/* Dificultad */}
            {(ficha.dificultadFisica != null || ficha.dificultadTecnica != null) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ficha.dificultadFisica != null && (
                  <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300" data-testid="ficha-dif-fisica">
                    {t("edi.difFisica")}: {ficha.dificultadFisica} · {ETIQUETAS_DIFICULTAD[ficha.dificultadFisica]}
                  </span>
                )}
                {ficha.dificultadTecnica != null && (
                  <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300" data-testid="ficha-dif-tecnica">
                    {t("edi.difTecnica")}: {ficha.dificultadTecnica} · {ETIQUETAS_DIFICULTAD[ficha.dificultadTecnica]}
                  </span>
                )}
                {ficha.dificultadOrigen === "creador" && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{t("bib.difCreador")}</span>
                )}
              </div>
            )}

            {/* Chips recreativos con leyenda orientativa (§5.3) */}
            {ficha.attrs && ficha.attrs.length > 0 && (
              <div className="mt-2.5">
                <div className="flex flex-wrap gap-1.5" data-testid="ficha-attrs">
                  {ficha.attrs.map((a) => (
                    <span key={a} className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{a}</span>
                  ))}
                </div>
                <p className="mt-1 text-[9.5px] text-muted-foreground">{t("bib.attrsLeyenda")}</p>
              </div>
            )}

            {/* Descripción */}
            {ficha.descripcion && (
              <p className="mt-2.5 whitespace-pre-wrap text-[11px] leading-snug text-foreground/90">{ficha.descripcion}</p>
            )}

            {/* POIs */}
            {ficha.pois && ficha.pois.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[10px] font-bold text-muted-foreground">{t("bib.pois")} ({ficha.pois.length})</p>
                <ul className="mt-1 grid gap-1">
                  {ficha.pois.map((p) => (
                    <li key={p.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">
                          {p.nombre} <span className="font-normal text-muted-foreground">· {t(`edi.poiTipo.${p.tipo}`) || p.tipo}</span>
                        </span>
                        {p.nota && <span className="block truncate text-[10px] text-muted-foreground">{p.nota}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Acciones */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
              {onEncuadrar && (
                <button
                  onClick={() => { onEncuadrar(ficha); onClose(); }}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                  data-testid="ficha-encuadrar"
                >
                  {t("bib.accEncuadrar")}
                </button>
              )}
              {ficha.status === "borrador" && onEditar && (
                <button
                  onClick={() => { onEditar(ficha.id); onClose(); }}
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-violet-400"
                  data-testid="ficha-editar"
                >
                  <PencilRuler className="mr-1 inline h-3.5 w-3.5" /> {t("bib.accEditar")}
                </button>
              )}
              {ficha.status === "borrador" && onPublicar && !ficha.serverId && (
                <button
                  onClick={() => { onPublicar(ficha.id); onClose(); }}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                  data-testid="ficha-publicar"
                >
                  {t("pub.publicar")}
                </button>
              )}
              {ficha.status === "borrador" && (
                <button
                  onClick={() => { borradores.actualizarBorrador(ficha.id, { ultimaRevisionAt: new Date().toISOString() }); }}
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-400"
                  data-testid="ficha-revisar"
                  title={t("bib.revisarHoyTitle")}
                >
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> {t("bib.revisarHoy")}
                </button>
              )}
              <button
                onClick={() => descargarGpx(ficha)}
                className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-emerald-400"
                data-testid="ficha-gpx"
              >
                <Download className="mr-1 inline h-3.5 w-3.5" /> GPX
              </button>
              {ficha.status === "borrador" && (
                <button
                  onClick={() => { rutasStore.remove(ficha.id); setFichaId(null); }}
                  className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:border-red-400 hover:text-red-500"
                  data-testid="ficha-eliminar"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" /> {t("bib.accEliminar")}
                </button>
              )}
            </div>
            {recientesIds.includes(ficha.id) && (
              <button onClick={() => { recientes.quitar(ficha.id); setRecientesTick((v) => v + 1); }} className="mt-2 text-[10px] text-muted-foreground underline">
                {t("bib.quitarRecientes")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Botón de acceso a la biblioteca para la cabecera de la sección de
 *  borradores en el panel de capas (identidad verde). */
export function BotonBiblioteca({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  useLang();
  return (
    <button
      onClick={(e) => onClick(e)}
      aria-label={t("bib.titulo")}
      title={t("bib.abrirTitle")}
      className="shrink-0 rounded border border-emerald-600/40 bg-emerald-600/10 px-1.5 py-1 text-emerald-700 hover:border-emerald-500 dark:text-emerald-300"
      data-testid="btn-biblioteca"
    >
      <BookOpen className="h-3.5 w-3.5" />
    </button>
  );
}
