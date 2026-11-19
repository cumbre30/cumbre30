import type { Metadata } from "next";
import Link from "next/link";

// ============================================================
// /privacidad - Política de Privacidad de Cumbre30.
// Página estática (sin APIs dinámicas) para que también exista
// dentro del export del APK. URL requerida por Google Play
// Console (Política de privacidad en Contenido de la app).
// Ruta canónica por app: /geo/cumbre30/privacidad (vercel.json
// redirige esta raíz hacia allí; la raíz se mantiene para el APK
// ya publicado y para el export offline).
// ============================================================

export const metadata: Metadata = {
  title: "Política de Privacidad - Cumbre30",
  description:
    "Cómo Cumbre30 trata tus datos: cuenta, recorridos GPS, licencia Pro y eliminación de cuenta.",
  // Favicon de esta página: logo de la app Cumbre30 (el resto del sitio
  // usa la marca Cumbre GEO definida en layout.tsx). Igual que /terminos.
  icons: {
    icon: [{ url: "/icons/icon-192.png", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-justify text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      {/* Logo de la app Cumbre30 (mismo tratamiento que /terminos). */}
      <img
        src="/icons/icon-512.png"
        alt="Logo de Cumbre30"
        width={56}
        height={56}
        className="mb-4 rounded-2xl"
      />
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cumbre30</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-justify text-muted-foreground">
        Ciclocomputador de apoyo al ciclista, con avisos informativos del Parque Metropolitano de Santiago. Última
        actualización: noviembre de 2026.
      </p>

      <Section title="Quién es responsable">
        <p>
          Cumbre30 es una aplicación independiente de apoyo al ciclista. Para
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
            <span className="font-medium text-foreground">Cuenta:</span> correo electrónico y nombre de usuario.
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
        <p>
          <span className="font-medium text-foreground">QR Pedalea Seguro (Parquemet):</span> la imagen del QR oficial
          que cargas en la app se guarda únicamente en el almacenamiento de tu teléfono. Cumbre30 no la sube a ningún
          servidor ni procesa sus datos; el registro Pedalea Seguro lo gestiona Parquemet en pedaleaseguro.parquemet.cl.
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

      <Section title="Ubicación y servicios de mapa y clima">
        <p>
          La ubicación GPS se captura solo mientras el ride está activo, en primer plano y con la
          notificación visible del servicio. Se procesa en tu teléfono (geocercas, alertas, registro del
          recorrido) y la pista completa de coordenadas no sale del dispositivo: al servidor sube únicamente
          el resumen del ride (fecha, distancia, velocidades, desnivel) si la cuenta está sincronizada.
        </p>
        <p>
          Para funciones de apoyo se envían consultas puntuales a servicios externos:{" "}
          <span className="font-medium text-foreground">Photon (Komoot)</span> y{" "}
          <span className="font-medium text-foreground">Nominatim (OpenStreetMap)</span> para convertir una
          ubicación en nombre de sector o calle, y{" "}
          <span className="font-medium text-foreground">Open-Meteo</span> para el banner de clima y UV, al que
          se le envían coordenadas del momento. Estas consultas no van asociadas a tu cuenta ni a tu identidad.
        </p>
      </Section>

      <Section title="Sensores Bluetooth y datos de salud">
        <p>
          Si conectas un sensor de frecuencia cardíaca (o de velocidad de rueda) por Bluetooth, la app trata
          esos datos en tu teléfono y en tiempo real. La frecuencia cardíaca es un dato de salud: se procesa
          con tu consentimiento explícito, que la app te pide la primera vez que emparejas un sensor, y no se
          guarda ni se envía a ningún servidor. Puedes revocar ese consentimiento dejando de usar el sensor y
          borrando el permiso de Bluetooth.
        </p>
      </Section>

      <Section title="Contactos de emergencia (ICE)">
        <p>
          Puedes guardar hasta 3 contactos de emergencia (nombre y teléfono) para que la app les haga llegar un
          aviso con tu ubicación si sufres una caída y no respondes a la confirmación. Esos contactos viven
          únicamente en tu teléfono: nunca se suben a un servidor. Como son datos de personas distintas a ti,
          te pedimos avisarles que los guardaste en la app. El mensaje que reciben sale por tu propia app de
          mensajería (SMS o WhatsApp), así que ese envío también queda sujeto a las políticas de esa
          aplicación. La detección de caídas es orientativa: puede no detectar todas las caídas y Cumbre30 no
          reemplaza a los servicios de emergencia.
        </p>
      </Section>

      <Section title="Notificaciones push (web)">
        <p>
          Si te suscribes a los avisos del parque en la web, guardamos el identificador técnico de
          suscripción (endpoint) que entrega tu navegador, junto con las claves criptográficas necesarias para
          enviarte la notificación. No incluye contenido de tus mensajes ni datos de identidad adicionales. Puedes
          darte de baja desde el navegador en cualquier momento; los endpoints caducados se eliminan al
          intentar enviar.
        </p>
      </Section>

      <Section title="Constancias de trayecto">
        <p>
          Al emitir una constancia se guarda un hash SHA-256 de su contenido y un resumen del ride (incluido tu
          nombre de usuario) para que cualquier persona con el enlace o el QR pueda verificar la autenticidad del
          documento. El enlace es público: compártelo solo con quien quieras mostrarle esos datos. La pista GPS
          completa nunca se incluye.
        </p>
      </Section>

      <Section title="Menores de edad">
        <p>
          Cumbre30 no está dirigida a menores de 14 años y al crear una cuenta se pide confirmar esa edad. Si
          tomamos conocimiento de que una cuenta pertenece a un menor de esa edad, la eliminamos y borramos sus
          datos. La app trata geolocalización y, si el usuario lo activa, datos de salud, por lo que el uso por
          menores requiere supervisión de un adulto responsable.
        </p>
      </Section>

      <Section title="Cuánto tiempo conservamos los datos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Cuenta y rides sincronizados: hasta que los borres o elimines tu cuenta (máximo 100 rides guardados).</li>
          <li>Sesión: expira a los 30 días; puedes cerrar todas tus sesiones desde Perfil.</li>
          <li>Códigos de restablecimiento: 30 minutos, con máximo 5 intentos.</li>
          <li>Registros de ventas Pro: los que exija la normativa tributaria vigente.</li>
          <li>Incidencias comunitarias: se ocultan del mapa después de 30 días sin confirmaciones.</li>
          <li>Pista GPS completa: solo en tu teléfono, hasta que la borres (tu historial local tiene un tope automático).</li>
        </ul>
      </Section>

      <Section title="Transferencias internacionales">
        <p>
          Los proveedores que alojan el servicio (hosting y base de datos) operan desde centros de datos que
          pueden estar fuera de Chile, bajo contratos y condiciones de procesamiento estándar de cada proveedor.
          Las consultas de mapa y clima descritas arriba se dirigen a servicios ubicados en la Unión Europea. No
          vendemos ni transferimos tus datos personales a terceros para publicidad.
        </p>
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
          Puedes eliminar tu cuenta y todos sus datos en cualquier momento desde la app (Perfil › Mis datos ›
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
        <p>
          Las solicitudes de acceso, rectificación, cancelación, oposición y portabilidad de tus datos —incluida la
          revocación de cualquier consentimiento— pueden enviarse a{" "}
          <a href="mailto:contacto.cumbre30@gmail.com" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            contacto.cumbre30@gmail.com
          </a>
          , nuestro canal oficial como responsables del tratamiento. También puedes ejercerlas escribiendo por
          WhatsApp al +56 9 4296 1619. Si crees que no respondimos como corresponde, puedes reclamar ante la
          Agencia de Protección de Datos Personales que establece la Ley 21.719.
        </p>
      </Section>

      <Section title="Cambios">
        <p>
          Si esta política cambia, publicaremos la versión actualizada en esta misma página. Si el cambio es
          importante, lo avisaremos también dentro de la app.
        </p>
      </Section>

      <Section title="Términos de uso">
        <p>
          Las reglas del servicio (independencia de marcas como Parquemet, uso responsable, cuentas, plan Pro y
          responsabilidad) están en los{" "}
          <Link href="/terminos" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            Términos y Condiciones
          </Link>
          .
        </p>
      </Section>

      <p className="mt-10 text-xs text-muted-foreground">
        ¿Dudas? <a href="mailto:contacto.cumbre30@gmail.com" className="text-emerald-600 hover:underline dark:text-emerald-400">contacto.cumbre30@gmail.com</a>
      </p>
    </main>
  );
}
