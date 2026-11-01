// Augmentos de tipos para el plugin leaflet-rotate (sin types oficiales).
import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    /** Habilita rotación del mapa (plugin leaflet-rotate). */
    rotate?: boolean;
    /** Bearing inicial en grados (0 = norte arriba). */
    bearing?: number;
    /** Pitch inicial en grados (no lo usamos). */
    pitch?: number;
    /** Oculta el control de rotación flotante del plugin. */
    rotateControl?: boolean;
    /** Gesto táctil de dos dedos para rotar (lo dejamos desactivado). */
    touchRotate?: boolean;
  }

  interface Map {
    /** Rota el mapa: bearing en grados; con { animate: true } lo anima. */
    setBearing(theta: number, options?: { animate?: boolean; duration?: number; easeLinearity?: number }): this;
    getBearing(): number;
  }
}
