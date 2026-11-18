# -*- coding: utf-8 -*-
"""Genera PLAN_REMEDIACION_CUMBRE30.md y CHECKLIST_LANZAMIENTO_CUMBRE30.md
desde los módulos central de datos (aud_plan.py)."""
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
from aud_plan import REMEDIACION, CHECKLIST

OUT = "/home/z/my-project/download/auditoria-cumbre30"

FASES = {
    "A": ("Fase A — Bloqueantes de lanzamiento",
          "Problemas que impiden publicar responsablemente en Chile (alimentos de Play Store y del régimen de datos)."),
    "B": ("Fase B — Correcciones de alta prioridad",
          "Deben resolverse antes de habilitar los módulos relacionados (sensores, Pro, comunidad, emergencias)."),
    "C": ("Fase C — Mejoras de cumplimiento",
          "Controles adicionales que robustecen la aplicación, sin bloquear el lanzamiento."),
    "D": ("Fase D — Preparación comercial",
          "Necesarios para suscripciones, publicidad y colaboraciones futuras."),
}

lines = []
lines.append("# PLAN DE REMEDIACIÓN — Cumbre30")
lines.append("")
lines.append("**Auditoría pre-lanzamiento Chile · Diagnóstico (sin modificaciones de código)**")
lines.append("")
lines.append("Fecha: 2026-11-18 · Fuente: inspección del repositorio + investigación normativa. "
             "Este plan NO se ejecuta hasta recibir autorización expresa del propietario.")
lines.append("")
lines.append("Resumen: %d correcciones — %d bloqueantes (Fase A), %d de alta prioridad (B), %d mejoras (C), %d comerciales (D)."
             % (len(REMEDIACION),
                sum(1 for r in REMEDIACION if r[1] == "A"),
                sum(1 for r in REMEDIACION if r[1] == "B"),
                sum(1 for r in REMEDIACION if r[1] == "C"),
                sum(1 for r in REMEDIACION if r[1] == "D")))
lines.append("")
for fase in ["A", "B", "C", "D"]:
    titulo, desc = FASES[fase]
    lines.append(f"## {titulo}")
    lines.append("")
    lines.append(desc)
    lines.append("")
    for r in REMEDIACION:
        if r[1] != fase:
            continue
        (rid, _f, desc2, mod, files, cambio, impacto, reg, prueba, dep) = r
        lines.append(f"### {rid} — {desc2.split('.')[0]}")
        lines.append("")
        lines.append(f"- **Módulo:** {mod}")
        lines.append(f"- **Cambio requerido:** {cambio}")
        lines.append(f"- **Archivos involucrados:** {files}")
        lines.append(f"- **Impacto en funcionalidades:** {impacto}")
        lines.append(f"- **Riesgo de regresión:** {reg}")
        lines.append(f"- **Prueba de aceptación:** {prueba}")
        lines.append(f"- **Dependencias:** {dep if dep != '—' else 'ninguna'}")
        lines.append("")
lines.append("## Pendientes de decisión del propietario")
lines.append("")
lines.append("1. Autorizar la ejecución de las Fases A y B antes de cualquier publicación.")
lines.append("2. Confirmar fecha objetivo de lanzamiento frente a las vigencias: registro Pedalea Seguro "
             "15-dic-2026; Ley 21.719 (premisa 1-dic-2026; Congreso aprobó postergarla al 15-oct-2027, "
             "pendiente de publicación); políticas de ubicación de Google Play obligatorias 27-ene-2027.")
