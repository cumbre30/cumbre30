import { Metadata } from "next";
import ShareClient from "./ShareClient";

export const metadata: Metadata = {
  title: "Ride compartido · Cumbre30",
  description: "Estadísticas de un pedaleo en el Parque Metropolitano de Santiago, compartidas con un enlace público de Cumbre30.",
};

export default function Page() {
  return <ShareClient />;
}
