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

> ✅ **El repo ya existe y está conectado**: `github.com/cumbre30/cumbre30`
> (creado y subido desde el agente en nov 2026). No repitas este paso;
> solo `git push` y, si aún no está, conecta el repo en Vercel
> (Settings → Git) para que cada push se despliegue solo.

```bash
git push --set-upstream https://github.com/cumbre30/cumbre30.git main
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
| `APK_DOWNLOAD_URL` | **Bórrala si existe**: apuntaba al link de Drive. El código ya redirige por defecto al Release "latest" de GitHub (`/api/apk`); esta variable solo para sobreescribir manualmente |

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

## Paso 6 · El APK en GitHub Releases (automático)

El APK (~55 MB) no vive dentro de las funciones serverless de Vercel:
se hospeda en GitHub Releases y **todo el ciclo es automático** desde
nov 2026:

1. Al publicar un tag `v*` (`git push origin vX.Y.Z`), el workflow
   `build-apk.yml` construye el APK y **crea el Release solo**, con dos
   assets: `cumbre30-vX.Y.Z-codeN.apk` y `cumbre30-latest.apk`.
2. `/api/apk` redirige por defecto a
   `…/releases/latest/download/cumbre30-latest.apk` (URL fija en código,
   no requiere variable de entorno) — alimenta tanto el botón de la
   landing `/geo` como la descarga de actualizaciones dentro de la app.
3. Para publicar una versión nueva: actualizar `src/lib/appVersion.ts`
   y `android/app/build.gradle` (versionName/versionCode), commit, y
   `git tag vX.Y.Z && git push origin vX.Y.Z`. Nada más.
4. En Vercel **borra** `APK_DOWNLOAD_URL` si aún apunta a Drive: el
   default del código manda cuando la variable no existe.

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

### Web Push y enlaces de ride (v1.12.0)

**Web Push (Ola 2)** — avisos del parque en la web. Necesita 4 variables de entorno en
Vercel (Settings → Environment Variables) y un re-despliegue. Los valores listos para
copiar están en `push-credenciales.txt` (junto a este documento):

| Variable | Qué es |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID (la ve el navegador, no es secreto) |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID (secreta) |
| `VAPID_SUBJECT` | `mailto:contacto@cumbregeo.cl` — contacto declarado al servicio de push |
| `PUSH_ADMIN_KEY` | Secreto para el envío masivo por curl |

Mientras no estén configuradas, `/api/push/*` responde `PUSH_NO_CONFIG` y la app muestra
"el servidor todavía no tiene avisos push configurados" — nada se rompe.

Enviar un aviso a todos los suscritos (por ejemplo al publicar un aviso operativo nuevo):

```bash
curl -X POST https://cumbregeo.cl/api/push/send \
     -H "x-admin-key: $PUSH_ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"title":"Parquemet","body":"Las luces se encienden a las 20:15 hoy","url":"/"}'
```

Las tablas nuevas (`PushSub`, `RideShare`) se crean solas con el primer uso (DDL
idempotente); si prefieres tenerlas desde el principio:

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npx prisma db push
```

**Enlaces de ride (Ola 3)** — sin configuración: el ciclista crea el enlace desde
Historial → "Link" y comparte `cumbregeo.cl/compartir?c=CÓDIGO` (solo estadísticas,
nunca GPS). `cumbregeo.cl/rides` lista los viajes de la cuenta con sesión iniciada.

---

### Costos

| Servicio | Plan | Costo |
| --- | --- | --- |
| Vercel | Hobby | $0 |
| Neon Postgres | Free (0,5 GB) | $0 |
| GitHub (repo + Releases) | Free | $0 |
| cron-job.org | Free | $0 |

Cuando el tráfico lo justifique: dominio ~US$10/año y nada más.
