# Refactor ConfigTab (v1.12.13): nivel 3 de navegación.
# General → Seguridad → Alertas (pitidos + avisos de voz + disclaimer), etc.
# Aplica a las 3 tarjetas; botón de regreso renombrado a «Volver».
# Técnica: reemplazo por índices entre anclas (no requiere texto viejo completo).
import pathlib

p = pathlib.Path("src/components/ConfigTab.tsx")
s = p.read_text()
orig_len = len(s)

def entre(inicio: str, fin: str) -> tuple[int, int]:
    i1 = s.find(inicio)
    i2 = s.find(fin)
    assert i1 != -1 and i2 != -1 and i1 < i2, (inicio[:60], fin[:60])
    return i1, i2

# ---------- A) imports lucide: Gauge y Map ----------
a = 'UserRound, BellRing, HeartPulse, RefreshCw, Download, ChevronRight, ArrowLeft } from "lucide-react";'
assert a in s
s = s.replace(a, 'UserRound, BellRing, HeartPulse, RefreshCw, Download, ChevronRight, ArrowLeft, Gauge, Map } from "lucide-react";')

# ---------- B) estado sub ----------
a = '  const [card, setCard] = useState<TarjetaCfg>("menu");\n'
assert a in s
s = s.replace(a, a + '  // Subpantalla de segundo nivel (v1.12.13): General → Seguridad →\n'
                     '  // Alertas, etc. null = menú de subsecciones de la tarjeta.\n'
                     '  const [sub, setSub] = useState<string | null>(null);\n')

# ---------- C) headerSub con «Volver» ----------
i1, i2 = entre("  // Encabezado de subpantalla:", "  // ---- Contenido por tarjeta")
nuevo_header = '''  // Encabezado de subpantalla: botón Volver + título. En nivel 3 (una
  // subsección abierta) vuelve al menú de la tarjeta; en nivel 2 vuelve
  // a General. El botón se llama «Volver» (pedido del cliente).
  const headerSub = (titulo: string) => (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => (sub ? setSub(null) : setCard("menu"))}
        aria-label={t("cfg.volver")}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("cfg.volver")}
      </button>
      <p className="text-[13px] font-extrabold text-foreground">{titulo}</p>
    </div>
  );

'''
s = s[:i1] + nuevo_header + s[i2:]

