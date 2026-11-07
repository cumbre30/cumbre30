# Deploy de la web Cumbre30 — Vercel + Postgres (Neon), $0

Objetivo: publicar la web — **cumbregeo.cl** (landing Cumbre GEO en `/geo`),
la venta Pro en `/pro`, `/privacidad`, `/eliminar-cuenta`, la activación de
cuentas y la auto-entrega de códigos — con URL pública HTTPS para la ficha
de Google Play. Todo gratis.

```
Vercel  →  hospeda la app Next.js (región Santiago scl1) + HTTPS
Neon    →  base Postgres gratuita (users, rides, entregas de códigos)
GitHub  →  el repo + el APK de 53 MB como Release (descarga directa)
cron-job.org →  revisa pagos de Mercado Pago cada 15 min
```

> El `vercel.json` ya viene listo: `buildCommand` con `prisma generate`,
> región `scl1` y redirección de la raíz de `cumbregeo.cl` → `/geo`.
> El repo no incluye binarios (APK/AAB salieron del git para que el
> deploy sea liviano) — viven en el disco y en GitHub Releases.

Tiempo total: ~30–45 min la primera vez.

---

## Paso 0 · Sube el repo a GitHub

El código llega a tu computador en `cumbre30-codigo.zip` (~7 MB: código
completo, sin `node_modules`, sin `.env`, sin APKs). Descomprime, abre
una terminal **dentro de la carpeta** y:

```bash
git init
git add .
git commit -m "Cumbre30 v1.8.2 (build 27)"
git push --set-upstream https://github.com/TU-USUARIO/cumbre30.git main
```

(Paso a paso con soluciones a problemas comunes: `INSTRUCCIONES-GITHUB.md`.)

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

El APK (53 MB) no puede vivir dentro de las funciones serverless de Vercel:

1. GitHub → tu repo → **Releases → Create a new release**.
2. Crea el tag `v1.8.2`, título `Cumbre30 v1.8.2 (build 27)`, adjunta
   `cumbre30-v1.8.2-code27.apk` y publica.
3. Copia la URL del asset (botón derecho → copiar dirección del enlace,
   termina en `…/download/v1.8.2/cumbre30-v1.8.2-code27.apk`).
4. Ponla en la variable `APK_DOWNLOAD_URL` en Vercel y re-despliega.
   `/api/apk` ahora redirige ahí (la app y los usuarios no notan cambio) y
   el botón **"Descargar APK"** de la landing `/geo` se activa solo: la
   página lee `APK_DOWNLOAD_URL` al compilar, sin tocar código.

## Paso 7 · Ficha de Google Play

- **Sitio web**: `https://tu-dominio` (o el `.vercel.app` mientras tanto)
- **Política de privacidad**: `https://tu-dominio/privacidad`
- **Eliminar cuenta**: `https://tu-dominio/eliminar-cuenta`
- Página de venta Pro (para WhatsApp/comunidad): `https://tu-dominio/pro`

## Dominio propio (cumbregeo.cl)

1. Vercel → tu proyecto → **Settings → Domains** → agrega `cumbregeo.cl`
   y `www.cumbregeo.cl`.
2. En tu registrador apunta los DNS:
   - `cumbregeo.cl` → registro **A** → `76.76.21.21`
   - `www` → registro **CNAME** → `cname.vercel-dns.com`
3. Nada más que configurar: el `vercel.json` ya redirige la raíz de
   `cumbregeo.cl` (y `www`) → `/geo`, la landing de Cumbre GEO. La app,
   `/pro`, `/privacidad` y el resto responden en el mismo dominio.
4. Actualiza **Sitio web** en la ficha de Google Play a `https://cumbregeo.cl`.

---

## 🧯 Si algo falla

| Síntoma | Causa y arreglo |
| --- | --- |
| En runtime: `Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x` | Ya resuelto: `prisma/schema.prisma` trae `binaryTargets = ["native", "rhel-openssl-3.0.x"]`. Si Vercel cambia de runtime, el error nombra el target nuevo: agrégalo a `binaryTargets`, `prisma generate` y re-despliega. |
| El build de Vercel no encuentra `prisma` | `vercel.json` define `buildCommand: prisma generate && next build` — no lo borres ni lo reemplaces por `npm run build`. |
| `/api/apk` responde 404 en producción | Normal sin `APK_DOWNLOAD_URL`: el APK vive en GitHub Releases (paso 6), no dentro del serverless. |
| La landing `/geo` sigue mostrando "Disponible próximamente" después de subir el APK | `APK_DOWNLOAD_URL` se lee al compilar: al agregarla en Vercel hay que **re-desplegar**. |
| `git push` se queda pegado o pesa mucho | No debería: la historia ya fue limpiada con filter-repo (480 MB → 14 MB). Si ves APKs en el repo, alguien los volvió a `git add -f`. |

---

### Costos

| Servicio | Plan | Costo |
| --- | --- | --- |
| Vercel | Hobby | $0 |
| Neon Postgres | Free (0,5 GB) | $0 |
| GitHub (repo + Releases) | Free | $0 |
| cron-job.org | Free | $0 |

Cuando el tráfico lo justifique: dominio ~US$10/año y nada más.
