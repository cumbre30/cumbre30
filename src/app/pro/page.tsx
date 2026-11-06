import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  HeartHandshake,
  KeyRound,
  Mail,
  ShoppingBag,
  Wifi,
} from "lucide-react";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, DONATE_OPTIONS, PRO_BENEFITS, PRO_PAY_URL } from "@/lib/proConfig";

// ============================================================
// /pro — Página de venta de Cumbre30 Pro (web oficial).
// Aquí vive el pago con Mercado Pago: Google Play prohíbe dirigir
// la compra de funciones digitales desde la app, así que la app
// solo activa códigos; esta página es el punto de compra web y el
// destino del campo "sitio web" de la ficha de Play.
//
// Marca CumbreLabs (paleta del manual, sin CafinderCL):
//   espresso #241A11 · crema #F2EAD9 · verde Cumbre30 #35B85F
//   cobre #8A6A4F
// ============================================================

export const metadata: Metadata = {
  title: "Cumbre30 Pro — pago único | CumbreLabs",
  description:
    "Desbloquea Cumbre30 Pro con un pago único: export GPX, constancias ilimitadas, segmentos con récords, historial ilimitado y estadísticas avanzadas. Paga con Mercado Pago y activa tu código en la app.",
};

const C = {
  bg: "#241A11",
  cream: "#F2EAD9",
  creamDim: "rgba(242, 234, 217, 0.66)",
  green: "#35B85F",
  copper: "#8A6A4F",
  card: "rgba(242, 234, 217, 0.06)",
  line: "rgba(242, 234, 217, 0.14)",
};

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
        style={{ background: C.green, color: "#0E2214" }}
      >
        {n}
      </span>
      <div>
        <p className="text-[13.5px] font-bold" style={{ color: C.cream }}>
          {title}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: C.creamDim }}>
          {body}
        </p>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <p className="text-[13px] font-bold" style={{ color: C.cream }}>
        {q}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.creamDim }}>
        {a}
      </p>
    </div>
  );
}

