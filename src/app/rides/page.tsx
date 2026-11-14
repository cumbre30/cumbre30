import { Metadata } from "next";
import RidesClient from "./RidesClient";

export const metadata: Metadata = {
  title: "Mis rides en la web · Cumbre30",
  description: "Tus viajes registrados con Cumbre30, consultados desde cualquier navegador con tu cuenta.",
};

export default function Page() {
  return <RidesClient />;
}
