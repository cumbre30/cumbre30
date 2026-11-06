# Deploy de la web Cumbre30 — Vercel + Postgres (Neon), $0

Objetivo: publicar la web (vende Pro en `/pro`, aloja `/privacidad`,
`/eliminar-cuenta`, la activación de cuentas y la auto-entrega de códigos)
con URL pública HTTPS para la ficha de Google Play. Todo gratis.

```
Vercel  →  hospeda la app Next.js (región Santiago scl1) + HTTPS
Neon    →  base Postgres gratuita (users, rides, entregas de códigos)
GitHub  →  el repo + el APK de 54 MB como Release (descarga directa)
cron-job.org →  revisa pagos de Mercado Pago cada 15 min
```

Tiempo total: ~30–45 min la primera vez.

---

## Paso 0 · Sube el repo a GitHub

```bash
cd /home/z/my-project
git remote add origin https://github.com/TU-USUARIO/cumbre30.git
git push -u origin main
```

(El repo ya está commiteado y `.env` está fuera de git — nunca se sube.)

## Paso 1 · Crea el proyecto en Vercel

1. Entra a **vercel.com** con tu cuenta GitHub → **Add New… → Project**.
2. Importa el repo `cumbre30`.
3. Framework: detecta **Next.js** solo. No toques el build (usa vercel.json).
4. **No desplegues todavía**: primero van las variables de entorno (Paso 2).

## Paso 2 · Crea la base Postgres (Neon) desde Vercel

1. En tu proyecto Vercel → pestaña **Storage** → **Create Database** →
   **Neon Postgres** (plan Free).
2. Al crearla, Vercel conecta la variable `DATABASE_URL` sola (marca las
   environments Production/Preview/Development).
3. Copia la `DATABASE_URL` (Empieza con `postgresql://…neon.tech/…`).

**Crea las tablas** desde tu computador (o pídemelo en el chat):

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npx prisma db push
```

## Paso 3 · Variables de entorno del proyecto (Vercel → Settings → Environment Variables)

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | la de Neon (ya quedó si usaste Storage) |
| `MP_ACCESS_TOKEN` | Token de producción de Mercado Pago (`APP_USR-…`) |
| `GMAIL_USER` | `contacto.cumbre30@gmail.com` |
| `GMAIL_APP_PASSWORD` | contraseña de aplicación de Google (16 caracteres) |
| `MP_SYNC_TOKEN` | secreto aleatorio: `openssl rand -hex 32` |
| `APK_DOWNLOAD_URL` | URL del APK en GitHub Releases (paso 6) |

## Paso 4 · Deploy

1. Vercel → **Deploy** (o `git push` y se despliega solo).
2. Verifica en `https://tu-proyecto.vercel.app`:
   - `/pro` carga con el botón de compra.
   - `/privacidad` y `/eliminar-cuenta` responden 200.
   - Registro/login desde la app web funciona (usa la base Neon).

## Paso 5 · Activa la auto-entrega de códigos

1. **cron-job.org** (gratis): crea un job cada 15 min a
   `https://tu-dominio/api/mp/sync?token=<MP_SYNC_TOKEN>`.
2. Opcional (aviso instantáneo): en Mercado Pago → **Tus integraciones →
   tu app → Webhooks**, URL `https://tu-dominio/api/mp/webhook`, evento
   **Pagos**.
3. Prueba: compra de $6.500 en `/pro` → el correo con el código
   `C30P-…` debe llegar solo (≤15 min con cron, segundos con webhook).

Detalle completo de credenciales en `download/autogestion-codigos.md`.

## Paso 6 · El APK en GitHub Releases

El APK (54 MB) no puede vivir dentro de las funciones serverless de Vercel:

1. GitHub → tu repo → **Releases → Create a new release**.
2. Crea el tag `v1.8.1`, título `Cumbre30 v1.8.1`, adjunta
   `cumbre30-v1.8.1-code26.apk` y publica.
3. Copia la URL del asset (botón derecho → copiar dirección del enlace,
   termina en `…/download/v1.8.1/cumbre30-v1.8.1-code26.apk`).
4. Ponla en la variable `APK_DOWNLOAD_URL` en Vercel y re-despliega.
   `/api/apk` ahora redirige ahí (la app y los usuarios no notan cambio).

## Paso 7 · Ficha de Google Play

- **Sitio web**: `https://tu-dominio` (o el `.vercel.app` mientras tanto)
- **Política de privacidad**: `https://tu-dominio/privacidad`
- **Eliminar cuenta**: `https://tu-dominio/eliminar-cuenta`
- Página de venta Pro (para WhatsApp/comunidad): `https://tu-dominio/pro`

## Dominio propio (opcional, recomendado antes del lanzamiento)

Vercel → Settings → Domains → agrega `cumbre30.cl` (o el que compres) y
apunta los DNS según las instrucciones. Después actualiza la ficha de Play.

---

### Costos

| Servicio | Plan | Costo |
| --- | --- | --- |
| Vercel | Hobby | $0 |
| Neon Postgres | Free (0,5 GB) | $0 |
| GitHub (repo + Releases) | Free | $0 |
| cron-job.org | Free | $0 |

Cuando el tráfico lo justifique: dominio ~US$10/año y nada más.