# ---------- D) SEGURIDAD: menú + subpantallas ----------
i1, i2 = entre("  // SEGURIDAD: Alertas", "  // MONITOREO Y SALUD")
seg = '''  // SEGURIDAD: subpantallas (v1.12.13). Nivel 2 = menú de subsecciones;
  // nivel 3 = Alertas (pitidos de velocidad + avisos de voz + aviso
  // orientativo), Detección de incidentes, Emergencia (ICE) y Avisos
  // push del parque (solo web; el APK usa notificaciones nativas).
  const SUBS_SEGURIDAD = [
    { id: "alertas", icon: <Volume2 className="h-5 w-5" />, titulo: t("cfg.grAlertas"), sub: t("cfg.subAlertas") },
    { id: "deteccion", icon: <Siren className="h-5 w-5" />, titulo: t("cfg.grDeteccion"), sub: t("cfg.subDeteccion") },
    { id: "emergencia", icon: <UserPlus className="h-5 w-5" />, titulo: t("cfg.grEmergencia"), sub: t("cfg.subEmergencia") },
    ...(pushEstado !== "nativo"
      ? [{ id: "push", icon: <BellRing className="h-5 w-5" />, titulo: t("cfg.push"), sub: t("cfg.subPush") }]
      : []),
  ];

  const seguridadBody = (id: string) => {
    switch (id) {
      case "alertas":
        return (
          <Card className="p-0">
            <Row icon={soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} title={t("cfg.pitidos")} sub={t("cfg.pitidosSub")}>
              <Toggle on={soundOn} onChange={onToggleSound} label={t("cfg.pitidos")} />
            </Row>
            <Row icon={voiceOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} title={t("cfg.avisosVoz")} sub={t("cfg.avisosVozSub")}>
              <Toggle on={voiceOn} onChange={onToggleVoice} label={t("cfg.avisosVoz")} />
            </Row>
            {/* Mensaje de responsabilidad (requerimiento de cumplimiento,
                2026-11-16): texto oficial exigido para las alertas geográficas. */}
            <Row icon={<Info className="h-5 w-5" />} title={t("cfg.disclaimerTitulo")} sub={t("cfg.disclaimerTexto")}>
              <span />
            </Row>
          </Card>
        );
      case "deteccion":
        return (
          <Card className="p-0">
            <Row icon={<Siren className="h-5 w-5" />} title={t("cfg.caida")} sub={t("cfg.caidaSub")}>
              <Toggle on={fallOn} onChange={toggleFall} label={t("cfg.caida")} />
            </Row>
            <Row icon={<ShieldAlert className="h-5 w-5" />} title={t("cfg.confirmEstado")} sub={t("cfg.confirmEstadoSub")}>
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 pb-3.5 pt-2">
              <Seg
                options={[
                  { id: "15", label: "15 s", proOnly: false },
                  { id: "30", label: "30 s", proOnly: false },
                  { id: "60", label: "60 s", proOnly: false },
                ]}
                value={String(confirmSegs)}
                pro={true}
                onPick={pickConfirm}
                onLocked={() => undefined}
              />
            </div>
          </Card>
        );
      case "emergencia":
        return (
          <Card className="p-0">
            <Row icon={<UserPlus className="h-5 w-5" />} title={t("cfg.ice")} sub={t("cfg.iceSub")}>
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 py-3.5">
              <div className="flex flex-col gap-1.5">
                {ice.contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.phone}</p>
                    </div>
                    <button
                      onClick={() => setIce(removeIceContact(c.id))}
                      aria-label={`${t("cfg.iceQuitar")} ${c.name}`}
                      className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-red-500"
                    >
                      {t("cfg.iceQuitar")}
                    </button>
                  </div>
                ))}
                {ice.contacts.length === 0 && (
                  <p className="text-[11.5px] leading-snug text-muted-foreground">{t("cfg.iceEmpty", ICE_MAX)}</p>
                )}
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <input
                  value={iceName}
                  onChange={(e) => setIceName(e.target.value)}
                  placeholder={t("cfg.iceNombre")}
                  maxLength={40}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
                />
                <input
                  value={icePhone}
                  onChange={(e) => setIcePhone(e.target.value)}
                  placeholder={t("cfg.iceTelefono")}
                  maxLength={24}
                  inputMode="tel"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
                />
                <button
                  onClick={addIce}
                  disabled={!iceName.trim() || !icePhone.trim()}
                  className="h-9 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {t("cfg.iceAgregar")}
                </button>
                {iceErr && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{iceErr}</p>
                )}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">{t("cfg.iceNota")}</p>
            </div>
            <Row icon={<BellRing className="h-5 w-5" />} title={t("cfg.iceAuto")} sub={t("cfg.iceAutoSub")}>
              <Toggle on={ice.auto} onChange={toggleIceAuto} label={t("cfg.iceAuto")} />
            </Row>
          </Card>
        );
      case "push":
        return (
          <Card className="p-0">
            <Row icon={<BellRing className="h-5 w-5" />} title={t("cfg.push")} sub={t("cfg.pushSub")}>
              <span />
            </Row>
            <div className="px-4 pb-4">
              {pushEstado === "activado" && (
                <p className="mb-2 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">{t("cfg.pushActivado")}</p>
              )}
              {pushEstado === "denegado" && (
                <p className="mb-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">{t("cfg.pushDenegado")}</p>
              )}
              {pushMsg && (
                <p className="mb-2 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300" role="status">{pushMsg}</p>
              )}
              <div className="flex gap-2">
                {pushEstado === "activado" ? (
                  <>
                    <button
                      onClick={() => void desactivarPush()}
                      disabled={pushBusy}
                      className="h-9 flex-1 rounded-lg border border-border bg-card text-[12px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {t("cfg.pushDesactivar")}
                    </button>
                    <button
                      onClick={() => void probarPush()}
                      disabled={pushBusy}
                      className="h-9 flex-1 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {t("cfg.pushProbar")}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void activarPush()}
                    disabled={pushBusy || pushEstado === "denegado"}
                    className="h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t("cfg.pushActivar")}
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  const menuSeguridad = (
    <>
      {SUBS_SEGURIDAD.map((s2) => (
        <TarjetaMenu key={s2.id} icon={s2.icon} title={s2.titulo} sub={s2.sub} onClick={() => setSub(s2.id)} />
      ))}
    </>
  );

'''
s = s[:i1] + seg + s[i2:]