export default function ProPage() {
  return (
    <main className="min-h-dvh w-full" style={{ background: C.bg, color: C.cream }}>
      <div className="mx-auto w-full max-w-xl px-5 py-10">
      {/* Marca CumbreLabs */}
      <p className="text-center text-[15px] font-black tracking-[0.35em]" style={{ color: C.cream }}>
        CUMBRE<span className="font-light">LABS</span>
      </p>
      <p className="mt-1 text-center text-[9.5px] font-semibold tracking-[0.45em]" style={{ color: C.copper }}>
        TECNOLOGÍA PARA DESCUBRIR
      </p>

      {/* Hero */}
      <div className="mt-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: C.green }}>
          <Crown className="h-8 w-8" style={{ color: "#0E2214" }} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight" style={{ color: C.cream }}>
          Cumbre30 <span style={{ color: C.green }}>Pro</span>
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: C.creamDim }}>
          El ciclocomputador del cerro San Cristóbal, con todo desbloqueado.
        </p>

        <p className="mt-6 text-5xl font-extrabold tracking-tight" style={{ color: C.cream }}>
          $6.500
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: C.copper }}>
          precio fundador · pago único · sin suscripción · para siempre
        </p>

        <a
          href={PRO_PAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90"
          style={{ background: C.green, color: "#0E2214" }}
        >
          <ShoppingBag className="h-5 w-5" /> Comprar Pro — $6.500
        </a>
        <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: C.creamDim }}>
          Pagas con Mercado Pago y recibes tu código{" "}
          <span className="font-mono" style={{ color: C.cream }}>
            C30P-XXXX-…
          </span>{" "}
          por correo. Después lo activas en la app:{" "}
          <b style={{ color: C.cream }}>Perfil → Pagos y suscripciones</b>.
        </p>
      </div>

      {/* Beneficios */}
      <section className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Qué desbloquea Pro
        </h2>
        <ul className="mt-3 space-y-2.5">
          {PRO_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.green }} />
              <span style={{ color: C.cream }}>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo activar */}
      <section className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Cómo activar tu código
        </h2>
        <div className="mt-4 space-y-4">
          <Step
            n={1}
            title="Paga con Mercado Pago"
            body="Desde el botón verde de esta página: tarjeta, dinero en cuenta o efectivo en agentes."
          />
          <Step
            n={2}
            title="Recibe tu código por correo"
            body={`Te enviamos el código C30P- ligado a tu correo (normalmente en minutos; si demora, escríbenos con tu comprobante a ${CONTACT_EMAIL}).`}
          />
          <Step
            n={3}
            title="Actívalo en la app"
            body="Abre Cumbre30 → Perfil → Pagos y suscripciones → Habilitar modo Pro → ingresa tu correo y el código. La validación es local: no necesita internet."
          />
        </div>
        <p
          className="mt-4 flex items-start gap-2 rounded-xl p-3 text-[11.5px] leading-relaxed"
          style={{ background: C.card, border: `1px solid ${C.line}`, color: C.creamDim }}
        >
          <Wifi className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.green }} />
          La app funciona 100% offline: una vez activado el código, Pro queda guardado en el teléfono.
        </p>
      </section>

      {/* Aporte voluntario */}
      <section className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Aporte voluntario
        </h2>
        <div className="mt-3 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-start gap-3">
            <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0" style={{ color: C.green }} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold" style={{ color: C.cream }}>
                ¿Quieres apoyar sin llevar Pro?
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.creamDim }}>
                Cumbre30 es gratis, sin publicidad y hecha en Chile. Tu aporte financia los mapas, los avisos de voz y
                las próximas funciones. ¡Cualquier monto ayuda!
              </p>
              <a
                href={DONATE_OPTIONS[0]?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold transition-opacity hover:opacity-85"
                style={{ border: `1.5px solid ${C.green}`, color: C.green }}
              >
                <HeartHandshake className="h-4 w-4" /> Aportar — monto libre
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Preguntas frecuentes
        </h2>
        <div className="mt-3 space-y-2.5">
          <Faq
            q="¿Es un pago único o suscripción?"
            a="Pago único: activas Pro para siempre en ese teléfono, sin renovaciones ni cobros automáticos."
          />
          <Faq
            q="¿Puedo pasar mi Pro a otro teléfono?"
            a="Sí. Quita la licencia desde el teléfono antiguo (Pagos y suscripciones → Quitar licencia) y activa el mismo código en el nuevo con el mismo correo."
          />
          <Faq
            q="¿Compré Pro dentro de Google Play, qué hago?"
            a="Si compraste desde la app instalada por Google Play, Pro se activa solo con tu cuenta Google. El código de esta página es para quienes pagan por la web."
          />
          <Faq
            q="¿La app funciona sin señal en el cerro?"
            a="Sí: mapas, rutas, GPS y alertas funcionan sin datos móviles. El pago y la primera activación sí necesitan internet."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t pt-6" style={{ borderColor: C.line }}>
        <p className="text-center text-[11px] leading-relaxed" style={{ color: C.creamDim }}>
          CumbreLabs · Cumbre30 · App independiente de apoyo al ciclista; no es oficial del Parque Metropolitano de
          Santiago.
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px]" style={{ color: C.creamDim }}>
          <Mail className="h-3.5 w-3.5" />
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.green }}>
            {CONTACT_EMAIL}
          </a>
          <span aria-hidden>·</span>
          <a href={`https://wa.me/${CONTACT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ color: C.green }}>
            WhatsApp
          </a>
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px]" style={{ color: C.creamDim }}>
          <Link href="/privacidad" className="underline" style={{ color: C.copper }}>
            Privacidad
          </Link>
          <Link href="/eliminar-cuenta" className="underline" style={{ color: C.copper }}>
            Eliminar cuenta
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 underline" style={{ color: C.copper }}>
            Abrir la app <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: C.creamDim }}>
          <KeyRound className="h-3 w-3" /> Pago seguro procesado por Mercado Pago — Cumbre30 no almacena datos de tarjetas.
        </p>
      </footer>
      </div>
    </main>
  );
}
