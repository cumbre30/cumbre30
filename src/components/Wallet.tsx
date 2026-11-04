"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike as BikeIcon,
  ChevronDown,
  Droplets as BloodType,
  IdCard,
  Maximize2,
  Phone,
  QrCode,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { BIKE_SIZES, BIKE_TYPES } from "@/lib/bike";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";
import { refreshMe } from "@/hooks/useMe";

// ============================================================
// QR de ENTRADA de Parquemet
// ------------------------------------------------------------
// El QR oficial de ingreso al cerro NO lo genera esta app: lo
// emite Parquemet con tu ClaveÚnica en parquemet.cl. Aquí el
// ciclista carga la imagen de ese QR (foto, captura o archivo)
// y la app la guarda en el teléfono para mostrarla en el acceso,
// incluso sin señal. 100% local, no sale del dispositivo.
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

// ============================================================
// Ficha médica local (sirve en caso de accidente)
// ============================================================

type WalletData = {
  fullName: string;
  bloodType: string;
  allergies: string;
  emergencyName: string;
  emergencyPhone: string;
  bikeBrand: string;
  bikeType: string;
  bikeModel: string;
  bikeSize: string;
  bikeColor: string;
};

const KEY = "cumbre30-wallet-v1";

const EMPTY: WalletData = {
  fullName: "",
  bloodType: "",
  allergies: "",
  emergencyName: "",
  emergencyPhone: "",
  bikeBrand: "",
  bikeType: "",
  bikeModel: "",
  bikeSize: "",
  bikeColor: "",
};

type Stored = { data: WalletData; savedAt: string | null };

function loadWallet(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WalletData & { savedAt?: string };
      return { data: { ...EMPTY, ...parsed }, savedAt: parsed.savedAt ?? null };
    }
  } catch {
    // sin datos guardados
  }
  return { data: EMPTY, savedAt: null };
}

