"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Droplets as BloodType, IdCard, RefreshCw, QrCode, Trash2, UserRound, Phone, Bike as BikeIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCode from "qrcode";
import { BIKE_SIZES, BIKE_TYPES } from "@/lib/bike";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";
import { refreshMe } from "@/hooks/useMe";

type WalletData = {
  fullName: string;
  enrollmentId: string;
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
  enrollmentId: "",
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

/** QR dibujado en canvas (sin setState en efectos). */
function QrCanvas({ data }: { data: WalletData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, JSON.stringify(data), {
      width: 420,
      margin: 1,
      color: { dark: "#09090b", light: "#f4f4f5" },
    }).catch(() => {
      // QR no generado
    });
  }, [data]);
  return (
    <canvas
      ref={ref}
      className="rounded-lg border-4 border-zinc-100 h-52 w-52"
      role="img"
      aria-label="Código QR de enrolamiento del ciclista"
    />
  );
}

export default function Wallet() {
  const [stored, setStored] = useState<Stored>(() => loadWallet());
  const data = stored.data;
  const savedAt = stored.savedAt;
  const showQr = Boolean(savedAt && data.fullName);

  const set = (k: keyof WalletData) => (v: string) =>
    setStored((s) => ({ ...s, data: { ...s.data, [k]: v } }));

  const save = useCallback(() => {
    const savedAtISO = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: savedAtISO }));
    setStored({ data, savedAt: savedAtISO });
    // Sincroniza la bici al perfil si hay sesión (silencioso).
    // APK: guarda directo en el perfil local (offline).
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

  const clear = () => {
    localStorage.removeItem(KEY);
    setStored({ data: EMPTY, savedAt: null });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <IdCard className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Credencial digital de enrolamiento</p>
            <p className="mt-1 leading-relaxed">
              Parquemet exige registro previo y un código identificador para circular en bicicleta por el cerro.
              Guarda aquí tu ficha y preséntala como QR en los accesos (Pío Nono, Pedro de Valdivia Norte).
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="w-name" className="text-zinc-300">Nombre completo</Label>
          <Input id="w-name" className="bg-zinc-900 border-zinc-800" placeholder="Ej: Camila Rojas Fuentes" value={data.fullName} onChange={(e) => set("fullName")(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-id" className="text-zinc-300">N° de enrolamiento Parquemet (si tienes)</Label>
          <Input id="w-id" className="bg-zinc-900 border-zinc-800" placeholder="Ej: PM-2026-012345" value={data.enrollmentId} onChange={(e) => set("enrollmentId")(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-zinc-300">Tipo de sangre</Label>
          <Select value={data.bloodType} onValueChange={set("bloodType")}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800 w-full" aria-label="Tipo de sangre">
              <SelectValue placeholder="Selecciona tu grupo sanguíneo" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "No lo sé"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-allergies" className="text-zinc-300">Alergias o condición médica</Label>
          <Input id="w-allergies" className="bg-zinc-900 border-zinc-800" placeholder="Ej: alergia a penicilina, asmático" value={data.allergies} onChange={(e) => set("allergies")(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="w-emname" className="text-zinc-300">Contacto de emergencia</Label>
            <Input id="w-emname" className="bg-zinc-900 border-zinc-800" placeholder="Nombre" value={data.emergencyName} onChange={(e) => set("emergencyName")(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="w-emphone" className="text-zinc-300">Teléfono</Label>
            <Input id="w-emphone" className="bg-zinc-900 border-zinc-800" type="tel" placeholder="+56 9 1234 5678" value={data.emergencyPhone} onChange={(e) => set("emergencyPhone")(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold" disabled={!data.fullName.trim()}>
          <QrCode className="h-4 w-4 mr-2" /> Generar / actualizar QR
        </Button>
        {showQr && (
          <Button variant="outline" onClick={clear} className="border-zinc-800 text-zinc-400 hover:bg-zinc-900" aria-label="Borrar ficha">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ---- Datos de la bicicleta ---- */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3 mb-3">
          <BikeIcon className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Datos de tu bicicleta</p>
            <p className="mt-1 leading-relaxed">
              Registra tu bici para que aparezca en tu perfil y ayude a identificarla en caso de robo o accidente.
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="b-brand" className="text-zinc-300">Marca</Label>
              <Input id="b-brand" className="bg-zinc-900 border-zinc-800" placeholder="Ej: Trek, Giant, Oxford" value={data.bikeBrand} onChange={(e) => set("bikeBrand")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-zinc-300">Tipo</Label>
              <Select value={data.bikeType} onValueChange={set("bikeType")}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 w-full" aria-label="Tipo de bicicleta">
                  <SelectValue placeholder="Ej: MTB" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {BIKE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="b-model" className="text-zinc-300">Modelo</Label>
              <Input id="b-model" className="bg-zinc-900 border-zinc-800" placeholder="Ej: Marlin 7" value={data.bikeModel} onChange={(e) => set("bikeModel")(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-zinc-300">Talla</Label>
              <Select value={data.bikeSize} onValueChange={set("bikeSize")}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 w-full" aria-label="Talla del cuadro">
                  <SelectValue placeholder="Talla del cuadro" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {BIKE_SIZES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-color" className="text-zinc-300">Color</Label>
            <Input id="b-color" className="bg-zinc-900 border-zinc-800" placeholder="Ej: azul con negro" value={data.bikeColor} onChange={(e) => set("bikeColor")(e.target.value)} />
          </div>
        </div>
      </Card>

      {showQr && (
        <Card className="bg-zinc-950 border-emerald-800/60 p-4">
          <div className="flex flex-col items-center gap-3">
            <QrCanvas data={data} />
            <div className="text-center">
              <div className="font-semibold text-zinc-100 flex items-center justify-center gap-2">
                <UserRound className="h-4 w-4 text-emerald-400" /> {data.fullName || "—"}
              </div>
              <div className="mt-1 flex items-center justify-center gap-3 text-sm text-zinc-400">
                {data.bloodType && (
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-red-300">
                    <BloodType className="h-3.5 w-3.5" /> {data.bloodType}
                  </span>
                )}
                {data.emergencyPhone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {data.emergencyPhone}
                  </span>
                )}
              </div>
              {data.enrollmentId && <div className="mt-1 font-mono text-xs text-zinc-500">{data.enrollmentId}</div>}
              {savedAt && (
                <div className="mt-2 text-[11px] text-zinc-600 flex items-center justify-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Guardada el {new Date(savedAt).toLocaleString("es-CL")}
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-xs">
              Presenta este QR al personal de Parquemet en los accesos. Incluye tu información médica básica para
              asistencia en caso de accidente.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
