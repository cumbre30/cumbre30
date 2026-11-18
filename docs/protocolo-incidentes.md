# Protocolo de incidentes de seguridad - Cumbre30

**Documento interno** (corrección C-07 de la auditoría, 2026-11-18). La app no es operador de importancia vital de la Ley 21.663, pero adopta voluntariamente este protocolo alineado con las obligaciones de notificación de brechas de la Ley 21.719 y con las políticas de Google Play.

**Responsable de activarlo:** titular del proyecto. **Contacto:** contacto.cumbre30@gmail.com + WhatsApp +56 9 4296 1619.

## 1. Detección y registro

- Fuentes: logs de Vercel, reportes de usuarios (soporte), avisos de proveedores (Neon, Mercado Pago, Google), monitoreo manual periódico.
- Al detectar un incidente, registrar de inmediato: fecha y hora de detección, descripción, sistemas y datos afectados, número estimado de titulares, quién lo detecta. Plantilla: crear nota en `docs/incidentes/` con nombre `YYYY-MM-DD-titulo.md`.
- Severidad inicial: baja (sin datos personales), media (acceso no autorizado posible), alta (confirmación de exfiltración o alteración de datos personales).

## 2. Contención (primeras 24 horas)

1. Revocar sesiones: desde el servidor, `db.session.deleteMany()` para las cuentas afectadas (o todas, si el compromiso es global).
2. Rotar secretos en `.env` de Vercel: ADMIN_KEY, PUSH_ADMIN_KEY, MP_SYNC_TOKEN, VAPID_PRIVATE_KEY, GMAIL_APP_PASSWORD, MP_ACCESS_TOKEN (si el proveedor lo permite) y DATABASE_URL si hubo exposición.
3. Revertir el despliegue a la última versión sana (Redeploy en Vercel) si el incidente vino de un cambio de código.
4. Desactivar temporalmente la función afectada (por ejemplo, envío de push o API de rides) si la contención lo exige.

## 3. Evaluación

- Determinar exactamente qué datos personales estuvieron expuestos usando el Registro de actividades de tratamiento (`docs/registro-tratamiento.md`) y el esquema Prisma.
- Clasificar: datos de contacto, estadísticas deportivas, coordenadas (recordar: las pistas GPS completas no salen del dispositivo, así que un incidente de servidor no las expone), credenciales, datos de terceros (contactos ICE: solo locales).
- Riesgo para los titulares: decidir si el incidente "puede resultar en un riesgo para los derechos y libertades" (umbral de notificación de la ley de datos).

## 4. Notificación

- Si se confirma exposición de datos personales: notificar a los titulares afectados por los canales disponibles (aviso en la app, correo, página del sitio) con qué pasó, qué datos, qué estamos haciendo y qué pueden hacer.
- Notificar a la autoridad de protección de datos según los plazos y canales vigentes al momento del incidente (durante la transición: sistema de la Ley 19.628 y su autoridad competente; tras la vigencia de la Ley 21.719: la Agencia, en el plazo legal).
- Notificar a Google Play (consola de desarrollador) si el incidente afecta a usuarios de la distribución oficial.
- Documentar el envío (copias con fecha) en la carpeta del incidente.

## 5. Cierre y aprendizaje

- Post-mortem escrito: causa raíz, contención aplicada, plazos efectivos, lecciones.
- Actualizar este protocolo y el manual de seguridad si el post-mortem revela un control faltante.
- Simulacro de mesa al menos una vez al año: simular una fuga de MP_SYNC_TOKEN y recorrer los pasos 1 a 4; guardar el acta.

## Anexo: secretos del proyecto y dónde rotan

| Secreto | Dónde vive | Cómo rotar |
| --- | --- | --- |
| ADMIN_KEY | .env de Vercel (solo servidor) | Generar hex de 32 bytes y actualizar Vercel; redeploy |
| PUSH_ADMIN_KEY | .env de Vercel | Igual |
| MP_SYNC_TOKEN | .env de Vercel + cron externo | Igual; actualizar cron-job.org |
| VAPID_PRIVATE_KEY | .env de Vercel | Rotar invalida suscripciones push existentes: avisar |
| GMAIL_APP_PASSWORD | Cuenta Gmail del titular | Revocar en la cuenta de Google y crear nueva |
| MP_ACCESS_TOKEN | .env de Vercel (Mercado Pago) | Rotar desde las credenciales de MP |
| DATABASE_URL | .env de Vercel (Neon) | Rotar credenciales en Neon |
| Secreto de licencias Pro (vigente) | Variable de entorno PRO_LICENSE_SECRET de Vercel (solo servidor) | Generar hex de 32 bytes, actualizar la env de Vercel y redeploy; los códigos viejos siguen validando con el legado. NUNCA hardcodearlo en el repo (es público) ni dejarlo en scripts/gen-license.mjs, que ahora la lee del entorno |
| Secreto de licencias Pro (legado) | proLicenseCore.ts, dentro del APK | No rota: es inherentemente público por la validación offline; solo cubre códigos emitidos antes de la rotación |

## Incidente 2026-11-18: secreto de licencias en repo público (post-mortem breve)

Durante el release v1.13.0 se detectó que el secreto de licencias rotado había
quedado como constante en `src/lib/proLicenseServer.ts` y
`scripts/gen-license.mjs`. Como el repo de GitHub es público, cualquiera pudo
leerlo desde el push de hoy. Impacto real: ~35 minutos de deploy con ese
secreto y con la generación admin bloqueada (sin ADMIN_KEY en Vercel), por lo
que no se emitió ningún código afectado.

Correcciones aplicadas:
- El secreto vigente vive solo en la env `PRO_LICENSE_SECRET` de Vercel y fue
  rotado de nuevo (el valor filtrado quedó invalidado; verificado con prueba
  negativa en `/api/licencia/validar`).
- `gen-license.mjs` lee `PRO_LICENSE_SECRET` del entorno y aborta si falta.
- Se crearon en Vercel las envs faltantes `ADMIN_KEY`, `PUSH_ADMIN_KEY` y
  `PRO_LICENSE_SECRET` (Production).
- Lección: ningún secreto de servidor debe entrar jamás al repo; el APK ya
  contiene el secreto legado por diseño (offline), y ese no rota.
