"use client";

// ============================================================
// Botón flotante "← Cumbre GEO" en /pro.
// Aparece SOLO cuando /pro se abre desde el nuevo sitio /geo
// (query ?from=geo). En cualquier otro caso /pro se ve igual
// que siempre — su contenido no cambia.
// ============================================================

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GeoBackLink() {
  const sp = useSearchParams();
  if (sp.get("from") !== "geo") return null;

  return (
    <Link
      href="/geo"
      className="fixed left-4 top-4 z-50 flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold backdrop-blur transition-opacity hover:opacity-85"
      style={{
        background: "rgba(36, 26, 17, 0.88)",
        border: "1px solid rgba(242, 234, 217, 0.24)",
        color: "#F2EAD9",
      }}
    >
      ← Cumbre GEO
    </Link>
  );
}
