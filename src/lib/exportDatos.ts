"use client";

// ============================================================
// A-02: portabilidad de datos personales (Ley 21.719).
// Reúne lo que la app guarda sobre el usuario y lo descarga como
// JSON: perfil, rides del historial local (incluida la pista GPS,
// que vive solo en el teléfono), contactos de emergencia
// configurados y licencia Pro activa. El usuario la ejecuta desde
// Perfil, Mis datos. Nada viaja a ningún servidor.
// ============================================================

import { historyStore, type RideSummary } from "@/lib/history";
import { getIceConfig } from "@/lib/iceContacts";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { t } from "@/lib/i18n";

export type PerfilExport = {
  email?: string | null;
  username?: string | null;
  bicicleta?: Record<string, string | null>;
};

function licenciaLocal(): unknown {
  try {
    const raw = localStorage.getItem("cumbre30-pro-v1");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function exportarMisDatos(
  perfil: PerfilExport,
  ridesExtra?: RideSummary[],
): Promise<boolean> {
  const payload = {
    generado: new Date().toISOString(),
    app: "Cumbre30",
    formato: "cumbre30-datos-v1",
    perfil,
    rides: ridesExtra ?? historyStore.get(),
    contactos_emergencia: getIceConfig(),
    licencia_pro: licenciaLocal(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    await shareOrDownloadFile({
      blob,
      fileName: `cumbre30-datos-${hoy}.json`,
      title: t("pf.exportarTitulo"),
      text: t("pf.exportarTitulo"),
    });
    return true;
  } catch {
    return false;
  }
}
