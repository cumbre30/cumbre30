"use client";

// ============================================================
// Ayuda y contacto - con subsecciones:
//   · "Ayuda": contacto (correo; sin WhatsApp a pedido del
//     proyecto), consejos rápidos de GPS e info de constancias.
//   · "Prototipo": formulario "¿Gestionas un parque o ciclovía?"
//     para armar un prototipo white-label del motor Cumbre30.
// ============================================================

import { useState } from "react";
import { Mail, Mountain, Map, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, openExternal } from "@/lib/proConfig";
import { SubTabs } from "@/components/SubTabs";
import { t, useLang } from "@/lib/i18n";

export function HelpTab() {
  useLang();
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("ay.mailConsulta"))}`;

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
      t("ay.msgIntro"),
      "",
      t("ay.msgNombre", cName.trim()),
      t("ay.msgParque", cPark.trim()),
      t("ay.msgCorreo", cMail.trim()),
    ];
    if (cPhone.trim()) lines.push(t("ay.msgTelefono", cPhone.trim()));
    if (cText.trim()) lines.push("", t("ay.msgMensaje", cText.trim()));
    return lines.join("\n");
  };

  const sendWhatsApp = (): void => {
    if (!CONTACT_WHATSAPP) return;
    void openExternal(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(buildContactMsg())}`);
    setCMsg({ ok: true, text: t("ay.waListo") });
    setTimeout(() => setCMsg(null), 9000);
  };

  const sendMail = (): void => {
    if (!CONTACT_EMAIL) return;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      t("ay.mailSubject"),
    )}&body=${encodeURIComponent(buildContactMsg())}`;
    setCMsg({ ok: true, text: t("ay.mailListo") });
    setTimeout(() => setCMsg(null), 9000);
  };

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel={t("ay.subAria")}
        value={sub}
        onChange={(k) => setSub(k as "ayuda" | "prototipo")}
        tabs={[
          { key: "ayuda", label: t("ay.tabAyuda") },
          { key: "prototipo", label: t("ay.tabPrototipo") },
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
            <span className="text-[14px] font-bold">{t("ay.correo")}</span>
            <span className="text-[12px] font-medium text-muted-foreground">{CONTACT_EMAIL}</span>
          </span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Mountain className="h-4 w-4 text-emerald-500" /> {t("ay.gpsTitulo")}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.gpsCuerpo1")}<b className="text-foreground">{t("ay.permitirSiempre")}</b>{t("ay.gpsCuerpo2")}
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-1.5 font-bold text-foreground">{t("ay.constanciasTitulo")}</div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.constanciasCuerpo1")}<b className="text-foreground">{t("ay.misViajes")}</b>{t("ay.constanciasCuerpo2")}
        </p>
      </Card>

      {/* ---- Fuentes cartográficas y licencias (OSM/ODbL) ---- */}
      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Map className="h-4 w-4 text-emerald-500" /> {t("ay.fuentesTitulo")}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.fuentesCuerpo")}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          © <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a className="underline underline-offset-2" href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>
        </p>
        {/* C-06: inventario formal de licencias de terceros. */}
        <a
          href="/THIRD-PARTY-NOTICES.md"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[12px] font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          {t("ay.licenciasNotices")}
        </a>
      </Card>

      {/* ---- Términos de uso: mensaje de responsabilidad exigido ---- */}
      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> {t("ay.terminosTitulo")}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.terminosCuerpo")}
        </p>
        {/* A-01: enlaces a los documentos legales completos. */}
        <div className="mt-2 flex gap-4">
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            {t("ay.verTerminos")}
          </a>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
            {t("ay.verPrivacidad")}
          </a>
        </div>
      </Card>

      {/* ---- Privacidad y datos personales (Ley 21.719) ---- */}
      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Lock className="h-4 w-4 text-emerald-500" /> {t("ay.privacidadTitulo")}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.privacidadCuerpo1")}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
          <li>{t("ay.privacidadFinalidad")}</li>
          <li>{t("ay.privacidadDuracion")}</li>
          <li>{t("ay.privacidadEliminacion")}</li>
          <li>{t("ay.privacidadSeguridad")}</li>
        </ul>
      </Card>
      </>
      )}

      {sub === "prototipo" && (
      <>
      {/* ---- ¿Gestionas un parque o ciclovía? - prototipo white-label ---- */}
      <Card className="p-4">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-foreground">
          <Mountain className="h-4 w-4 text-emerald-500" /> {t("ay.parqueTitulo")}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t("ay.parqueCuerpo")}
        </p>
        {!showContact ? (
          <Button variant="outline" onClick={() => setShowContact(true)} className="mt-3 h-10 w-full border-border text-foreground">
            {t("ay.meInteresa")}
          </Button>
        ) : (
          <div className="mt-3 grid gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="h-name" className="text-foreground/90">{t("ay.tuNombre")}</Label>
              <Input id="h-name" placeholder={t("ay.tuNombre")} value={cName} onChange={(e) => setCName(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-park" className="text-foreground/90">{t("ay.parqueInstitucion")}</Label>
              <Input id="h-park" placeholder={t("ay.parqueInstitucion")} value={cPark} onChange={(e) => setCPark(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-mail" className="text-foreground/90">{t("ay.tuCorreo")}</Label>
              <Input id="h-mail" type="email" placeholder={t("ay.tuCorreo")} value={cMail} onChange={(e) => setCMail(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-phone" className="text-foreground/90">{t("ay.telefonoOpcional")}</Label>
              <Input id="h-phone" placeholder={t("ay.telefonoOpcional")} value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-text" className="text-foreground/90">{t("ay.mensaje")}</Label>
              <Textarea
                id="h-text"
                placeholder={t("ay.textareaPlaceholder")}
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
                {t("ay.enviarWhatsapp")}
              </Button>
              <Button
                variant="outline"
                disabled={!CONTACT_EMAIL || !contactOk}
                onClick={sendMail}
                className="h-10 flex-1 border-border text-foreground"
              >
                {t("ay.porCorreo")}
              </Button>
            </div>
            {(!CONTACT_WHATSAPP || !CONTACT_EMAIL) && (
              <p className="text-[11px] text-muted-foreground">
                {t("ay.contactoConfigurando")}
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
        Cumbre30 · {t("nav.subtitle")} · cumbregeo.cl
      </p>
    </div>
  );
}
