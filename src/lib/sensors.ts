// ============================================================
// Sensores Bluetooth - dos vías según el entorno:
//  · APK (Capacitor nativo): plugin @capacitor-community/bluetooth-le.
//    Bluetooth 100% nativo de Android: pide permisos, abre el selector
//    de dispositivos del sistema y empareja por GATT. No Web Bluetooth
//    (el WebView no lo implementa).
//  · Web (navegador): Web Bluetooth API (Chrome/Edge desktop y Android).
//    iOS Safari no la soporta → degradación elegante.
// Servicios: Pulso cardíaco (HRM 0x180D) y Velocidad de rueda (CSC 0x1816).
// ============================================================

import { Capacitor } from "@capacitor/core";

/** Circunferencia de rueda en metros (700×25c ≈ 2.105). Ajustable. */
export const WHEEL_CIRCUMFERENCE_M = 2.105;

// UUIDs BLE estándar (16 bits expandidos)
const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";
const CSC_SERVICE = "00001816-0000-1000-8000-00805f9b34fb";
const CSC_MEASUREMENT = "00002a5b-0000-1000-8000-00805f9b34fb";

/** true en el APK: BLE nativo de Android vía plugin. */
export function isNativeBle(): boolean {
  return Capacitor.isNativePlatform();
}

export function btSupported(): boolean {
  if (isNativeBle()) return true; // el plugin nativo viaja dentro del APK
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

// ---------- vía nativa (APK) ----------

/**
 * Flujo nativo común: 1) BleClient.initialize pide los permisos de
 * Bluetooth (Android 12+: BLUETOOTH_SCAN/CONNECT; el sistema muestra
 * el diálogo), 2) requestDevice abre el selector nativo filtrado por
 * servicio, 3) connect + startNotifications entrega las tramas GATT.
 */
async function connectNative(
  service: string,
  characteristic: string,
  onValue: (dv: DataView) => void,
  onDisconnect: () => void
): Promise<string> {
  const { BleClient } = await import("@capacitor-community/bluetooth-le");
  await BleClient.initialize({ androidNeverForLocation: true });
  const device = await BleClient.requestDevice({ services: [service] });
  await BleClient.connect(device.deviceId, onDisconnect);
  await BleClient.startNotifications(device.deviceId, service, characteristic, (value: DataView) =>
    onValue(value)
  );
  return device.name || "Sensor BLE";
}

// ---------- parsers GATT (comunes a ambas vías) ----------

/** Trama Heart Rate Measurement (0x2A37): flags + bpm (uint8 o uint16). */
function parseHrm(dv: DataView): number | null {
  const flags = dv.getUint8(0);
  const bpm = flags & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1);
  return bpm > 0 && bpm < 260 ? bpm : null;
}

/** Conecta un monitor de pulso y entrega los bpm por callback. */
export async function connectHeartRate(
  onBpm: (bpm: number) => void,
  onDisconnect: () => void
): Promise<string> {
  if (isNativeBle()) {
    return connectNative(
      HR_SERVICE,
      HR_MEASUREMENT,
      (dv) => {
        const bpm = parseHrm(dv);
        if (bpm !== null) onBpm(bpm);
      },
      onDisconnect
    );
  }
  const device = await webBt().requestDevice({ filters: [{ services: ["heart_rate"] }] });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("heart_rate");
  const ch = await svc.getCharacteristic("heart_rate_measurement");
  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", (e) => {
    const dv = e.target.value;
    if (!dv) return;
    const bpm = parseHrm(dv);
    if (bpm !== null) onBpm(bpm);
  });
  return device.name ?? "Sensor de pulso";
}

/**
 * Conecta un sensor de velocidad de rueda (CSC). La velocidad se
 * calcula con revoluciones acumuladas y tiempo de evento (1/1024 s):
 * sin el lag del GPS - ideal para la fiscalización del parque.
 */
export async function connectWheelSpeed(
  onSpeed: (kmh: number) => void,
  onDisconnect: () => void,
  circumferenceM: number = WHEEL_CIRCUMFERENCE_M
): Promise<string> {
  const onValue = (dv: DataView) => parseCsc(dv, circumferenceM, onSpeed);
  if (isNativeBle()) {
    return connectNative(CSC_SERVICE, CSC_MEASUREMENT, onValue, onDisconnect);
  }
  const device = await webBt().requestDevice({ filters: [{ services: ["cycling_speed_cadence"] }] });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("cycling_speed_cadence");
  const ch = await svc.getCharacteristic("csc_measurement");
  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", (e) => {
    const dv = e.target.value;
    if (dv) onValue(dv);
  });
  return device.name ?? "Sensor de velocidad";
}

/** Trama CSC Measurement (0x2A5B): revoluciones acumuladas + tiempo 1/1024 s. */
function parseCsc(dv: DataView, circumferenceM: number, onSpeed: (kmh: number) => void): void {
  // Estado por sensor: se guarda por característica; con un solo sensor
  // conectado a la vez es suficiente un módulo.
  const flags = dv.getUint8(0);
  let off = 1;
  if (flags & 0x01) {
    const cumRevs = dv.getUint32(off, true);
    off += 4;
    const evTime = dv.getUint16(off, true);
    if (cscLast.revs !== null && cscLast.time !== null) {
      let dRevs = cumRevs - cscLast.revs;
      if (dRevs < 0) dRevs += 0x100000000; // overflow de uint32
      let dT = evTime - cscLast.time;
      if (dT < 0) dT += 0x10000; // overflow de uint16
      if (dT > 0) {
        const mps = (dRevs * circumferenceM) / (dT / 1024);
        const kmh = mps * 3.6;
        if (kmh >= 0 && kmh < 130) onSpeed(kmh);
      }
    }
    cscLast.revs = cumRevs;
    cscLast.time = evTime;
  }
}

const cscLast: { revs: number | null; time: number | null } = { revs: null, time: null };

// ---------- vía web (Web Bluetooth) ----------

// --- Tipos mínimos de Web Bluetooth (no incluidos en lib.dom) ---
type BtValueEvent = { target: { value: DataView | null } };
interface BtCharacteristic {
  startNotifications(): Promise<BtCharacteristic>;
  addEventListener(type: "characteristicvaluechanged", cb: (e: BtValueEvent) => void): void;
}
interface BtService {
  getCharacteristic(uuid: string): Promise<BtCharacteristic>;
}
interface BtDevice {
  name?: string;
  gatt: {
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<BtService> }>;
  };
  addEventListener(type: "gattserverdisconnected", cb: () => void): void;
}
interface BtNavigator {
  bluetooth?: {
    requestDevice(opts: { filters: { services: string[] }[] }): Promise<BtDevice>;
  };
}

function webBt(): NonNullable<BtNavigator["bluetooth"]> {
  const b = (navigator as unknown as BtNavigator).bluetooth;
  if (!b) throw new Error("Web Bluetooth no está disponible en este navegador (iOS Safari no lo soporta).");
  return b;
}