# ---------- E) SALUD: menú + subpantalla FC ----------
i1, i2 = entre("  // MONITOREO Y SALUD", "  // PERSONALIZACIÓN:")
salud = '''  // MONITOREO Y SALUD: subpantalla de zonas de esfuerzo (FC del
  // sensor BT, fórmula de Karvonen).
  const menuSalud = (
    <TarjetaMenu icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.fc")} sub={t("cfg.subMonitoreo")} onClick={() => setSub("fc")} />
  );

  const saludBody = (id: string) =>
    id === "fc" ? (
      <Card className="p-0">
        <Row icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.fc")} sub={t("cfg.fcSub")}>
          <span />
        </Row>
        <div className="px-4 py-3.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcMax")}</span>
              <input
                value={fcMax}
                onChange={(e) => setFcMax(e.target.value.replace(/\\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="190"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcReposo")}</span>
              <input
                value={fcReposo}
                onChange={(e) => setFcReposo(e.target.value.replace(/\\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="60"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <button
            onClick={guardarFc}
            disabled={fcErr !== null}
            className="mt-2.5 h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {fcOk ? t("cfg.fcOk") : t("cfg.fcGuardar")}
          </button>
          {fcErr && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{fcErr}</p>
          )}
        </div>
      </Card>
    ) : null;

'''
s = s[:i1] + salud + s[i2:]

