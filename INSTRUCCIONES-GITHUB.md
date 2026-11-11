# 📤 Cómo subir Cumbre30 a GitHub (paso a paso)

Este paquete viene **limpio y listo**: no incluye bases de datos, APKs ni archivos del entorno. Solo sigue estos pasos.

---

## Paso 1 - Crear el repositorio en GitHub (web)

1. Entra a **https://github.com/new** (con tu sesión iniciada).
2. **Repository name**: `cumbre30` (o el nombre que prefieras).
3. Elige **Private** (recomendado) o Public.
4. ⚠️ **NO marques** "Add a README", ni "Add .gitignore", ni "Choose a license" (ya los trae el paquete).
5. Clic en **Create repository**.
6. Copia la URL que te muestra, se ve así:
   `https://github.com/TU-USUARIO/cumbre30.git`

---

## Paso 2 - Descomprimir y subir (4 comandos)

Si tienes el zip completo (`cumbre30-codigo.zip`): descomprímelo en una carpeta y pasa directo a los comandos.

Si te llegaron **por partes**, descomprime `cumbre30-parte1-codigo.zip` en una carpeta y luego descomprime `cumbre30-parte2-media.zip` (y `cumbre30-parte3-play-store.zip` si lo tienes) **dentro de esa misma carpeta** - se fusionan solos y queda el proyecto completo. Después ejecuta:

```bash
git init
git add .
git commit -m "Cumbre30 v1.8.3 (build 29)"
git push --set-upstream https://github.com/TU-USUARIO/cumbre30.git main
```

> 💡 En Windows: abre la carpeta, clic derecho → "Git Bash Here" (si instalaste Git para Windows).
> 🔐 La primera vez, Git abrirá el navegador para que autorices tu cuenta de GitHub - inicia sesión y acepta. No necesitas crear tokens a mano.
> 🆔 Si Git te pide tu identidad antes del commit (solo pasa la primera vez que usas Git en ese computador):
> ```bash
> git config --global user.name "Tu Nombre"
> git config --global user.email tu@correo.cl
> ```
> y repite el `git commit`.

Cuando termine, refresca https://github.com/TU-USUARIO/cumbre30 y verás el proyecto completo con su README.

---

## Paso 3 - Subir el APK v1.8.3 a "Releases" (necesario para el botón de descarga web)

GitHub da gratis hasta 2 GB por release para binarios - es el lugar correcto para los APKs (mejor que dentro del código). Publicar el release y definir `APK_DOWNLOAD_URL` en Vercel alimenta la descarga de actualizaciones **dentro de la app** (`/api/apk` redirige ahí); el botón de la web `/geo` ya está activo apuntando a Google Drive (ver `download/DEPLOY.md` paso 6):

