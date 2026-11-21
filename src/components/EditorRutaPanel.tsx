"use client";

// ============================================================
// Panel del editor de rutas (fase B, módulo Rutas y Comunidad).
// Vive sobre el mapa grande mientras el editor está activo:
// · puntos: instrucción multi-waypoint + importar GPX + «Listo».
// · editando: formulario completo — nombre/descripción, dificultad
//   física y técnica (sugerencia orientativa editable, §5.2),
//   atributos recreativos (máx 3, §5.3), POIs (agregar en el mapa
//   o lista), elevación «sin datos» cuando es null (§5.1, jamás 0),
//   guardar borrador y exportar GPX.
// Textos vía i18n (claves edi.*).
// ============================================================

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Loader2, Upload, X, Plus, Download, MapPin, Trash2, PencilRuler } from "lucide-react";
import type { EditorRutas } from "@/hooks/useEditorRutas";
import { ATRIBUTOS_RECREATIVOS, ETIQUETAS_DIFICULTAD, MAX_ATRIBUTOS, type Dificultad } from "@/lib/dificultad";
import { TIPOS_POI, borradores } from "@/lib/rutasBorrador";
import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import { buildRutaGpxBlob } from "@/lib/gpx";
import { t, useLang } from "@/lib/i18n";

/** Descarga un Blob como archivo (mismo patrón que el GPX de rides). */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EditorRutaPanel({ ctrl }: { ctrl: EditorRutas }) {
  useLang(); // re-render al cambiar el idioma
  const [poiTipo, setPoiTipo] = useState<string>("mirador");
  const [poiNombre, setPoiNombre] = useState("");
  const [poiNota, setPoiNota] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const poiNombreRef = useRef<HTMLInputElement>(null);

  const { activo, fase, waypoints, coords, distKm, gainM, eleFuente, err, aviso, sugerencia, modoPoi, poiPendiente, pois, editandoId } = ctrl;

  useEffect(() => {
    if (poiPendiente) setTimeout(() => poiNombreRef.current?.focus(), 60);
  }, [poiPendiente]);

  if (!activo) return null;

  const btnBase = "rounded-xl px-3.5 py-2 text-xs font-bold transition-colors";
  const btnPrimario = `${btnBase} bg-violet-500 text-zinc-950 hover:bg-violet-400`;
  const btnSecundario = `${btnBase} border border-border bg-background text-foreground hover:border-violet-400`;
  const btnNeutro = `${btnBase} border border-border bg-card text-muted-foreground hover:border-red-400`;
  const inputCls = "w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-400 outline-none";

  const nombreGpx = (ctrl.nombre.trim() || "ruta-cumbre30").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ruta-cumbre30";

  const exportar = () => {
    if (coords.length < 2) return;
    descargar(buildRutaGpxBlob({ nombre: ctrl.nombre.trim() || "Ruta Cumbre30", descripcion: ctrl.descripcion, coords }), `${nombreGpx}.gpx`);
  };

  const toggleAttr = (a: string) => {
    const tiene = ctrl.attrs.includes(a);
    if (!tiene && ctrl.attrs.length >= MAX_ATRIBUTOS) return; // máximo 3 (§5.3)
    ctrl.setAttrs(tiene ? ctrl.attrs.filter((x) => x !== a) : [...ctrl.attrs, a]);
  };

  const guardar = () => ctrl.guardar();

  return (
    <>
      <div className="absolute top-[112px] inset-x-2 z-[760] rounded-lg bg-background/95 border border-violet-600/70 px-3 py-2.5 text-xs text-foreground shadow-md max-h-[70vh] overflow-y-auto" data-testid="editor-ruta-overlay">
        {fase === "calculando" && (
          <p className="flex items-center gap-2 font-semibold text-violet-600 dark:text-violet-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("tra.calculando")}
          </p>
        )}

        {fase === "puntos" && (
          <>
            <p className="font-semibold">{t("edi.titulo")}</p>
            <p className="mt-1 leading-snug text-muted-foreground">
              {waypoints.length === 0 ? t("edi.instrPrimero") : t("edi.instrSiguiente")}
            </p>
            {waypoints.length > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-foreground">
                {t("edi.waypoints", String(waypoints.length))} · {distKm.toFixed(1)} km
              </p>
            )}
            {err && <p className="mt-1.5 font-semibold text-red-500">{err}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className={btnPrimario} onClick={ctrl.listo} disabled={coords.length < 2} data-testid="edi-listo">
                {t("edi.listoEditar")}
              </button>
              <button type="button" className={btnSecundario} onClick={() => fileRef.current?.click()} data-testid="edi-gpx">
                <Upload className="mr-1 inline h-3.5 w-3.5" /> {t("tra.cargarGpx")}
              </button>
              <button type="button" className={btnNeutro} onClick={ctrl.cancelar} data-testid="edi-cancelar">
                {t("tra.cancelar")}
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".gpx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) ctrl.importarGpx(f); e.target.value = ""; }} />
          </>
        )}

        {fase === "editando" && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{editandoId ? t("edi.editando") : t("edi.tituloForm")}</p>
              <button type="button" onClick={ctrl.cancelar} aria-label={t("tra.cancelar")} className="text-muted-foreground hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Geometría: distancia + elevación (§5.1: null = sin datos) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{distKm.toFixed(1)} km</span>
              <span>·</span>
              {gainM != null ? (
                <span className="rounded bg-emerald-600/10 px-1.5 py-px font-bold text-emerald-700 dark:text-emerald-300">
                  +{Math.round(gainM)} m · {eleFuente === "gpx" ? "GPX" : ""}
                </span>
              ) : (
                <span className="rounded border border-border px-1.5 py-px font-bold text-muted-foreground">{t("edi.elevacionSinDatos")}</span>
              )}
            </div>

            {/* Nombre y descripción */}
            <div className="mt-2 grid gap-1.5">
              <input
                className={inputCls}
                value={ctrl.nombre}
                onChange={(e) => ctrl.setNombre(e.target.value)}
                placeholder={t("edi.placeholderNombre")}
                maxLength={80}
                data-testid="edi-nombre"
              />
              <textarea
                className={`${inputCls} min-h-[48px]`}
                value={ctrl.descripcion}
                onChange={(e) => ctrl.setDescripcion(e.target.value)}
                placeholder={t("edi.placeholderDesc")}
                maxLength={2000}
              />
            </div>

            {/* Dificultad física y técnica (§5.2): sugerencia editable */}
            <p className="mt-2.5 font-semibold">{t("edi.dificultadTitulo")}</p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {sugerencia.preliminar ? t("edi.sugerenciaPreliminar") : `${t("edi.sugerencia")}: ${t("edi.difFisica")} ${ETIQUETAS_DIFICULTAD[sugerencia.fisica]} · ${t("edi.difTecnica")} ${ETIQUETAS_DIFICULTAD[sugerencia.tecnica]}`}
              {ctrl.dificultadOrigen === "creador" && (
                <button type="button" onClick={ctrl.usarSugerencia} className="ml-1 underline text-violet-600 dark:text-violet-400">
                  {t("edi.usarSugerencia")}
                </button>
              )}
            </p>
            {(["fisica", "tecnica"] as const).map((escala) => (
              <div key={escala} className="mt-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">{escala === "fisica" ? t("edi.difFisica") : t("edi.difTecnica")}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {([1, 2, 3, 4, 5] as Dificultad[]).map((n) => {
                    const vigente = escala === "fisica" ? ctrl.dificultadFisica : ctrl.dificultadTecnica;
                    const sel = vigente === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => ctrl.ajustarDificultad(escala === "fisica" ? n : ctrl.dificultadFisica, escala === "tecnica" ? n : ctrl.dificultadTecnica)}
                        data-testid={`edi-dif-${escala}-${n}`}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold border transition-colors ${
                          sel ? "bg-violet-500 border-violet-400 text-zinc-950" : "border-border bg-card text-muted-foreground hover:border-violet-400"
                        }`}
                      >
                        {n} · {ETIQUETAS_DIFICULTAD[n]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Modalidad (pavimento/mtb) */}
            <p className="mt-2.5 font-semibold">{t("edi.modalidadTitulo")}</p>
            <div className="mt-1 flex gap-1.5">
              {(["pavimento", "mtb"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => ctrl.setModalidad(m)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-colors ${
                    ctrl.modalidad === m ? "bg-violet-500 border-violet-400 text-zinc-950" : "border-border bg-card text-muted-foreground hover:border-violet-400"
                  }`}
                >
                  {m === "pavimento" ? t("edi.modalidadPavimento") : t("edi.modalidadMtb")}
                </button>
              ))}
            </div>

            {/* Atributos recreativos (§5.3: máx 3, enumerado cerrado) */}
            <p className="mt-2.5 font-semibold">
              {t("edi.attrsTitulo")} <span className="text-[10px] font-normal text-muted-foreground">({ctrl.attrs.length}/{MAX_ATRIBUTOS})</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{t("edi.attrsNota")}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ATRIBUTOS_RECREATIVOS.map((a) => {
                const sel = ctrl.attrs.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAttr(a)}
                    data-testid={`edi-attr-${a}`}
                    className={`rounded-full px-2 py-1 text-[10px] font-bold border transition-colors ${
                      sel ? "bg-emerald-600/20 border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border-border bg-card text-muted-foreground hover:border-emerald-400"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>

            {/* POIs (tabla 4 RoutePoi, lado dispositivo) */}
            <p className="mt-2.5 font-semibold">{t("edi.poisTitulo")}</p>
            {pois.length === 0 && <p className="text-[10px] text-muted-foreground">{t("edi.poisVacio")}</p>}
            <ul className="mt-1 grid gap-1">
              {pois.map((p) => (
                <li key={p.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-foreground">{p.nombre} <span className="font-normal text-muted-foreground">· {p.tipo}</span></span>
                    {p.nota && <span className="block truncate text-[10px] text-muted-foreground">{p.nota}</span>}
                  </span>
                  <button type="button" onClick={() => ctrl.quitarPoi(p.id)} aria-label={t("edi.poiQuitar")} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {!poiPendiente && (
              <button type="button" onClick={ctrl.empezarPoi} className={`${btnSecundario} mt-1.5`} data-testid="edi-poi-agregar">
                <Plus className="mr-1 inline h-3.5 w-3.5" /> {t("edi.poisAgregar")}
              </button>
            )}
            {modoPoi && <p className="mt-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">{t("edi.poiTocaMapa")}</p>}
            {poiPendiente && (
              <div className="mt-1.5 rounded-lg border border-violet-600/50 bg-violet-500/5 px-2 py-2">
                <p className="text-[10px] font-semibold text-foreground">{t("edi.poiNuevo")} {poiPendiente.lat.toFixed(5)}, {poiPendiente.lon.toFixed(5)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TIPOS_POI.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setPoiTipo(tp)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${poiTipo === tp ? "bg-violet-500 border-violet-400 text-zinc-950" : "border-border bg-card text-muted-foreground"}`}
                    >
                      {t(`edi.poiTipo.${tp}`)}
                    </button>
                  ))}
                </div>
                <input ref={poiNombreRef} className={`${inputCls} mt-1.5`} value={poiNombre} onChange={(e) => setPoiNombre(e.target.value)} placeholder={t("edi.poiNombre")} maxLength={60} />
                <input className={`${inputCls} mt-1`} value={poiNota} onChange={(e) => setPoiNota(e.target.value)} placeholder={t("edi.poiNota")} maxLength={200} />
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="button"
                    className={btnPrimario}
                    disabled={!poiNombre.trim()}
                    onClick={() => {
                      ctrl.confirmarPoi({ tipo: poiTipo, nombre: poiNombre, nota: poiNota.trim() || undefined });
                      setPoiNombre("");
                      setPoiNota("");
                    }}
                    data-testid="edi-poi-confirmar"
                  >
                    {t("edi.poiConfirmar")}
                  </button>
                  <button type="button" className={btnNeutro} onClick={ctrl.descartarPoiPendiente}>
                    {t("edi.poiCancelar")}
                  </button>
                </div>
              </div>
            )}

            {aviso && <p className="mt-2 text-[10px] text-muted-foreground">{aviso}</p>}
            {err && <p className="mt-1.5 font-semibold text-red-500">{err}</p>}

            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5">
              <button type="button" className={btnPrimario} onClick={guardar} data-testid="edi-guardar">
                {t("edi.guardar")}
              </button>
              <button type="button" className={btnSecundario} onClick={exportar} data-testid="edi-exportar">
                <Download className="mr-1 inline h-3.5 w-3.5" /> GPX
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Lista de borradores guardados (c30.rutas-v2, status 'borrador')
 *  dentro del panel de capas: continuar edición, exportar GPX o
 *  eliminar. Autocontenida: se suscribe al store y se refresca sola. */
