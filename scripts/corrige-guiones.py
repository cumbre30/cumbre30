#!/usr/bin/env python3
# ============================================================
# Corrección de guiones largos (—) en textos VISIBLES de la app
# y la web (pedido del cliente, 2026-11-21):
#   · Separadores de título/explicación → dos puntos ": "
#   · Separadores de chip/banner → punto medio " · " (estilo ya
#     dominante en el diccionario: "{0} intentos · último…")
#   · Prefijo "— {t('bib.sinElev')}" en KPI de elevación → solo
#     el texto (la etiqueta del KPI ya dice ELEVACIÓN).
#   · De paso: truncamiento pt de pub.titulo («da proteç» →
#     «da proteção»), bug preexistente.
# Se CONSERVAN a propósito:
#   · Los "—" como marcador de SIN DATO en las imágenes para
#     compartir (shareAdn.ts, convención estándar de tablas).
#   · Todos los guiones largos en COMENTARIOS de código.
#   · Los guiones ASCII " - " (guiones cortos, fuera del pedido).
# ============================================================
import re, sys

CAMBIOS_I18N = {
    419:  (" — ", ": "),   # edi.titulo (título + instrucción, 3 idiomas)
    432:  (" — ", ": "),   # edi.sugerenciaPreliminar
    491:  (" — ", ": "),   # bib.tiempoSub (frase explicativa)
    493:  (" — ", ": "),   # bib.tiempoLeyenda
    496:  (" — ", " · "),  # bib.bannerVigente (chip estado + cualificador)
    497:  (" — ", " · "),  # bib.bannerAvisos
    498:  (" — ", " · "),  # bib.bannerSinRevisar
    511:  (" — ", ": "),   # pub.titulo (título + subtítulo)
    559:  (" — ", ": "),   # cat.gpxNota (frase explicativa)
}

TRUNC_PT = ('"Publicar rota — pré-visualização da proteç"', None)  # se resuelve tras el reemplazo de 511

ARCHIVOS_JSX = {
    "src/components/BibliotecaRutas.tsx": ('>— {t("bib.sinElev")}<', '>{t("bib.sinElev")}<'),
    "src/components/CatalogoTab.tsx":     ('>— {t("bib.sinElev")}<', '>{t("bib.sinElev")}<'),
}

def main():
    ok = True
    # 1) i18n: reemplazos por línea
    ruta = "src/lib/i18n.ts"
    lineas = open(ruta, encoding="utf-8").read().splitlines()
    for num, (viejo, nuevo) in CAMBIOS_I18N.items():
        idx = num - 1
        if viejo not in lineas[idx]:
            print(f"FALLO: línea {num} no contiene '{viejo}': {lineas[idx][:80]}")
            ok = False
            continue
        lineas[idx] = lineas[idx].replace(viejo, nuevo)
        print(f"✓ i18n:{num} {viejo.strip()} → {nuevo.strip()}")
    texto = "\n".join(lineas) + ("\n" if open(ruta, encoding="utf-8").read().endswith("\n") else "")
    # 2) truncamiento pt en pub.titulo (después del reemplazo ya sin guión largo)
    if 'pré-visualização da proteç"' in texto:
        texto = texto.replace('pré-visualização da proteç"', 'pré-visualização da proteção"')
        print("✓ i18n: pub.titulo pt truncado → «pré-visualização da proteção»")
    open(ruta, "w", encoding="utf-8").write(texto)

    # 3) prefijos visibles en JSX
    for ruta_jsx, (viejo, nuevo) in ARCHIVOS_JSX.items():
        t = open(ruta_jsx, encoding="utf-8").read()
        n = t.count(viejo)
        if n == 0:
            print(f"FALLO: {ruta_jsx} sin el patrón esperado")
            ok = False
            continue
        open(ruta_jsx, "w", encoding="utf-8").write(t.replace(viejo, nuevo))
        print(f"✓ {ruta_jsx}: {n} prefijo(s) «— » retirados del KPI de elevación")

    # 4) verificación final: sin guiones largos en VALORES del diccionario
    restantes = []
    for i, l in enumerate(open(ruta, encoding="utf-8").read().splitlines(), 1):
        if "—" in l and re.match(r'\s*"[a-z]+\.[a-zA-Z0-9]+":\s*\[', l):
            restantes.append(i)
    if restantes:
        print(f"FALLO: quedan guiones largos en valores de i18n: líneas {restantes}")
        ok = False
    else:
        print("✓ i18n: 0 guiones largos en valores visibles (quedan solo comentarios)")
    sys.exit(0 if ok else 1)

main()
