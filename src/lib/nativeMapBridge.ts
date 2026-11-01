// ============================================================
// Puente hacia el plugin nativo NativeMap (MapLibre Native
// Android embebido bajo el WebView). En web no se usa: los
// componentes caen a sus renderizadores web (MapLibre GL JS /
// Leaflet).
// ============================================================

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type NativeMapSourceData = Record<string, string>; // nombre de fuente → GeoJSON string

export interface NativeMapPluginInterface {
  create(o: {
    id: string;
    styleJson: string;
    images?: Record<string, string>; // nombre → PNG base64 (dataURL ok)
    gestures: boolean;
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  }): Promise<void>;
  setData(o: { id: string; sources: NativeMapSourceData }): Promise<void>;
  setCamera(o: {
    id: string;
    lat: number;
    lng: number;
    zoom: number;
    pitch: number;
    bearing: number;
    padding: { top: number; left: number; right: number; bottom: number };
    animated: boolean;
    duration?: number;
  }): Promise<void>;
  /** Rect del contenedor del mapa en CSS px del viewport (la ventana del mapa nativo). */
  setRect(o: { id: string; x: number; y: number; w: number; h: number; radius: number }): Promise<void>;
  destroy(o: { id: string }): Promise<void>;
  addListener(eventName: "mapready", cb: (d: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "mapclick", cb: (d: { id: string; lat: number; lng: number }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "usermove", cb: (d: { id: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const NativeMap = registerPlugin<NativeMapPluginInterface>("NativeMap");

/**
 * ¿Usamos el mapa nativo? Solo Android por ahora (el plugin iOS
 * llegaría después); en la web y en iOS corre el renderizador web.
 */
export function isNativeMapPlatform(): boolean {
  try {
    return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
