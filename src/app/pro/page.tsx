import { redirect } from "next/navigation";

// ============================================================
// /pro — ahora vive DENTRO de /geo (vista "planes", unificación
// aprobada por el cliente). Esta ruta queda como redirección para
// que los enlaces antiguos (correos de códigos, ficha de Play,
// historial) sigan funcionando y aterricen en la vista de planes
// del nuevo sitio.
// ============================================================

export default function ProPage() {
  redirect("/geo?vista=planes");
}
