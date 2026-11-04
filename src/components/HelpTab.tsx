"use client";

// ============================================================
// Ayuda y contacto — datos reales de proConfig (WhatsApp y
// correo del proyecto) + consejos rápidos de GPS.
// ============================================================

import { MessageCircle, Mail, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, openExternal } from "@/lib/proConfig";

export function HelpTab() {
  const wa = `https://wa.me/${CONTACT_WHATSAPP}`;
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Cumbre30 — consulta")}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2.5">
        <Button
          onClick={() => void openExternal(wa)}
          className="h-14 justify-start gap-3 rounded-xl border border-border bg-card text-foreground hover:bg-accent"
          variant="outline"
        >
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <span className="flex flex-col items-start">
            <span className="text-[14px] font-bold">WhatsApp</span>
            <span className="text-[12px] font-medium text-muted-foreground">+56 9 4296 1619</span>
          </span>
        </Button>
        <Button
          onClick={() => void openExternal(mail)}
          className="h-14 justify-start gap-3 rounded-xl border border-border bg-card text-foreground hover:bg-accent"
          variant="outline"
        >
          <Mail className="h-5 w-5 text-emerald-500" />
          <span className="flex flex-col items-start">
            <span className="text-[14px] font-bold">Correo</span>
            <span className="text-[12px] font-medium text-muted-foreground">{CONTACT_EMAIL}</span>
          </span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Mountain className="h-4 w-4 text-emerald-500" /> ¿Problemas con el GPS?
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Sal unos segundos a vista de cielo, mantén la app abierta y revisa que los permisos de ubicación del
          teléfono estén en <b className="text-foreground">“Permitir siempre”</b>. Con GPS real la app sigue
          registrando con la pantalla bloqueada.
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-1.5 font-bold text-foreground">Constancias y GPX</div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Las constancias PDF de tus viajes están en <b className="text-foreground">Mi actividad → Historial</b>{" "}
          (3 al mes en FREE, ilimitadas con Pro). El export GPX de viajes con GPS es parte de Cumbre30 Pro.
        </p>
      </Card>

      <p className="text-center text-[10.5px] text-muted-foreground/60">
        Cumbre30 · Ciclocomputador del Cerro San Cristóbal · Parque Metropolitano de Santiago
      </p>
    </div>
  );
}