export default function Wallet() {
  const [stored, setStored] = useState<Stored>(() => loadWallet());
  const data = stored.data;
  const savedAt = stored.savedAt;

  const [entryQr, setEntryQr] = useState<EntryQr | null>(() => loadEntryQr());
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState("");
  const [fullQr, setFullQr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof WalletData) => (v: string) =>
    setStored((s) => ({ ...s, data: { ...s.data, [k]: v } }));

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

  const saveMedical = () => {
    const savedAtISO = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: savedAtISO }));
    setStored({ data, savedAt: savedAtISO });
  };

  const clearMedical = () => {
    localStorage.removeItem(KEY);
    setStored({ data: EMPTY, savedAt: null });
  };

  // Guarda los datos de la bici y los sincroniza al perfil
  // (offline en el APK, API en la web).
  const saveBike = useCallback(() => {
    const savedAtISO = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: savedAtISO }));
    setStored({ data, savedAt: savedAtISO });
    if (isOfflineMode()) {
      offlineUpdateProfile({
        bikeBrand: data.bikeBrand,
        bikeType: data.bikeType,
        bikeModel: data.bikeModel,
        bikeSize: data.bikeSize,
        bikeColor: data.bikeColor,
      });
      void refreshMe();
      return;
    }
    void fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bikeBrand: data.bikeBrand,
        bikeType: data.bikeType,
        bikeModel: data.bikeModel,
        bikeSize: data.bikeSize,
        bikeColor: data.bikeColor,
      }),
    }).then((r) => (r.ok ? refreshMe() : undefined)).catch(() => undefined);
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      {/* ---- QR de entrada Parquemet ---- */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <IdCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">QR de entrada (Parquemet)</p>
            <p className="mt-1 leading-relaxed">
              El QR oficial de ingreso lo emite Parquemet con tu ClaveÚnica en parquemet.cl — esta app no puede
              generarlo. Cárgalo aquí para presentarlo en los accesos (Pío Nono, Pedro de Valdivia Norte) sin
              depender de la señal. Se guarda solo en tu teléfono.
            </p>
          </div>
        </div>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Cargar imagen del QR de entrada"
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
            <p className="font-medium text-foreground">Aún no cargas tu QR de entrada</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Genera tu QR en la web de Parquemet y guárdalo como foto o captura. Después tócalo aquí para llevarlo
              siempre a mano.
            </p>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={qrBusy}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
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
              aria-label="Ampliar QR de entrada"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entryQr.img} alt="QR de entrada Parquemet" className="h-56 w-56 object-contain" />
            </button>
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => setFullQr(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
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

      {/* ---- Ficha médica de emergencia (desplegable) ---- */}
      <details className="group rounded-xl border border-border bg-card/80 p-4">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Ficha médica de emergencia</p>
            <p className="mt-1 leading-relaxed">
              Guarda tu información básica en el teléfono: si tienes un accidente, quienes te ayuden pueden verla
              aquí. No se comparte ni sale del dispositivo.
            </p>
          </div>
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="w-name" className="text-foreground/90">Nombre completo</Label>
            <Input id="w-name" className="bg-card border-border" placeholder="Ej: Camila Rojas Fuentes" value={data.fullName} onChange={(e) => set("fullName")(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-foreground/90">Tipo de sangre</Label>
            <Select value={data.bloodType} onValueChange={set("bloodType")}>
              <SelectTrigger className="bg-card border-border w-full" aria-label="Tipo de sangre">
                <SelectValue placeholder="Selecciona tu grupo sanguíneo" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "No lo sé"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="w-allergies" className="text-foreground/90">Alergias o condición médica</Label>
            <Input id="w-allergies" className="bg-card border-border" placeholder="Ej: alergia a penicilina, asmático" value={data.allergies} onChange={(e) => set("allergies")(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="w-emname" className="text-foreground/90">Contacto de emergencia</Label>
              <Input id="w-emname" className="bg-card border-border" placeholder="Nombre" value={data.emergencyName} onChange={(e) => set("emergencyName")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="w-emphone" className="text-foreground/90">Teléfono</Label>
              <Input id="w-emphone" className="bg-card border-border" type="tel" placeholder="+56 9 1234 5678" value={data.emergencyPhone} onChange={(e) => set("emergencyPhone")(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveMedical} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold">
              Guardar ficha
            </Button>
            {savedAt && (
              <Button
                variant="outline"
                onClick={clearMedical}
                aria-label="Borrar ficha médica"
                className="border-border text-muted-foreground hover:bg-card"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {savedAt && (
            <p className="text-[11px] text-muted-foreground/80">Guardada el {new Date(savedAt).toLocaleString("es-CL")}</p>
          )}
        </div>
      </details>

      {/* ---- Datos de la bicicleta (desplegable) ---- */}
      <details className="group rounded-xl border border-border bg-card/80 p-4">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
          <BikeIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Datos de tu bicicleta</p>
            <p className="mt-1 leading-relaxed">
              Registra tu bici para que aparezca en tu perfil y ayude a identificarla en caso de robo o accidente.
            </p>
          </div>
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="b-brand" className="text-foreground/90">Marca</Label>
              <Input id="b-brand" className="bg-card border-border" placeholder="Ej: Trek, Giant, Oxford" value={data.bikeBrand} onChange={(e) => set("bikeBrand")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-foreground/90">Tipo</Label>
              <Select value={data.bikeType} onValueChange={set("bikeType")}>
                <SelectTrigger className="bg-card border-border w-full" aria-label="Tipo de bicicleta">
                  <SelectValue placeholder="Ej: MTB" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {BIKE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="b-model" className="text-foreground/90">Modelo</Label>
              <Input id="b-model" className="bg-card border-border" placeholder="Ej: Marlin 7" value={data.bikeModel} onChange={(e) => set("bikeModel")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-foreground/90">Talla</Label>
              <Select value={data.bikeSize} onValueChange={set("bikeSize")}>
                <SelectTrigger className="bg-card border-border w-full" aria-label="Talla del cuadro">
                  <SelectValue placeholder="Talla del cuadro" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {BIKE_SIZES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-color" className="text-foreground/90">Color</Label>
            <Input id="b-color" className="bg-card border-border" placeholder="Ej: azul con negro" value={data.bikeColor} onChange={(e) => set("bikeColor")(e.target.value)} />
          </div>
          <Button onClick={saveBike} className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold">
            Guardar bicicleta
          </Button>
        </div>
      </details>

      {/* ---- Pantalla completa del QR (para el acceso) ---- */}
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
            alt="QR de entrada Parquemet"
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