# ---------- F) PERSONALIZACIÓN: menú + 5 subpantallas ----------
i1, i2 = entre("  // PERSONALIZACIÓN:", "  // ACERCA DE:")
perso = '''  // PERSONALIZACIÓN: subpantallas (v1.12.13): Apariencia (temas y
  // color), Velocímetro (estilo, tamaño, vista previa), Minimapa,
  // Accesibilidad (claro/oscuro) e Idioma.
  const SUBS_PERSO = [
    { id: "apariencia", icon: <Palette className="h-5 w-5" />, titulo: t("cfg.grTemas"), sub: t("cfg.subApariencia") },
    { id: "velocimetro", icon: <Gauge className="h-5 w-5" />, titulo: t("cfg.velocimetro"), sub: t("cfg.subVelocimetro") },
    { id: "minimapa", icon: <Map className="h-5 w-5" />, titulo: t("cfg.minimapa"), sub: t("cfg.subMinimapa") },
    { id: "accesibilidad", icon: <Moon className="h-5 w-5" />, titulo: t("cfg.grAccesibilidad"), sub: t("cfg.temaSub") },
    { id: "idioma", icon: <Languages className="h-5 w-5" />, titulo: t("cfg.grIdioma"), sub: t("cfg.idiomaSub") },
  ];

  const persoBody = (id: string) => {
    switch (id) {
      case "apariencia":
        return (
          <Card className="p-0">
            <Row
              icon={<Palette className="h-5 w-5" />}
              title={t("cfg.temas")}
              sub={t("cfg.temasSub")}
            >
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 py-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.colorApp")}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {THEME_COLORS.map((c) => {
                  const isLocked = c.proOnly && !pro;
                  const active = theme.color === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => (isLocked ? locked(`El tema ${c.label}`) : pick(theme.color, c.id, (v: ThemeColorId) => saveRideTheme({ color: v })))}
                      aria-pressed={active}
                      aria-label={`Tema ${c.label}${isLocked ? " (Pro)" : ""}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                        active ? "border-emerald-500/70 bg-emerald-600/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: c.swatch }} aria-hidden />
                      {c.label}
                      {isLocked && <Lock className="h-3 w-3 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      case "velocimetro":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <div className="flex flex-col gap-2.5">
                <Seg
                  options={SPEEDO_STYLES}
                  value={theme.speedoStyle}
                  pro={pro}
                  onPick={(v: SpeedoStyle) => pick(theme.speedoStyle, v, (x) => saveRideTheme({ speedoStyle: x }))}
                  onLocked={(label) => locked(t("cfg.lockVelocimetro", label.toLowerCase()))}
                />
                <Seg
                  options={SPEEDO_SIZES}
                  value={theme.speedoSize}
                  pro={pro}
                  onPick={(v: SpeedoSize) => pick(theme.speedoSize, v, (x) => saveRideTheme({ speedoSize: x }))}
                  onLocked={(label) => locked(t("cfg.lockTamano", label.toLowerCase()))}
                />
              </div>
              {/* Vista previa con 27 km/h (cerca del límite del parque) */}
              <div className="mt-3 rounded-xl border border-border/70 bg-background/50 px-3 py-3">
                <Speedometer speedKmh={27} idle={false} over={false} caution={true} inPark={true} style={theme.speedoStyle} size={theme.speedoSize} />
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{t("cfg.vistaPrevia")}</p>
              </div>
            </div>
          </Card>
        );
      case "minimapa":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <Seg
                options={MINIMAP_SIZES}
                value={theme.minimapSize}
                pro={pro}
                onPick={(v: MinimapSize) => pick(theme.minimapSize, v, (x) => saveRideTheme({ minimapSize: x }))}
                onLocked={(label) => locked(`El minimapa ${label.toLowerCase()}`)}
              />
            </div>
          </Card>
        );
      case "accesibilidad":
        return (
          <Card className="p-0">
            <Row icon={<Moon className="h-5 w-5" />} title={t("cfg.tema")} sub={t("cfg.temaSub")}>
              <ThemeIconButton />
            </Row>
          </Card>
        );
      case "idioma":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <p className="text-[13.5px] font-semibold text-foreground">{t("cfg.idioma")}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("cfg.idiomaSub")}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(["es", "en", "pt"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      lang === l
                        ? "border-transparent bg-emerald-600 text-(--c30-on-accent)"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "es" ? t("cfg.esp") : l === "en" ? t("cfg.eng") : t("cfg.port")}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  const menuPerso = (
    <>
      {SUBS_PERSO.map((s2) => (
        <TarjetaMenu key={s2.id} icon={s2.icon} title={s2.titulo} sub={s2.sub} onClick={() => setSub(s2.id)} />
      ))}
    </>
  );

'''
s = s[:i1] + perso + s[i2:]

# ---------- G) render: menú General resetea sub + navegación nivel 3 ----------
a = '''          <TarjetaMenu icon={<Siren className="h-5 w-5" />} title={t("cfg.grSeguridad")} sub={t("cfg.subSeguridad")} onClick={() => setCard("seguridad")} />
          <TarjetaMenu icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.grSalud")} sub={t("cfg.subSalud")} onClick={() => setCard("salud")} />
          <TarjetaMenu icon={<Palette className="h-5 w-5" />} title={t("cfg.grPersonalizacion")} sub={t("cfg.subPersonalizacion")} onClick={() => setCard("personalizacion")} />'''
assert a in s
s = s.replace(a, '''          <TarjetaMenu icon={<Siren className="h-5 w-5" />} title={t("cfg.grSeguridad")} sub={t("cfg.subSeguridad")} onClick={() => { setCard("seguridad"); setSub(null); }} />
          <TarjetaMenu icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.grSalud")} sub={t("cfg.subSalud")} onClick={() => { setCard("salud"); setSub(null); }} />
          <TarjetaMenu icon={<Palette className="h-5 w-5" />} title={t("cfg.grPersonalizacion")} sub={t("cfg.subPersonalizacion")} onClick={() => { setCard("personalizacion"); setSub(null); }} />''')

