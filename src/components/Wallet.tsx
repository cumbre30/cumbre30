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
  const [entryQr, setEntryQr] = useState<EntryQr | null>(() => loadEntryQr());
  const [qrBusy, setQrBusy] = useState(false);
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
      setQrError("Ese archivo no es una imagen. Elige una foto o captura del QR.");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setQrError("La imagen es demasiado grande (máximo 12 MB).");
      return;
    }
    setQrBusy(true);
    try {
      const img = await processQrImage(f);
      const rec: EntryQr = { img, savedAt: new Date().toISOString() };
      localStorage.setItem(QR_KEY, JSON.stringify(rec));
      setEntryQr(rec);
    } catch {
      setQrError("No pudimos procesar la imagen. Intenta con otra.");
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
            <p className="mt-1 leading-relaxed">
              El registro Pedalea Seguro es para ciclistas de montaña (MTB y enduro) que usan los senderos de
              enduro habilitados del parque. Lo haces en pedaleaseguro.parquemet.cl -con ClaveÚnica o formulario
              manual- y ahí Parquemet te entrega tu QR y tu número de registro. Esta app no genera ni gestiona
              ese QR: solo te sirve para guardarlo y mostrarlo cuando lo pidan. La imagen se guarda solo en tu
              teléfono. Los ciclistas de ruta y recreativos quedan eximidos del registro QR.
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Fechas clave del programa ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Fechas del programa</p>
            <p className="mt-1 leading-relaxed">
              Marcha blanca desde el <span className="font-medium text-foreground">1 de diciembre de 2026</span>.
              Registro <span className="font-medium text-foreground">obligatorio desde el 15 de diciembre de 2026</span> para
              quien pedalee en los senderos de enduro habilitados: QR pegado en la bici. Los ciclistas de ruta y
              recreativos no necesitan QR, pero deben llevar casco y luces y respetar el límite de 30 km/h (el
              chaleco reflectante propuesto quedó descartado). La velocidad la fiscaliza Carabineros.
            </p>
            <Button
              variant="outline"
              className="mt-3 border-border text-foreground/90 hover:bg-card"
              onClick={() => void openExternal("https://pedaleaseguro.parquemet.cl")}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Ir al registro oficial
            </Button>
          </div>
        </div>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Cargar imagen del QR Pedalea Seguro"
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
            <p className="font-medium text-foreground">Aún no cargas tu QR Pedalea Seguro</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Regístrate en la web oficial, guarda la foto o captura del QR que te entrega y tócala aquí para
              llevarla siempre a mano - pegada en tu bici y en tu teléfono.
            </p>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={qrBusy}
              className="bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
            >
              <Upload className="h-4 w-4 mr-2" /> {qrBusy ? "Procesando…" : "Cargar mi QR"}
            </Button>
            {qrError && <p className="text-sm text-red-600 dark:text-red-400">{qrError}</p>}
          </div>
        </Card>
      ) : (
        <Card className="bg-background border-emerald-800/60 p-4">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setFullQr(true)}
              className="rounded-xl bg-white p-3 shadow transition-transform active:scale-[0.98]"
              aria-label="Ampliar QR Pedalea Seguro"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entryQr.img} alt="QR Pedalea Seguro de Parquemet" className="h-56 w-56 object-contain" />
            </button>
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => setFullQr(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold"
              >
                <Maximize2 className="h-4 w-4 mr-2" /> Pantalla completa
              </Button>
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={qrBusy}
                className="border-border text-foreground/90 hover:bg-card"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Cambiar
              </Button>
              <Button
                variant="outline"
                onClick={removeQr}
                aria-label="Eliminar QR cargado"
                className="border-border text-muted-foreground hover:bg-card"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {qrError && <p className="text-sm text-red-600 dark:text-red-400">{qrError}</p>}
            {entryQr.savedAt && (
              <p className="text-[11px] text-muted-foreground/80">
                Cargado el {new Date(entryQr.savedAt).toLocaleString("es-CL")}
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
          aria-label="Cerrar pantalla completa del QR"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entryQr.img}
            alt="QR Pedalea Seguro de Parquemet"
            className="max-h-[80vh] max-w-[94vw] object-contain"
          />
          <p className="mt-5 px-6 text-center text-sm text-zinc-500">
            Toca en cualquier parte para salir · la pantalla no se apaga
          </p>
        </div>
      )}
    </div>
  );
}
