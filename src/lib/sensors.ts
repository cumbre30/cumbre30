// ============================================================
// Sensores Bluetooth (Web Bluetooth API)
// - Pulso cardíaco (Heart Rate, servicio 0x180D)
// - Velocidad de rueda (Cycling Speed & Cadence, 0x1816)
// Nota de compatibilidad: Chrome/Edge en Android y desktop.
// iOS Safari NO soporta Web Bluetooth → degradación elegante.
// ============================================================

/** Circunferencia de rueda en metros (700×25c ≈ 2.105). Ajustable. */
export const WHEEL_CIRCUMFERENCE_M = 2.105;

export function btSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

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

function bt(): NonNullable<BtNavigator["bluetooth"]> {
  const b = (navigator as unknown as BtNavigator).bluetooth;
  if (!b) throw new Error("Web Bluetooth no está disponible en este navegador (iOS Safari no lo soporta).");
  return b;
}

/** Conecta un monitor de pulso y entrega los bpm por callback. */
export async function connectHeartRate(
  onBpm: (bpm: number) => void,
  onDisconnect: () => void
): Promise<string> {
  const device = await bt().requestDevice({ filters: [{ services: ["heart_rate"] }] });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("heart_rate");
  const ch = await svc.getCharacteristic("heart_rate_measurement");
  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", (e) => {
    const dv = e.target.value;
    if (!dv) return;
    const flags = dv.getUint8(0);
    const bpm = flags & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1);
    if (bpm > 0 && bpm < 260) onBpm(bpm);
  });
  return device.name ?? "Sensor de pulso";
}

/**
 * Conecta un sensor de velocidad de rueda (CSC). La velocidad se
 * calcula con revoluciones acumuladas y tiempo de evento (1/1024 s):
 * sin el lag del GPS — ideal para la fiscalización del parque.
 */
export async function connectWheelSpeed(
  onSpeed: (kmh: number) => void,
  onDisconnect: () => void,
  circumferenceM: number = WHEEL_CIRCUMFERENCE_M
): Promise<string> {
  const device = await bt().requestDevice({ filters: [{ services: ["cycling_speed_cadence"] }] });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("cycling_speed_cadence");
  const ch = await svc.getCharacteristic("csc_measurement");
  await ch.startNotifications();
  let lastRevs: number | null = null;
  let lastTime: number | null = null; // en 1/1024 s
  ch.addEventListener("characteristicvaluechanged", (e) => {
    const dv = e.target.value;
    if (!dv) return;
    const flags = dv.getUint8(0);
    let off = 1;
    if (flags & 0x01) {
      const cumRevs = dv.getUint32(off, true);
      off += 4;
      const evTime = dv.getUint16(off, true);
      if (lastRevs !== null && lastTime !== null) {
        let dRevs = cumRevs - lastRevs;
        if (dRevs < 0) dRevs += 0x100000000; // overflow de uint32
        let dT = evTime - lastTime;
        if (dT < 0) dT += 0x10000; // overflow de uint16
        if (dT > 0) {
          const mps = (dRevs * circumferenceM) / (dT / 1024);
          const kmh = mps * 3.6;
          if (kmh >= 0 && kmh < 130) onSpeed(kmh);
        }
      }
      lastRevs = cumRevs;
      lastTime = evTime;
    }
  });
  return device.name ?? "Sensor de velocidad";
}
