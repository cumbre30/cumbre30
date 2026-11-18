"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  IdCard,
  Maximize2,
  QrCode,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { openExternal } from "@/lib/proConfig";
import { t, useLang } from "@/lib/i18n";

// ============================================================
// QR Pedalea Seguro (Parquemet)
// ------------------------------------------------------------
// El QR del programa Pedalea Seguro NO lo genera esta app: lo
// emite Parquemet al registrarte en pedaleaseguro.parquemet.cl
// (con ClaveÚnica o formulario manual) para ciclistas de
// montaña (MTB y enduro) que usan los senderos de tierra del
// parque. Es un elemento de seguridad médica que va pegado en
// la bicicleta y sirve ante emergencias y fiscalizaciones.
//
// Aquí el ciclista carga la imagen de ese QR (foto, captura o
// archivo) y la app la guarda en el teléfono para mostrarla
// incluso sin señal. 100% local: la imagen no sale del
// dispositivo y la app no gestiona ninguno de sus datos.
// Textos vía i18n (claves qr.*); los nombres propios del
// programa (Pedalea Seguro, Parquemet, ClaveÚnica) se mantienen.
// ============================================================

type EntryQr = { img: string; savedAt: string };

const QR_KEY = "cumbre30-entry-qr-v1";

function loadEntryQr(): EntryQr | null {
  try {
    const raw = localStorage.getItem(QR_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as EntryQr;
    if (p?.img) return { img: p.img, savedAt: p.savedAt || new Date().toISOString() };
  } catch {
    // sin QR guardado
  }
  return null;
}

/** Convierte la imagen elegida en un dataURL liviano (reduce a máx 1024 px). */
async function processQrImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read"));
    fr.readAsDataURL(file);
  });
  // PNG/WebP chico: se guarda tal cual (bordes del QR más nítidos).
  if (file.size < 400 * 1024 && /^image\/(png|webp)$/i.test(file.type)) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode"));
    im.src = dataUrl;
  });
  const max = 1024;
  const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || max) * scale));
  const h = Math.max(1, Math.round((img.height || max) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function Wallet() {
  const lang = useLang(); // re-render al cambiar el idioma
  // Locale de fecha según idioma (el QR solo existe en cliente,
  // así que esto no afecta el HTML del servidor).
  const loc = lang === "en" ? "en-US" : lang === "pt" ? "pt-BR" : "es-CL";
  const [entryQr, setEntryQr] = useState<EntryQr | null>(() => loadEntryQr());
  const [qrBusy, setQrBusy] = useState(false);
  // qrError guarda la CLAVE i18n (no el texto) para respetar el idioma activo.
  const [qrError, setQrError] = useState("");
  const [fullQr, setFullQr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pantalla completa del QR: mantiene la pantalla encendida
  // (en el APK usa el plugin keep-awake) y se cierra con Escape.
  useEffect(() => {
    if (!fullQr) return;
    try {
      void KeepAwake.keepAwake();
    } catch {
      // web: sin plugin
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullQr(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // El nombre correcto del plugin es allowSleep()
      // (allowSleepAgain no existe y fallaba en silencio).
      try {
        void KeepAwake.allowSleep();
      } catch {
        // web: sin plugin
      }
    };
  }, [fullQr]);

  const onPickFile = async (f: File | null) => {
    if (!f) return;
    setQrError("");
    if (!f.type.startsWith("image/")) {
      setQrError("qr.errNoImagen");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setQrError("qr.errGrande");
      return;
    }
    setQrBusy(true);
    try {
      const img = await processQrImage(f);
      const rec: EntryQr = { img, savedAt: new Date().toISOString() };
      localStorage.setItem(QR_KEY, JSON.stringify(rec));
      setEntryQr(rec);
    } catch {
      setQrError("qr.errProceso");
    } finally {
      setQrBusy(false);
    }
  };

  const removeQr = () => {
    localStorage.removeItem(QR_KEY);
    setEntryQr(null);
    setQrError("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---- QR Pedalea Seguro (Parquemet) ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <IdCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">QR Pedalea Seguro (Parquemet)</p>
            <p className="mt-1 leading-relaxed">{t("qr.intro")}</p>
          </div>
        </div>
      </Card>

      {/* ---- Fechas clave del programa ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("qr.fechasTitulo")}</p>
            <p className="mt-1 leading-relaxed">
              {t("qr.fechas1")}
              <span className="font-medium text-foreground">{t("qr.fecha1")}</span>
              {t("qr.fechas2")}
              <span className="font-medium text-foreground">{t("qr.fecha2")}</span>
              {t("qr.fechas3")}
            </p>
            <Button
              variant="outline"
              className="mt-3 border-border text-foreground/90 hover:bg-card"
              onClick={() => void openExternal("https://pedaleaseguro.parquemet.cl")}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> {t("qr.irRegistro")}
            </Button>
          </div>
        </div>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t("qr.inputAria")}
        onChange={(e) => {
          void onPickFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {!entryQr ? (
        <Card className="border-dashed border-border bg-card/60 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-muted p-3">
              <QrCode className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="font-medium text-foreground">{t("qr.sinQrTitulo")}</p>
            <p className="text-sm text-muted-foreground max-w-sm">{t("qr.sinQrSub")}</p>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={qrBusy}
              className="bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
            >
              <Upload className="h-4 w-4 mr-2" /> {qrBusy ? t("qr.procesando") : t("qr.cargar")}
            </Button>
            {qrError && <p className="text-sm text-red-600 dark:text-red-400">{t(qrError)}</p>}
          </div>
        </Card>
      ) : (
        <Card className="bg-background border-emerald-800/60 p-4">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setFullQr(true)}
              className="rounded-xl bg-white p-3 shadow transition-transform active:scale-[0.98]"
              aria-label={t("qr.ampliarAria")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entryQr.img} alt="QR Pedalea Seguro de Parquemet" className="h-56 w-56 object-contain" />
            </button>
            {/* C-05: la credencial la emite Parquemet; la app solo la guarda. */}
            <p className="text-center text-[11px] leading-snug text-muted-foreground/80 max-w-[20rem]">
              {t("qr.etiqueta")}
            </p>
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => setFullQr(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
              >
                <Maximize2 className="h-4 w-4 mr-2" /> {t("qr.pantallaCompleta")}
              </Button>
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={qrBusy}
                className="border-border text-foreground/90 hover:bg-card"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> {t("qr.cambiar")}
              </Button>
              <Button
                variant="outline"
                onClick={removeQr}
                aria-label={t("qr.eliminarAria")}
                className="border-border text-muted-foreground hover:bg-card"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {qrError && <p className="text-sm text-red-600 dark:text-red-400">{t(qrError)}</p>}
            {entryQr.savedAt && (
              <p className="text-[11px] text-muted-foreground/80">
                {t("qr.cargadoEl", new Date(entryQr.savedAt).toLocaleString(loc))}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ---- Pantalla completa del QR (para mostrarlo en fiscalización o emergencia) ---- */}
      {fullQr && entryQr && (
        <div
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center cursor-pointer select-none"
          onClick={() => setFullQr(false)}
          role="button"
          aria-label={t("qr.cerrarFullAria")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entryQr.img}
            alt="QR Pedalea Seguro de Parquemet"
            className="max-h-[80vh] max-w-[94vw] object-contain"
          />
          <p className="mt-5 px-6 text-center text-sm text-zinc-500">
            {t("qr.fullHint")}
          </p>
        </div>
      )}
    </div>
  );
}
