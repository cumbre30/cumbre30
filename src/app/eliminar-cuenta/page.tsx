import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountWebButton } from "./DeleteAccountWebButton";

// ============================================================
// /eliminar-cuenta - baja definitiva desde la web.
// URL que Google Play pide declarar en Seguridad de datos
// (eliminación de cuenta). Estática: el APK también la incluye,
// aunque ahí el flujo real vive en Perfil → Mis datos.
// ============================================================

export const metadata: Metadata = {
  title: "Eliminar cuenta - Cumbre30",
  description: "Elimina definitivamente tu cuenta de Cumbre30 y todos sus datos.",
};

export default function EliminarCuentaPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cumbre30</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Eliminar cuenta</h1>

      <p className="mt-4 text-sm leading-relaxed text-justify text-muted-foreground">
        Al eliminar tu cuenta se borran definitivamente tu correo, tu nombre de usuario, tus kilómetros, logros,
        pines y todo el historial de viajes asociado. Si eras el único usuario del dispositivo, también se elimina la
        licencia Pro guardada en él. La acción es irreversible y no podemos recuperar nada después.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card/60 p-5">
        <h2 className="text-sm font-bold text-foreground">Eliminar desde la app (recomendado)</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-justify text-muted-foreground">
          En la app Android o web: abre <span className="font-medium text-foreground">Perfil</span> ›{" "}
          <span className="font-medium text-foreground">Mis datos</span> › al final encontrarás la zona{" "}
          <span className="font-medium text-foreground">“Eliminar cuenta”</span> con confirmación en dos pasos.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card/60 p-5">
        <h2 className="text-sm font-bold text-foreground">Eliminar desde la web ahora</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-justify text-muted-foreground">
          Si tienes sesión iniciada en la web con la cuenta que quieres borrar, puedes hacerlo aquí mismo:
        </p>
        <div className="mt-3">
          <DeleteAccountWebButton />
        </div>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-justify text-muted-foreground">
        ¿Problemas o prefieres que lo hagamos nosotros? Escríbenos a{" "}
        <a href="mailto:contacto.cumbre30@gmail.com" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          contacto.cumbre30@gmail.com
        </a>{" "}
        o por{" "}
        <a
          href="https://wa.me/56942961619?text=Hola%2C%20quiero%20eliminar%20mi%20cuenta%20de%20Cumbre30"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          WhatsApp +56 9 4296 1619
        </a>{" "}
        desde el correo de tu cuenta y la damos de baja.
      </p>

      <p className="mt-8 text-xs text-muted-foreground">
        Lee la{" "}
        <Link href="/privacidad" className="text-emerald-600 hover:underline dark:text-emerald-400">
          Política de Privacidad
        </Link>{" "}
        y los{" "}
        <Link href="/terminos" className="text-emerald-600 hover:underline dark:text-emerald-400">
          Términos y Condiciones
        </Link>
        .
      </p>
    </main>
  );
}
