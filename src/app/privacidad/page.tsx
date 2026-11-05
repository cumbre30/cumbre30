import type { Metadata } from "next";
import Link from "next/link";

// ============================================================
// /privacidad — Política de Privacidad de Cumbre30.
// Página estática (sin APIs dinámicas) para que también exista
// dentro del export del APK. URL requerida por Google Play
// Console (Política de privacidad en Contenido de la app).
// ============================================================

export const metadata: Metadata = {
  title: "Política de Privacidad — Cumbre30",
  description:
    "Cómo Cumbre30 trata tus datos: cuenta, recorridos GPS, licencia Pro y eliminación de cuenta.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cumbre30</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ciclocomputador para pedalear el Cerro San Cristóbal con el límite de 30 km/h. Última actualización:
        noviembre de 2026.
      </p>

      <Section title="Quién es responsable">
        <p>
          Cumbre30 es una aplicación independiente de apoyo al ciclista del Parque Metropolitano de Santiago. Para
          cualquier consulta sobre tus datos escribe a{" "}
          <a href="mailto:contacto.cumbre30@gmail.com" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            contacto.cumbre30@gmail.com
          </a>{" "}
          o contáctanos por WhatsApp al +56 9 4296 1619.
        </p>
      </Section>

      <Section title="Qué datos tratamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-medium text-foreground">Cuenta:</span> correo electrónico, nombre de usuario y —de
            forma opcional— los datos de tu bicicleta (marca, tipo, modelo, talla y color).
          </li>
          <li>
            <span className="font-medium text-foreground">Recorridos (rides):</span> fecha, duración, distancia,
            velocidad, desnivel y trazado GPS de tus pedaleos, junto con la marca de viajes en vehículo motorizado
            cuando confirmas esa sospecha.
          </li>
          <li>
            <span className="font-medium text-foreground">Progreso:</span> logros, desafíos y pines desbloqueados.
          </li>
          <li>
            <span className="font-medium text-foreground">Licencia Pro:</span> el estado de tu plan para activar las
            funciones Pro.
          </li>
        </ul>
      </Section>

      <Section title="Dónde se guardan">
        <p>
          <span className="font-medium text-foreground">App Android:</span> en modo offline todos los datos viven
          únicamente en el almacenamiento local de tu teléfono; tu contraseña se guarda con derivación PBKDF2 y nunca
          sale del dispositivo.
        </p>
        <p>
          <span className="font-medium text-foreground">App web:</span> la cuenta y los rides sincronizados se guardan
          en la base de datos del servidor de Cumbre30. Las contraseñas se almacenan solo como hash (scrypt) y la
          sesión usa una cookie propia. No vendemos ni arrendamos datos personales a terceros.
        </p>
      </Section>

      <Section title="Servicios de terceros">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-medium text-foreground">Google:</span> si eliges “Entrar con Google”, usamos el
            identificador y el correo de tu cuenta Google para crear o vincular tu cuenta de Cumbre30.
          </li>
          <li>
            <span className="font-medium text-foreground">Mercado Pago:</span> el plan Pro y los aportes voluntarios se
            pagan a través de enlaces de Mercado Pago. Los datos de tarjetas los procesa Mercado Pago como titular del
            medio de pago; Cumbre30 no los recibe ni los almacena.
          </li>
        </ul>
      </Section>

      <Section title="Para qué usamos los datos">
        <p>
          Única y exclusivamente para funcionar: mostrar tus estadísticas e historial, emitir tu constancia de
          enrolamiento, evaluar desafíos y recompensas, gestionar tu licencia Pro y darte soporte. No hay publicidad
          ni perfiles de marketing.
        </p>
      </Section>

      <Section title="Eliminación de cuenta y datos">
        <p>
          Puedes eliminar tu cuenta y todos sus datos en cualquier momento desde la app (Perfil → Mis datos →
          Eliminar cuenta) o desde la página{" "}
          <Link href="/eliminar-cuenta" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            Eliminar cuenta
          </Link>
          . La eliminación es definitiva: borra tu correo, usuario, kilómetros, logros, pines e historial de viajes.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Puedes acceder, rectificar o eliminar tus datos, y exportar el trazado de tus rides en formato GPX desde la
          propia app. Tratamos tus datos bajo tu consentimiento y solo para lo que la app necesita funcionar, en
          línea con la legislación chilena de protección de datos personales (Ley 19.628 y su actualización Ley
          21.719).
        </p>
      </Section>

      <Section title="Cambios">
        <p>
          Si esta política cambia, publicaremos la versión actualizada en esta misma página. Si el cambio es
          importante, lo avisaremos también dentro de la app.
        </p>
      </Section>

      <p className="mt-10 text-xs text-muted-foreground">
        ¿Dudas? <a href="mailto:contacto.cumbre30@gmail.com" className="text-emerald-600 hover:underline dark:text-emerald-400">contacto.cumbre30@gmail.com</a>
      </p>
    </main>
  );
}
