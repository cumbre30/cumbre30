#!/usr/bin/env python3
# Rename Perfil → Cuenta en toda la app + páginas (v1.13.15).
# Solo cambian TEXTOS visibles; los identificadores internos
# (go("perfil"), claves i18n menu.perfil / pf.* / pg.cargandoPerfil)
# se mantienen estables. "Compartir perfil" NO cambia: se traslada
# al nuevo Perfil Ciclista en la Fase 1 (decisión del cliente).
import re, sys

P = "/home/z/my-project/src/lib/i18n.ts"
s = open(P).read()
orig = s

# (clave, [es, en, pt] NUEVOS) — los 3 elementos siempre presentes.
CAMBIOS = {
    "menu.perfil":        ["Cuenta", "Account", "Conta"],
    "cfg.pushSesion":     ["Inicia sesión en Cuenta para recibir la prueba.",
                           "Sign in under Account to receive the test.",
                           "Entre em Conta para receber o teste."],
    "his.linkNecesitaServer": ["El enlace público necesita el servidor de cuenta: configúralo en Cuenta › Mis datos.",
                               "The public link needs the account server: set it up in Account › My data.",
                               "O link público precisa do servidor de conta: configure em Conta › Meus dados."],
    "his.linkPideSesion": ["Inicia sesión en Cuenta › Mis datos para crear el enlace público.",
                           "Sign in in Account › My data to create the public link.",
                           "Entre em Conta › Meus dados para criar o link público."],
    "his.cuotaConstancias": ["Este mes ya usaste tus {0} constancias gratis. Con Cumbre30 Pro (Cuenta → Pagos y suscripciones) son ilimitadas.",
                             "You already used your {0} free certificates this month. With Cumbre30 Pro (Account → Payments and subscriptions) they are unlimited.",
                             "Você já usou suas {0} constâncias grátis neste mês. Com Cumbre30 Pro (Conta → Pagamentos e assinaturas) são ilimitadas."],
    "his.gpxPro":         ["El export GPX es parte de Cumbre30 Pro - actívalo en Cuenta → Pagos y suscripciones.",
                           "GPX export is part of Cumbre30 Pro - enable it in Account → Payments and subscriptions.",
                           "A exportação GPX é parte do Cumbre30 Pro - ative em Conta → Pagamentos e assinaturas."],
    "his.localesNota":    ["Estos viajes son locales del dispositivo. Inicia sesión en Cuenta y quedarán enlazados a tu correo automáticamente.",
                           "These rides are local to the device. Sign in under Account and they will be linked to your email automatically.",
                           "Esses passeios são locais do dispositivo. Entre em Conta e ficarão vinculados ao seu e-mail automaticamente."],
    "pf.subAria":         ["Subsecciones de Cuenta", "Account subsections", "Subseções de Conta"],
    "pf.resetOffline":    ["Tu cuenta vive en este dispositivo: ingresa el código de recuperación que te mostramos en Cuenta → Mis datos (con la sesión iniciada).",
                           "Your account lives on this device: enter the recovery code we showed you in Account → My data (while signed in).",
                           "Sua conta vive neste dispositivo: digite o código de recuperação que mostramos em Conta → Meus dados (com a sessão iniciada)."],
    "pf.cargandoPerfil":  ["Cargando cuenta…", "Loading account…", "Carregando conta…"],
    "am.noBackend":       ["Los amigos necesitan el servidor de cuenta. Configúralo en Cuenta › Mis datos › Servidor de cuenta y vuelve a esta pantalla.",
                           "Friends need the account server. Set it up in Account › My data › Account server and come back to this screen.",
                           "Os amigos precisam do servidor de conta. Configure em Conta › Meus dados › Servidor de conta e volte a esta tela."],
    "am.nota":            ["Al agregar a alguien la conexión es mutua e inmediata: verás sus km y logros, y aparecerás en su lista. Las medallas 🥇🥈🥉 ordenan por km totales. El nombre de usuario se cambia en Cuenta (1 vez cada 30 días).",
                           "When you add someone the connection is mutual and instant: you will see their km and achievements, and you will appear on their list. The 🥇🥈🥉 medals sort by total km. The username is changed in Account (once every 30 days).",
                           "Ao adicionar alguém a conexão é mútua e imediata: você verá os km e conquistas da pessoa, e aparecerá na lista dela. As medalhas 🥇🥈🥉 ordenam por km totais. O nome de usuário é alterado em Conta (1 vez a cada 30 dias)."],
    "pg.cargandoPerfil":  ["Cargando cuenta…", "Loading account…", "Carregando conta…"],
    "plan.perfilPagos":   ["Cuenta → Pagos y suscripciones", "Account → Payments and subscriptions", "Conta → Pagamentos e assinaturas"],
    "plan.yaPagaste2":    [" (Cuenta).", " (Account).", " (Conta)."],
    "ay.privacidadEliminacion": [
        "Eliminación: puedes borrar cada viaje desde Mis viajes, desuscribirte de los avisos push en Configuración y eliminar tu cuenta completa con todos sus datos del servidor desde Cuenta → Mis datos → Eliminar cuenta.",
        "Deletion: you can delete each ride from My rides, unsubscribe from push alerts in Settings, and delete your whole account with all its server data from Account › My data › Delete account.",
        "Eliminação: você pode apagar cada passeio em Meus passeios, cancelar os alertas push em Configurações e eliminar sua conta completa com todos os dados do servidor em Conta › Meus dados › Eliminar conta.",
    ],
}