a = '''      {seccion === "general" && card === "seguridad" && (
        <>
          {headerSub(t("cfg.grSeguridad"))}
          {seguridadCard}
        </>
      )}

      {seccion === "general" && card === "salud" && (
        <>
          {headerSub(t("cfg.grSalud"))}
          {saludCard}
        </>
      )}

      {seccion === "general" && card === "personalizacion" && (
        <>
          {headerSub(t("cfg.grPersonalizacion"))}
          {personalizacionCard}
        </>
      )}
'''
assert a in s
s = s.replace(a, '''      {seccion === "general" && card === "seguridad" && (
        <>
          {headerSub(sub ? SUBS_SEGURIDAD.find((x) => x.id === sub)?.titulo ?? t("cfg.grSeguridad") : t("cfg.grSeguridad"))}
          {sub ? seguridadBody(sub) : menuSeguridad}
        </>
      )}

      {seccion === "general" && card === "salud" && (
        <>
          {headerSub(sub ? t("cfg.fc") : t("cfg.grSalud"))}
          {sub ? saludBody(sub) : menuSalud}
        </>
      )}

      {seccion === "general" && card === "personalizacion" && (
        <>
          {headerSub(sub ? SUBS_PERSO.find((x) => x.id === sub)?.titulo ?? t("cfg.grPersonalizacion") : t("cfg.grPersonalizacion"))}
          {sub ? persoBody(sub) : menuPerso}
          {proNote && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{proNote}</span>
              <button onClick={onGoPro} className="shrink-0 font-extrabold underline underline-offset-2">
                {t("cfg.verPlanes")}
              </button>
            </div>
          )}
          {!pro && !proNote && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("cfg.proFoot")}
            </p>
          )}
        </>
      )}
''')

# ---------- H) SubTabs onChange también resetea sub ----------
a = '''          setSeccion(k as SeccionCfg);
          setCard("menu");'''
assert a in s
s = s.replace(a, '''          setSeccion(k as SeccionCfg);
          setCard("menu");
          setSub(null);''')

p.write_text(s)
print(f"ConfigTab.tsx: {orig_len} -> {len(s)} chars")

# ---------- I) i18n: claves nuevas ----------
pi = pathlib.Path("src/lib/i18n.ts")
si = pi.read_text()
a = '  "cfg.lockTamano": ["El tamaño {0} del velocímetro", "The {0} speedometer size", "O tamanho {0} do velocímetro"],'
assert a in si
si = si.replace(a, a + '''
  // Subpantallas de segundo nivel (v1.12.13): General → Seguridad →
  // Alertas, etc. Botón de regreso renombrado a «Volver».
  "cfg.volver": ["Volver", "Back", "Voltar"],
  "cfg.subAlertas": ["Pitidos de velocidad y avisos de voz", "Speed beeps and voice alerts", "Bipes de velocidade e avisos de voz"],
  "cfg.subDeteccion": ["Detección de caídas y estado", "Fall detection and status check", "Detecção de quedas e checagem de estado"],
  "cfg.subEmergencia": ["Contactos de emergencia (ICE)", "Emergency contacts (ICE)", "Contatos de emergência (ICE)"],
  "cfg.subPush": ["Avisos del parque en el navegador", "Park notices in the browser", "Avisos do parque no navegador"],
  "cfg.subMonitoreo": ["Zonas de esfuerzo con el sensor BT", "Effort zones with the BT sensor", "Zonas de esforço com o sensor BT"],
  "cfg.subApariencia": ["Temas de color de la app", "App color themes", "Temas de cor do app"],
  "cfg.subVelocimetro": ["Estilo, tamaño y vista previa", "Style, size and preview", "Estilo, tamanho e pré-visualização"],
  "cfg.subMinimapa": ["Tamaño del minimapa de navegación", "Navigation minimap size", "Tamanho do minimapa de navegação"],''')
pi.write_text(si)
print(f"i18n.ts: +9 claves (cfg.volver + 8 subs)")
print("REFACTOR OK")
