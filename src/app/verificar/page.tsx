import type { Metadata } from "next";
import VerificarClient from "./VerificarClient";

// ============================================================
// /verificar - verificación pública de constancias (2026-11-14).
// Cada constancia PDF de Cumbre30 lleva un QR con enlace a esta
// página (#d=payload+hash). El cliente reconstruye el hash en el
// dispositivo (integridad) y consulta el registro en línea
// (/api/constancias) para confirmar la emisión. Sin cookies ni
// sesión: es una página pública pensada para quien recibe el
// documento (juzgado, fiscalía, aseguradora, apoderado).
// ============================================================

export const metadata: Metadata = {
  title: "Verificación de constancias - Cumbre30",
  description:
    "Verificación pública de constancias de registro de trayecto en bicicleta emitidas por la aplicación Cumbre30: integridad del documento y registro en línea.",
  // Favicon de la app Cumbre30 (mismo tratamiento que las páginas legales).
  icons: {
    icon: [{ url: "/icons/icon-192.png", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
};

export default function VerificarPage() {
  return <VerificarClient />;
}
