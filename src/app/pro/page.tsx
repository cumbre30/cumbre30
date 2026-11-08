import { redirect } from "next/navigation";

// ============================================================
// /pro — alias HEREDADO de /cumbre30pro (la ruta canónica se
// renombró para que cada app tenga su propio enlace de planes).
// Se mantiene porque hay enlaces antiguos ya distribuidos (correos
// de códigos C30P, ficha de Play, historial) que apuntan acá.
// El contenido vive DENTRO de /geo (vista "planes").
// ============================================================

export default function ProPage() {
  redirect("/geo?vista=planes&app=cumbre30");
}