def reemplazar_clave(src, clave, nuevos):
    # Encuentra la definición de la clave y reemplaza TODO el array de 3.
    pat = re.compile(r'("' + re.escape(clave) + r'":\s*\[)([^\]]*\](?=\])|[^\]]*\][^\]]*)(\],)', re.S)
    # Más simple y seguro: localizar la clave y reconstruir el array literal.
    idx = src.find('"' + clave + '":')
    assert idx != -1, f"clave no encontrada: {clave}"
    ini = src.find("[", idx)
    fin = src.find("],", ini)
    assert ini != -1 and fin != -1, f"array no encontrado: {clave}"
    nuevo = "[" + ", ".join('"%s"' % x for x in nuevos) + "],"
    return src[:ini] + nuevo + src[fin + 2:]

for clave, nuevos in CAMBIOS.items():
    s = reemplazar_clave(s, clave, nuevos)

# Comentarios de cabecera (precisión para el mantenimiento futuro).
s = s.replace("Las pantallas de gestión (Historial/Stats/Perfil/Ayuda)",
              "Las pantallas de gestión (Historial/Stats/Cuenta/Ayuda)")
s = s.replace("// ---------- Perfil / cuenta (fase 2) ----------",
              "// ---------- Cuenta (antes «Perfil»; el nombre queda reservado para el Perfil Ciclista, fase 1) ----------")

open(P, "w").write(s)
print(f"i18n.ts: {len(CAMBIOS)} claves reescritas  ({len(orig)} → {len(s)} bytes)")

# ---------- Páginas legales + comentarios de código ----------
for ruta, pares in [
    ("/home/z/my-project/src/app/terminos/page.tsx",
     [("desde Perfil › Mis datos › Eliminar cuenta", "desde Cuenta › Mis datos › Eliminar cuenta")]),
    ("/home/z/my-project/src/app/privacidad/page.tsx",
     [("(Perfil › Mis datos ›", "(Cuenta › Mis datos ›")]),
    ("/home/z/my-project/src/app/eliminar-cuenta/page.tsx",
     [("abre <span className=\"font-medium text-foreground\">Perfil</span>",
       "abre <span className=\"font-medium text-foreground\">Cuenta</span>")]),
    ("/home/z/my-project/src/components/ProfileTab.tsx",
     [("// Pestaña Perfil - con subsecciones (solo se ve la activa):",
       "// Pestaña Cuenta (antes «Perfil»; el nombre pasa al Perfil Ciclista) - con subsecciones (solo se ve la activa):")]),
    ("/home/z/my-project/src/components/AppDrawer.tsx",
     [("{/* Zona 3: Cuenta - Perfil abre subsecciones (datos/pagos) */}",
       "{/* Zona 3: Cuenta - abre subsecciones (datos/pagos) */}")]),
]:
    t = open(ruta).read()
    for viejo, nuevo in pares:
        assert viejo in t, f"no encontrado en {ruta}: {viejo[:60]}"
        t = t.replace(viejo, nuevo)
    open(ruta, "w").write(t)
    print(f"{ruta.split('/')[-1]}: ok")
