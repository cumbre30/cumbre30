# Auto-gestión de códigos Cumbre30 Pro

Objetivo: que cada venta de la página `/pro` ($6.500, link de cobro único de
Mercado Pago) entregue el código `C30P-` **automáticamente por correo**, sin
que tengas que generar nada a mano.

## Cómo funciona

```
Comprador paga $6.500 en /pro (Mercado Pago)
        │
        ▼
Cumbre30 (servidor web desplegado)
  1. Webhook /api/mp/webhook  ← aviso inmediato de MP (camino rápido)
  2. Cron → /api/mp/sync      ← revisa pagos cada 15 min (red de seguridad)
        │
        ▼
  Verifica el pago CONTRA la API de Mercado Pago (nunca confía en el aviso):
  ¿aprobado? ¿CLP? ¿exactamente $6.500? ¿no es un aporte?
        │
        ▼
  Genera el código = HMAC(correo del comprador)   ← el mismo de gen-license.mjs
  Envía el correo con la plantilla (Gmail SMTP)
  Registra el envío en la tabla ProDelivery       ← un pago = UN correo, siempre
```

Si el webhook falla (SMTP caído, etc.), el cron de los 15 minutos siguiente
detecta el pago sin entrega y lo manda. Si ambos fallan, siempre queda el
respaldo manual (paso 5).

## Configuración (una sola vez, ~20 minutos)

### 1. Token de producción de Mercado Pago

1. Entra a mercadopago.cl → **Tu negocio → Tus integraciones** → crea una
   aplicación (ej. "Cumbre30") si no tienes.
2. En la app → **Credenciales de producción** → copia el **Access Token**
   (empieza con `APP_USR-`).
3. Esa es la variable `MP_ACCESS_TOKEN`. Con ella el servidor puede LEER los
   pagos de tu cuenta (incluidos los hechos por tus links de pago).

### 2. Contraseña de aplicación de Gmail (para enviar los correos)

1. Ve a myaccount.google.com → **Seguridad** → activa **Verificación en
   2 pasos** si no la tienes.
2. Busca **Contraseñas de aplicaciones** → crea una llamada `Cumbre30`.
3. Google te da 16 caracteres → esa es `GMAIL_APP_PASSWORD`.
4. `GMAIL_USER` = `contacto.cumbre30@gmail.com` (o el correo que uses).

> Los correos salen desde tu propio Gmail: los compradores ven un remitente
> real y pueden responder. Gmail permite ~500 correos/día: sobrado.

### 3. Secreto para el cron y el respaldo manual

```bash
openssl rand -hex 32   # ese valor es MP_SYNC_TOKEN
```

### 4. Variables de entorno del servidor (Vercel / tu hosting)

```
MP_ACCESS_TOKEN=APP_USR-...
GMAIL_USER=contacto.cumbre30@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
MP_SYNC_TOKEN=<el hex del paso 3>
MP_PRO_AMOUNT=6500
```

## Programar la revisión automática (cron)

Opción simple y gratis: **cron-job.org**

1. Crea cuenta → **Create cronjob**.
2. URL: `https://TU-DOMINIO/api/mp/sync?token=<MP_SYNC_TOKEN>`
3. Frecuencia: cada 15 minutos.

Opcional (aviso inmediato además del cron): en **Tus integraciones → tu app
→ Webhooks**, configura URL `https://TU-DOMINIO/api/mp/webhook` y suscríbete
al evento **Pagos**. El sistema funciona igual solo con el cron.

## Probar que quedó funcionando

1. Compra de prueba en `/pro` con tu correo.
2. Espera el cron (≤15 min) o dispara a mano:
   ```bash
   curl -X POST https://TU-DOMINIO/api/pro/send-code \
     -H "Content-Type: application/json" \
     -d '{"email":"tucorreo@gmail.com","secret":"<MP_SYNC_TOKEN>"}'
   ```
3. Debería llegar el correo con el código. Revisa spam la primera vez.

## Auditoría y respaldo manual

- **Ver ventas entregadas** (últimas 50):
  ```bash
  curl "https://TU-DOMINIO/api/pro/send-code?secret=<MP_SYNC_TOKEN>"
  ```
- **Reenviar un código** a quien lo perdió: mismo POST con su correo (el
  código es el mismo y la entrega queda registrada como `manual`).
- El flujo manual de siempre sigue válido offline:
  `node scripts/gen-license.mjs correo@ejemplo.cl`

## Seguridad

- El webhook nunca confía en su cuerpo: cada pago se re-verifica contra la
  API de Mercado Pago con tu Access Token.
- Un pago solo entrega una vez (registro `paymentId` único en la base de
  datos), aunque el webhook o el cron se repitan.
- `MP_SYNC_TOKEN` protege el sync y el respaldo manual; no lo compartas ni
  lo dejes en el repositorio.
- El código de licencia solo funciona junto con el correo del comprador y
  la validación es local en la app, 100% offline.

## Costo total: $0

Gmail SMTP (gratis), cron-job.org (gratis), Vercel/Railway free tier (gratis
para este volumen). Cuando el volumen crezca, se migra el envío a Resend con
dominio propio sin cambiar nada más.
