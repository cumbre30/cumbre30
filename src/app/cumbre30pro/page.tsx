import { redirect } from "next/navigation";

// ============================================================
// /cumbre30pro — ruta canónica de los planes de Cumbre30.
// El contenido vive DENTRO de /geo (vista "planes", unificación
// aprobada por el cliente). Esta ruta nombrada por app existe para
// que cada aplicación tenga su propio enlace de planes sin ambigüedad
// (si mañana se publica otra app, tendrá su propia ruta, p. ej.
// /proximaapp-pro, y aterrizará en /geo?vista=planes&app=<id>).
// ============================================================

export default function Cumbre30ProPage() {
  redirect("/geo?vista=planes&app=cumbre30");
}