lines.append("3. Decidir edad mínima de la app (13/14) con el abogado.")
lines.append("4. Aprobar el contacto con Parquemet para obtener la base normativa de las geocercas oficiales.")
lines.append("")
with open(f"{OUT}/PLAN_REMEDIACION_CUMBRE30.md", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

cl = []
cl.append("# CHECKLIST DE LANZAMIENTO — Cumbre30")
cl.append("")
cl.append("**Auditoría pre-lanzamiento Chile · 2026-11-18 · EJECUCIÓN AUTORIZADA POR EL PROPIETARIO**")
cl.append("")
cl.append("Marco: [PLAN_REMEDIACION_CUMBRE30.md](PLAN_REMEDIACION_CUMBRE30.md). "
          "Nada de este checklist se marca completo sin la evidencia indicada.")
cl.append("")
cl.append("## Estado de ejecución (2026-11-18)")
cl.append("")
cl.append("Fases A, B y C implementadas en el repositorio: 28 archivos modificados o creados. "
          "TypeScript sin errores en `src/`, ESLint limpio en los archivos nuevos, regresión de "
          "geocercas en verde y prueba de rotación de licencias aprobada. Los ítems de Fase D "
          "requieren actores externos (contador, INAPI, Play Console, DPA de proveedores).")
cl.append("")
cl.append("IMPORTANTE para el despliegue: los códigos Pro nuevos usan el secreto vigente que "
          "solo vive en el servidor (`src/lib/proLicenseServer.ts` y `scripts/gen-license.mjs`), "
          "y la validación en línea usa la ruta nueva `/api/licencia/validar`. El orden correcto "
          "es: 1) desplegar la web/API en Vercel; 2) recién entonces publicar el APK nuevo. Un "
          "APK antiguo no puede validar códigos nuevos, y una web nueva sin el APK actualizado "
          "solo afecta a la activación offline de códigos nuevos.")
cl.append("")
cl.append("| # | Ítem | Fase | Criterio de listo | Estado |")
cl.append("| --- | --- | --- | --- | --- |")

ESTADOS = {
    "1": "HECHO: /terminos y /privacidad completados (secciones ICE, sensores de salud, geocoders, push, menores, retención, transferencias) y enlazados desde Ayuda; aceptación con checkbox al registrarse",
    "2": "HECHO: docs/registro-tratamiento.md (12 actividades, encargados, medidas)",
    "3": "HECHO en código: android:allowBackup=false; falta la prueba en dispositivo físico antes de publicar el APK",
    "4": "HECHO: BannerPedalea (cierre con fecha, hasta 2027-01-31) + vigencia automática en geocercas oficiales + campo vigencia en el popup",
    "5": "HECHO en código: consentimiento explícito en SensorPanel antes de emparejar el pulso; la prueba de no persistencia sigue pendiente de ejecución dinámica",
    "6": "HECHO: sección ICE en la política + texto de límites visible en Configuración, Detección de caídas",
    "7": "HECHO: secreto rotado (solo servidor), /api/licencia/validar, cliente server-first con grandfathering; probado con scripts/test-licencia-rotacion.ts",
    "8": "HECHO: throttle de 1,1 s en geocode.ts + destinatarios informados en la política",
    "9": "HECHO: confirmación de 14 años exigida en UI y API de registro",
    "10": "HECHO: rate limiting (login 5/min, registro 5/min, forgot 3/10 min, validar licencias 10/min) + contraseñas de 8 en todos los flujos",
    "11": "HECHO: DELETE /api/auth/sessions + botón en Perfil; el reset de contraseña ya cerraba todas las sesiones",
    "12": "HECHO: username enmascarado (3 caracteres + ***) y nota de privacidad en /verificar",
    "13": "HECHO: comparación timing-safe y clave por cabecera en licencia, push/send y mp/sync",
    "14": "HECHO: etiqueta qr.etiqueta (es/en/pt) bajo la credencial en Wallet",
    "15": "HECHO: public/THIRD-PARTY-NOTICES.md + enlace desde Ayuda; attribution de MiniMap y mapa grande verificada (compact:false)",
    "16": "HECHO: docs/protocolo-incidentes.md (con tabla de rotación de secretos); simulacro anual pendiente",
    "17": "HECHO: ya existía en /terminos (revisión dentro de 10 días, precios, código por correo); verificado",
    "18": "PENDIENTE: requiere contador/abogado del propietario",
    "19": "PENDIENTE: búsqueda y registro en INAPI (acción externa)",
    "20": "PENDIENTE: Play Console (Data Safety, Location Permissions 2027)",
    "21": "PENDIENTE: revisar y registrar DPA de Neon/Vercel/Google/Mercado Pago",
    "22": "HECHO: export JSON desde Perfil (lib/exportDatos.ts + botón)",
}
for (n, item, fase, criterio) in CHECKLIST:
    cl.append(f"| {n} | {item} | {fase} | {criterio} | {ESTADOS.get(n, 'PENDIENTE')} |")
cl.append("")
cl.append("## Puertas de lanzamiento")
cl.append("")
cl.append("- [x] Fase A implementada (pendiente solo la prueba de backup en dispositivo físico).")
cl.append("- [x] Fase B implementada (pendiente prueba dinámica de no persistencia de pulso).")
cl.append("- [x] Fase C implementada (pendiente simulacro anual del protocolo de incidentes).")
cl.append("- [ ] Fase D con actores externos (tributario, INAPI, Play Console, DPA).")
cl.append("- [ ] Desplegar web/API antes de publicar el APK nuevo (secreto de licencias).")
cl.append("- [ ] Calendario normativo verificado la semana del lanzamiento (21.719, Pedalea Seguro, políticas Play).")
cl.append("- [ ] Toda comunicación pública sin promesas no implementadas (p. ej. 'llamamos a emergencias por ti' está PROHIBIDA).")
cl.append("")
with open(f"{OUT}/CHECKLIST_LANZAMIENTO_CUMBRE30.md", "w", encoding="utf-8") as f:
    f.write("\n".join(cl))

print("MD_OK", len(lines), len(cl))
