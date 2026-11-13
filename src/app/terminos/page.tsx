import type { Metadata } from "next";
import Link from "next/link";

// ============================================================
// /terminos - Términos y Condiciones de Cumbre30.
// Página estática (sin APIs dinámicas) para que también exista
// dentro del export del APK. Mismo formato que /privacidad.
// Aclara la independencia de Cumbre GEO respecto a Parquemet
// y demás marcas e instituciones mencionadas en la app.
// ============================================================

export const metadata: Metadata = {
  title: "Términos y Condiciones - Cumbre30",
  description:
    "Términos de uso de Cumbre30: independencia de marcas (Parquemet y otros), uso responsable del ciclista, cuentas, plan Pro, propiedad intelectual y responsabilidad.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cumbre30</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Términos y Condiciones</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Las reglas de uso de Cumbre30 y de la web cumbregeo.cl. Última actualización: noviembre de 2026.
      </p>

      <Section title="Quién somos">
        <p>
          Cumbre30 es una aplicación desarrollada por <span className="font-medium text-foreground">Cumbre GEO</span>,
          un estudio independiente de software. Para cualquier consulta escribe a{" "}
          <a href="mailto:contacto.cumbre30@gmail.com" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            contacto.cumbre30@gmail.com
          </a>{" "}
          o contáctanos por WhatsApp al +56 9 4296 1619. Al descargar, instalar o usar Cumbre30 —en el teléfono o en la
          web— aceptas estos términos.
        </p>
      </Section>

      <Section title="Somos independientes: sin relación con Parquemet ni otras marcas">
        <p>
          <span className="font-medium text-foreground">Cumbre GEO y Cumbre30 son productos independientes.</span> No
          tenemos ninguna relación, acuerdo, patrocinio, respaldo ni representación con el{" "}
          <span className="font-medium text-foreground">Parque Metropolitano de Santiago (Parquemet)</span> ni con
          ninguna otra institución pública o empresa privada.
        </p>
        <p>
          Los nombres, marcas, logotipos e instituciones que aparecen en la app o en este sitio —Parquemet, Pedalea
          Seguro, Carabineros de Chile, Salud Responde, Google, Android, Google Play, Mercado Pago, OpenStreetMap y
          otros— son propiedad de sus respectivos titulares y se mencionan únicamente con fines informativos o de
          compatibilidad. Ninguna de esas marcas respalda ni es responsable de Cumbre30.
        </p>
      </Section>

      <Section title="Qué es Cumbre30 y qué no es">
        <p>
          Cumbre30 es un ciclocomputador personal de apoyo para pedalear el Cerro San Cristóbal: registra tu ride con
          GPS, muestra tu velocidad y estadísticas, entrega avisos informativos y guarda tu credencial Pedalea Seguro.
        </p>
        <p>
          <span className="font-medium text-foreground">No es un instrumento oficial de medición ni un canal oficial
          del parque.</span> Los datos que muestra (velocidad, ubicación, límites, horarios, rutas, alertas) son
          referenciales: pueden diferir de la señalización, de los instrumentos de fiscalización o de la información
          publicada por Parquemet. La información oficial siempre será la que entreguen los letreros del parque, sus
          guardaparques y sus canales oficiales.
        </p>
      </Section>

      <Section title="Uso responsable y seguridad">
        <p>
          El ciclista es el único responsable de su seguridad y de cumplir la normativa vigente mientras pedalea. La
          app es un apoyo y nunca debe distraerte: opera el teléfono solo detenido, en un lugar seguro.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Respeta el límite de 30 km/h y las demás normas del Parque Metropolitano de Santiago.</li>
          <li>La fiscalización, multas y sanciones corresponden exclusivamente a Parquemet y Carabineros de Chile; Cumbre30 no interviene en ellas.</li>
          <li>El GPS y las alertas pueden fallar por cobertura, clima, interferencias o el propio dispositivo. No dependas de la app para decisiones de seguridad.</li>
          <li>El uso de la app se hace bajo tu propia responsabilidad; pedalea con casco y luces, como exige la normativa chilena.</li>
        </ul>
      </Section>

      <Section title="Pedalea Seguro (Parquemet)">
        <p>
          El registro Pedalea Seguro y la emisión del QR son trámites exclusivos de Parquemet en
          pedaleaseguro.parquemet.cl. Cumbre30 solo guarda y muestra la imagen del QR que tú mismo cargas, en tu
          teléfono; no registramos, validamos ni transmitimos ese dato a Parquemet ni a nadie. Si tu QR es rechazado o
          el programa cambia, el tema se resuelve con Parquemet, no con nosotros.
        </p>
      </Section>

      <Section title="Cuentas">
        <p>
          Para usar funciones con cuenta debes dar datos veraces (un correo válido) y cuidar tus credenciales. En la
          app Android las cuentas pueden vivir solo en tu teléfono; en la web se guardan en nuestros servidores, según
          describe la{" "}
          <Link href="/privacidad" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            Política de Privacidad
          </Link>
          . No compartas tu cuenta con terceros ni la uses para suplantar a otras personas. Podemos bloquear cuentas
          que usen el servicio para fines ilegales o que dañen la app para el resto de los usuarios.
        </p>
      </Section>

      <Section title="Plan Pro, pagos y aportes">
        <p>
          El plan Pro y los aportes voluntarios se pagan a través de enlaces de Mercado Pago; los datos de tarjetas los
          procesa Mercado Pago y Cumbre30 no los recibe. Al comprar Pro recibes un código de activación por correo.
          Los precios están en pesos chilenos e incluyen lo que la página de planes describe para cada opción.
        </p>
        <p>
          Puedes pedir la revisión de una compra dentro de 10 días desde el pago escribiendo a nuestro correo. Las
          funciones Pro se activan en el dispositivo y son de uso personal.
        </p>
      </Section>

      <Section title="Propiedad intelectual">
        <p>
          La app, su diseño, su código y sus contenidos son de Cumbre GEO. Los mapas usan datos abiertos de{" "}
          <span className="font-medium text-foreground">OpenStreetMap</span> y sus colaboradores (ODbL); los trazados
          de rutas y demás datos del parque son informativos y pueden cambiar sin aviso. No puedes copiar,
          reingenierar ni redistribuir la app como propia. Los rides y datos personales son tuyos: puedes exportarlos
          en GPX cuando quieras.
        </p>
      </Section>

      <Section title="Limitación de responsabilidad">
        <p>
          Cumbre30 se entrega “tal cual”, sin garantías de disponibilidad o exactitud. Haremos nuestro mejor esfuerzo
          para que funcione bien, pero no respondemos por daños derivados de su uso o de su indisponibilidad,
          incluyendo —a título ejemplificativo— accidentes, multas, rides no registrados, pérdida de datos o decisiones
          tomadas confiando en la información de la app. La ley chilena rige estos términos y los tribunales de
          Santiago son competentes para cualquier disputa.
        </p>
      </Section>

      <Section title="Fin del servicio y eliminación de cuenta">
        <p>
          Puedes dejar de usar la app y eliminar tu cuenta cuando quieras desde Perfil → Mis datos → Eliminar cuenta, o
          desde la página{" "}
          <Link href="/eliminar-cuenta" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            Eliminar cuenta
          </Link>
          . Si algún día cerramos el servicio, lo avisaremos dentro de la app y en este sitio con anticipación
          razonable.
        </p>
      </Section>

      <Section title="Cambios">
        <p>
          Si estos términos cambian, publicaremos la versión actualizada en esta misma página con la nueva fecha. Si
          el cambio es importante, lo avisaremos también dentro de la app. Seguir usando Cumbre30 después del cambio
          significa que aceptas la nueva versión.
        </p>
      </Section>

      <p className="mt-10 text-xs text-muted-foreground">
        ¿Dudas? <a href="mailto:contacto.cumbre30@gmail.com" className="text-emerald-600 hover:underline dark:text-emerald-400">contacto.cumbre30@gmail.com</a>
      </p>
    </main>
  );
}
