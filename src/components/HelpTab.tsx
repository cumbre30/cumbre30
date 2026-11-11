"use client";

// ============================================================
// Ayuda y contacto - con subsecciones:
//   · "Ayuda": contacto (correo; sin WhatsApp a pedido del
//     proyecto), consejos rápidos de GPS e info de constancias.
//   · "Prototipo": formulario "¿Gestionas un parque o ciclovía?"
//     para armar un prototipo white-label del motor Cumbre30.
// ============================================================

import { useState } from "react";
import { Mail, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, openExternal } from "@/lib/proConfig";
import { SubTabs } from "@/components/SubTabs";

export function HelpTab() {
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Cumbre30 - consulta")}`;

  // Subsecciones: Ayuda (contacto + consejos) | Prototipo (parques)
  const [sub, setSub] = useState<"ayuda" | "prototipo">("ayuda");

  // Formulario parques / ciclovías (prototipo white-label)
  const [showContact, setShowContact] = useState(false);
  const [cName, setCName] = useState("");
  const [cPark, setCPark] = useState("");
  const [cMail, setCMail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cText, setCText] = useState("");
  const [cMsg, setCMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const contactOk = Boolean(cName.trim() && cPark.trim() && /.+@.+\..+/.test(cMail));
  const buildContactMsg = (): string => {
    const lines = [
      "Hola Cumbre30, me interesa un prototipo para otro parque.",
      "",
      `Nombre: ${cName.trim()}`,
      `Parque / institución: ${cPark.trim()}`,
      `Correo: ${cMail.trim()}`,
    ];
    if (cPhone.trim()) lines.push(`Teléfono: ${cPhone.trim()}`);
    if (cText.trim()) lines.push("", `Mensaje: ${cText.trim()}`);
    return lines.join("\n");
  };

  const sendWhatsApp = (): void => {
    if (!CONTACT_WHATSAPP) return;
    void openExternal(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(buildContactMsg())}`);
    setCMsg({ ok: true, text: "Abrimos WhatsApp con el mensaje listo - solo envíalo." });
    setTimeout(() => setCMsg(null), 9000);
  };

  const sendMail = (): void => {
    if (!CONTACT_EMAIL) return;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "Prototipo Cumbre30 para otro parque",
    )}&body=${encodeURIComponent(buildContactMsg())}`;
    setCMsg({ ok: true, text: "Abrimos tu correo con el mensaje listo - solo envíalo." });
    setTimeout(() => setCMsg(null), 9000);
  };

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel="Subsecciones de Ayuda y contacto"
        value={sub}
        onChange={(k) => setSub(k as "ayuda" | "prototipo")}
        tabs={[
          { key: "ayuda", label: "Ayuda" },
          { key: "prototipo", label: "Prototipo" },
        ]}
      />

      {sub === "ayuda" && (
      <>
      <div className="grid grid-cols-1 gap-2.5">
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
          Las constancias PDF de tus viajes están en <b className="text-foreground">Mi actividad → Mis viajes</b>{" "}
          (3 al mes en FREE, ilimitadas con Pro). El export GPX de viajes con GPS es parte de Cumbre30 Pro.
        </p>
      </Card>
      </>
      )}

      {sub === "prototipo" && (
      <>
      {/* ---- ¿Gestionas un parque o ciclovía? - prototipo white-label ---- */}
      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Mountain className="h-4 w-4 text-emerald-500" /> ¿Gestionas un parque o ciclovía?
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Cumbre30 nació para el Cerro San Cristóbal, pero el motor es reutilizable: geocercas, límite
          de velocidad con avisos, constancias y una app propia para tu parque. Cuéntanos tu caso y
          armamos un prototipo.
        </p>
        {!showContact ? (
          <Button variant="outline" onClick={() => setShowContact(true)} className="mt-3 h-10 w-full border-border text-foreground">
            Me interesa un prototipo
          </Button>
        ) : (
          <div className="mt-3 grid gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="h-name" className="text-foreground/90">Tu nombre</Label>
              <Input id="h-name" placeholder="Tu nombre" value={cName} onChange={(e) => setCName(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-park" className="text-foreground/90">Parque o institución</Label>
              <Input id="h-park" placeholder="Parque o institución" value={cPark} onChange={(e) => setCPark(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-mail" className="text-foreground/90">Tu correo</Label>
              <Input id="h-mail" type="email" placeholder="Tu correo" value={cMail} onChange={(e) => setCMail(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-phone" className="text-foreground/90">Teléfono (opcional)</Label>
              <Input id="h-phone" placeholder="Teléfono (opcional)" value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-text" className="text-foreground/90">Mensaje</Label>
              <Textarea
                id="h-text"
                placeholder="Cuéntanos del parque: ubicación, límite de velocidad, qué necesitas…"
                value={cText}
                onChange={(e) => setCText(e.target.value)}
                className="min-h-20 border-border bg-card"
              />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!CONTACT_WHATSAPP || !contactOk}
                onClick={sendWhatsApp}
                className="h-10 flex-1 bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
              >
                Enviar por WhatsApp
              </Button>
              <Button
                variant="outline"
                disabled={!CONTACT_EMAIL || !contactOk}
                onClick={sendMail}
                className="h-10 flex-1 border-border text-foreground"
              >
                Por correo
              </Button>
            </div>
            {(!CONTACT_WHATSAPP || !CONTACT_EMAIL) && (
              <p className="text-[11px] text-muted-foreground">
                El contacto se está configurando - podrás enviarlo en breve.
              </p>
            )}
            {cMsg && (
              <p
                className={`text-xs ${cMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
                role="status"
              >
                {cMsg.text}
              </p>
            )}
          </div>
        )}
      </Card>
      </>
      )}

      <p className="text-center text-[10.5px] text-muted-foreground/60">
        Cumbre30 · Ciclocomputador del Cerro San Cristóbal · Parque Metropolitano de Santiago
      </p>
    </div>
  );
}