export function ListaBorradores({ onEditar }: { onEditar?: (id: string) => void }) {
  useLang();
  const [items, setItems] = useState<RutaV2[]>([]);
  useEffect(() => {
    const refrescar = () => setItems(borradores.listarBorradores());
    refrescar();
    const off = rutasStore.subscribe(refrescar);
    return off;
  }, []);
  const exportar = (r: RutaV2) => {
    const nombreGpx = (r.nombre || "ruta-cumbre30").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ruta-cumbre30";
    descargar(buildRutaGpxBlob({ nombre: r.nombre, descripcion: r.descripcion, coords: r.coords }), `${nombreGpx}.gpx`);
  };
  if (items.length === 0) return null;
  return (
    <details data-capa="borradores" className="border-b border-border/50 last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-1.5 py-2.5">
        <span aria-hidden className="text-[15px]">📝</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-foreground">{t("edi.borradoresTitulo")}</span>
            <span className="rounded-full bg-violet-600/10 px-1.5 py-px text-[9.5px] font-bold text-violet-700 dark:text-violet-300">{items.length}</span>
          </span>
          <span className="block truncate text-[10.5px] text-muted-foreground">{t("edi.borradoresSub")}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform details-chev" aria-hidden />
      </summary>
      <div className="px-1.5 pb-2.5">
        <ul>
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5 py-1.5">
              <span aria-hidden className="shrink-0 text-[13px]">🛣️</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground">{r.nombre}</span>
                  <span className="shrink-0 rounded bg-violet-500/15 px-1 py-px text-[9px] font-bold text-violet-700 dark:text-violet-300">{t("edi.badgeBorrador")}</span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {r.distKm.toFixed(1)} km{r.gainM != null ? ` · +${Math.round(r.gainM)} m` : ` · ${t("edi.elevacionSinDatos")}`}
                  {r.pois?.length ? ` · ${r.pois.length} POI` : ""}
                </span>
              </span>
              {onEditar && (
                <button
                  onClick={() => onEditar(r.id)}
                  aria-label={t("edi.continuar", r.nombre)}
                  title={t("edi.continuarTitle")}
                  className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-violet-500 hover:text-violet-600"
                  data-testid={`borrador-editar-${r.id}`}
                >
                  <PencilRuler className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => exportar(r)}
                aria-label={t("edi.exportarAria", r.nombre)}
                title={t("edi.exportarTitle")}
                className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                data-testid={`borrador-gpx-${r.id}`}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => rutasStore.remove(r.id)}
                aria-label={t("mapa.eliminar")}
                title={t("mapa.eliminar")}
                className="shrink-0 rounded border border-border px-1.5 py-1 text-muted-foreground hover:border-red-500 hover:text-red-600"
                data-testid={`borrador-borrar-${r.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