1. En tu repo: **Releases → Create a new release** (o https://github.com/TU-USUARIO/cumbre30/releases/new).
2. **Tag**: escribe `v1.8.3` y elige "Create new tag on publish".
3. **Title**: `Cumbre30 v1.8.3 (build 29)`.
4. Arrastra el archivo `cumbre30-v1.8.3-code29.apk` (el que está en Google Drive) a la zona de adjuntos.
5. En la descripción del release pega las notas de la versión (están listas en `download/play-store/ficha-play-store.md` → "Notas de la versión").
6. **Publish release** ✅
7. Copia la URL del asset subido (termina en `…/download/v1.8.3/cumbre30-v1.8.3-code29.apk`) y ponla en la variable `APK_DOWNLOAD_URL` en Vercel → Settings → Environment Variables → re-despliega.

### Novedades v1.8.3 (build 29) - temas y SOS ampliado

- 🎨 **Temas de color para toda la app** (Cumbre30 Pro): Cerro, Andes, Atardecer, Lila y Grafito, en Configuración.
- 🧭 **Pantalla ride personalizable** (Pro): velocímetro digital, arco, dial o aguja; tamaños normal, grande y gigante; minimapa compacto, normal o grande, con vista previa.
- 🆘 **SOS ampliado**: Parquemet (+56 2 2730 1404), Municipalidad de Providencia (+56 2 2654 3200) y Salud Responde (600 360 7777) además de 133, 131 y 132.
- 🏞️ **Datos oficiales del parque**: accesos, cumbres, senderos enduro y horario de ciclistas (06:00 a 19:00).
- ✅ **Descenso limpio**: resumen cuando recorres el parque respetando los 30 km/h.
- 🔧 **Mejoras de estabilidad**.

### Novedades v1.8.2 (build 28) - marca Cumbre GEO

- 🏔️ **Nueva marca: Cumbre GEO** - sitio oficial cumbregeo.cl (redirige a `/geo`: qué hacemos, apps con detalles y planes).
- 👑 **Compra Pro con entrega automática**: pagas en la web (`/cumbre30pro` → vista de planes de /geo, Mercado Pago; `/pro` sigue funcionando como alias) y tu código `C30P-…` llega solo al correo; lo activas en la app (Perfil → Pagos y suscripciones).
- 🔧 **Mejoras de estabilidad**.

### Novedades v1.5.0 (build 21) - monetización

- 💛 **Aportes voluntarios** (Perfil): botón "Aportar - monto libre" que abre tu
  enlace de Mercado Pago (link.mercadopago.cl/perfumatch) en el navegador.
- 👑 **Cumbre30 Pro** ($6.500, pago único):
  - Export **GPX** de cada viaje con GPS → importar en Strava, Garmin o Komoot.
  - **Constancias PDF ilimitadas** (gratis: 3 al mes).
  - Activación **sin servidor**: pagas → te llega un código `C30P-XXXX-…` ligado a tu
    correo → lo ingresas en Perfil → "Ya pagué". Se valida offline en el teléfono.
- 🏔️ **Formulario "¿Gestionas un parque o ciclovía?"**: los interesados en un prototipo
  para otro parque envían sus datos por WhatsApp (+56 9 4296 1619) o correo
  (contacto.cumbre30@gmail.com) con el mensaje ya redactado.
- ℹ️ El pago se hace con Mercado Pago (fuera de la app, en el navegador); la app
  sigue 100% offline y sin servidores propios.

### Novedades v1.4.5 (build 20)

- 📲 **Pantalla completa (modo inmersivo)**: la barra de notificaciones ya no tapa
  las opciones del banner superior. Se oculta sola al abrir la app; si necesitas
  ver la hora o una notificación, desliza desde el borde superior y reaparece
  un momento, luego se esconde otra vez.

### Novedades v1.4.4 (build 19)

- 📄 **Constancia PDF** de cada viaje con GPS (Historial → "Constancia PDF"): redacción formal
  para respaldo ante una infracción, con SHA-256 de verificación. 100% offline.
  Los viajes **demo** no emiten constancia (botón deshabilitado).
- 📱 **"Generar y compartir resumen"** funciona en Android: abre el panel nativo de compartir
  (Instagram, WhatsApp, correo…) o guarda la imagen en descargas.
- 🌗 **Modo oscuro / claro**: botón sol/luna en el encabezado, la preferencia queda guardada.
  Texto blanco en oscuro / negro en claro en toda la app (ficha médica y datos de bici incluidos).
- ✏️ **Cambiar nombre de usuario** (Perfil): permitido 1 vez cada 30 días. Los km, logros y
  pines quedan asociados al correo, así que no se pierde nada al cambiarlo.
- 🔐 Firma estable del APK (SHA-1 `D6:D0:BB:2A:…`): instala encima de la v1.4.3 sin borrar datos
  y el inicio con Google sigue funcionando.

Así cada versión futura del APK queda descargable y ordenada.

---

## Paso 4 - Futuras actualizaciones (cuando saques v1.5.0, etc.)

En la carpeta del proyecto:

```bash
git add .
git commit -m "v1.3.9: descripción del cambio"
git push
```

---

## 🧯 Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `remote origin already exists` | Ejecuta solo los otros 2 comandos (el remote ya estaba) |
| Pide usuario/contraseña en texto | La "contraseña" es un **Personal Access Token** (GitHub → Settings → Developer settings → Tokens), o mejor usa el flujo de navegador |
| `failed to push some refs` | El repo en la web no estaba vacío: márcalo sin README al crearlo, o usa `git pull --rebase origin main` antes del push |
| El push va muy lento la primera vez | Es normal: sube todo el historial una sola vez (~40 MB) |
