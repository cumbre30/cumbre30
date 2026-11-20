"use client";

// ============================================================
// Overlay del creador de trazados (v1.13.15). Vive sobre el mapa
// grande mientras el modo «Trazar ruta» / «Trazar segmento» está
// activo:
// · puntos: instrucción según el paso (1 tap → popup de opciones
//   para la ruta; 2 taps para el segmento) + carga de GPX.
// · calculando: espera del motor (grafo local u OSRM).
// · preview: la línea trazada en un minimapa (MinimapPreview),
//   distancia/desnivel, botón Guardar → pide el nombre y guarda.
// Textos vía i18n (claves tra.*).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Check, X, PenLine } from "lucide-react";
import { MinimapPreview } from "@/components/MinimapPreview";
import type { CreadorTrazas } from "@/hooks/useCreadorTrazas";
import type { LatLng } from "@/lib/routing";
import { t, useLang } from "@/lib/i18n";

export default function TrazadoOverlay({ ctrl, position }: { ctrl: CreadorTrazas; position: LatLng | null }) {
  useLang(); // re-render al cambiar el idioma
  const [nombre, setNombre] = useState("");
  const [pedirNombre, setPedirNombre] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pedirNombre) setTimeout(() => inputRef.current?.focus(), 60);
  }, [pedirNombre]);

  const confirmar = () => {
    const n = nombre.trim();
    if (!n) return;
    ctrl.guardar(n);
    setPedirNombre(false);
    setNombre("");
  };

  const { modo, picks, desdeAqui, fase, preview, err, aviso } = ctrl;
  if (!modo) return null;

  const esRuta = modo === "ruta";
  const chip = "rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300";
  const btnBase = "rounded-xl px-3.5 py-2 text-xs font-bold transition-colors";
  const btnPrimario = `${btnBase} bg-sky-500 text-zinc-950 hover:bg-sky-400`;
  const btnSecundario = `${btnBase} border border-border bg-background text-foreground hover:border-emerald-400`;
  const btnNeutro = `${btnBase} border border-border bg-card text-muted-foreground hover:border-red-400`;

  return (
    <>
      <div className="absolute top-[112px] inset-x-2 z-[760] rounded-lg bg-background/95 border border-sky-600/70 px-3 py-2.5 text-xs text-foreground shadow-md" data-testid="trazado-overlay">
        {fase === "calculando" && (
          <p className="flex items-center gap-2 font-semibold text-sky-600 dark:text-sky-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("tra.calculando")}
          </p>
        )}

        {fase === "puntos" && (
          <>
            <p className="font-semibold">{esRuta ? t("tra.tituloRuta") : t("tra.tituloSegmento")}</p>
            {esRuta && picks.length === 0 && <p className="mt-1 leading-snug text-muted-foreground">{t("tra.tocaPunto")}</p>}
            {/* Ruta «desde aquí»: primer punto fijado como inicio; se
                espera el tap del punto FINAL (sin re-mostrar opciones). */}
            {esRuta && picks.length === 1 && desdeAqui && (
              <p className="mt-1 leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground">{t("tra.desdeAquiEsperando")}</span>{" "}
                {picks[0].lat.toFixed(5)}, {picks[0].lon.toFixed(5)}
              </p>
            )}
            {esRuta && picks.length === 1 && !desdeAqui && (
              <div className="mt-1.5">
                <p className="leading-snug text-muted-foreground">
                  {t("tra.puntoElegido")} {picks[0].lat.toFixed(5)}, {picks[0].lon.toFixed(5)}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <button type="button" className={btnPrimario} onClick={() => ctrl.elegirHaciaAqui(position)} data-testid="tra-hacia-aqui">
                    {t("tra.haciaAqui")}
                  </button>
                  <button type="button" className={btnSecundario} onClick={ctrl.elegirDesdeAqui} data-testid="tra-desde-aqui">
                    {t("tra.desdeAqui")}
                  </button>
                </div>
                <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{t("tra.haciaAquiSub")}</p>
              </div>
            )}
            {!esRuta && (
              <>
                <p className="mt-1 leading-snug text-muted-foreground">
                  {picks.length === 0 ? t("tra.tocaInicio") : t("tra.tocaFin")}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={chip}>
                    {t("tra.inicio")} {picks.length > 0 ? "✔" : "…"}
                  </span>
                  <span className={chip}>
                    {t("tra.fin")} {picks.length > 1 ? "✔" : "…"}
                  </span>
                </p>
                <div className="mt-2">
                  <button type="button" className={btnSecundario} onClick={() => fileRef.current?.click()} data-testid="tra-gpx">
                    <Upload className="mr-1.5 inline h-3.5 w-3.5" />
                    {t("tra.cargarGpx")}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".gpx,application/gpx+xml,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) ctrl.subirGpx(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className={btnNeutro} onClick={ctrl.cancelar}>
                {t("tra.cancelar")}
              </button>
            </div>
          </>
        )}

        {fase === "preview" && preview && (
          <>
            <p className="font-semibold">{preview.kind === "ruta" ? t("tra.previewRuta") : t("tra.previewSegmento")}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className={chip}>{preview.distKm.toFixed(1)} km</span>
              {preview.gainM > 0 && <span className={chip}>+{preview.gainM} m</span>}
              <span className={chip}>{preview.origen === "gpx" ? "GPX" : t("tra.motor")}</span>
            </p>
            {aviso && <p className="mt-1 text-[10.5px] leading-snug text-amber-700 dark:text-amber-300">{aviso}</p>}
            {/* Vista previa en minimapa: mismo motor del minimapa real. */}
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <MinimapPreview style="plano" size="normal" heightClass="h-44" coords={preview.coords.map((c) => [c.lon, c.lat] as [number, number])} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className={btnPrimario} onClick={() => setPedirNombre(true)} data-testid="tra-guardar">
                <Check className="mr-1 inline h-3.5 w-3.5" /> {t("tra.guardar")}
              </button>
              <button type="button" className={btnNeutro} onClick={ctrl.cancelar}>
                {t("tra.descartar")}
              </button>
            </div>
          </>
        )}

        {err && (
          <p className="mt-1.5 font-semibold text-red-600 dark:text-red-400" role="alert">
            {err}
          </p>
        )}
      </div>

      {/* Diálogo del nombre (confirmación final del trazado). */}
      {pedirNombre && (
        <div className="fixed inset-0 z-[820] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("tra.nombreTitulo")}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-sidebar p-5 shadow-2xl">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              <PenLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {preview?.kind === "segmento" ? t("tra.nombreSegmento") : t("tra.nombreRuta")}
            </h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {preview ? `${preview.distKm.toFixed(1)} km${preview.gainM > 0 ? ` · +${preview.gainM} m` : ""}` : ""}
            </p>
            <input
              ref={inputRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
                if (e.key === "Escape") setPedirNombre(false);
              }}
              maxLength={60}
              placeholder={preview?.kind === "segmento" ? t("tra.nombrePhSeg") : t("tra.nombrePhRuta")}
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
              aria-label={t("tra.nombreTitulo")}
              data-testid="tra-nombre-input"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className={`${btnPrimario} flex-1 py-2.5`} onClick={confirmar} disabled={!nombre.trim()} data-testid="tra-confirmar">
                {t("tra.guardarDefinitivo")}
              </button>
              <button type="button" className={`${btnNeutro} py-2.5`} onClick={() => setPedirNombre(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
