# 📤 Cómo subir Cumbre30 a GitHub (paso a paso)

Este paquete viene **limpio y listo**: no incluye bases de datos, APKs ni archivos del entorno. Solo sigue estos pasos.

---

## Paso 1 — Crear el repositorio en GitHub (web)

1. Entra a **https://github.com/new** (con tu sesión iniciada).
2. **Repository name**: `cumbre30` (o el nombre que prefieras).
3. Elige **Private** (recomendado) o Public.
4. ⚠️ **NO marques** "Add a README", ni "Add .gitignore", ni "Choose a license" (ya los trae el paquete).
5. Clic en **Create repository**.
6. Copia la URL que te muestra, se ve así:
   `https://github.com/TU-USUARIO/cumbre30.git`

---

## Paso 2 — Descomprimir y subir (3 comandos)

Descomprime `cumbre30-github.zip` en tu computadora, abre una terminal **dentro de la carpeta descomprimida** y ejecuta:

```bash
git remote add origin https://github.com/TU-USUARIO/cumbre30.git
git branch -M main
git push -u origin main
```

> 💡 En Windows: abre la carpeta, clic derecho → "Git Bash Here" (si instalaste Git para Windows).
> 🔐 La primera vez, Git abrirá el navegador para que autorices tu cuenta de GitHub — inicia sesión y acepta. No necesitas crear tokens a mano.

Cuando termine, refresca https://github.com/TU-USUARIO/cumbre30 y verás el proyecto completo con su README.

---

## Paso 3 — Subir el APK v1.4.5 a "Releases" (opcional pero recomendado)

GitHub da gratis hasta 2 GB por release para binarios — es el lugar correcto para los APKs (mejor que dentro del código):

1. En tu repo: **Releases → Create a new release** (o https://github.com/TU-USUARIO/cumbre30/releases/new).
2. **Tag**: escribe `v1.4.5` y elige "Create new tag on publish".
3. **Title**: `Cumbre30 v1.4.5 (build 20)`.
4. Arrastra el archivo `cumbre30-v1.4.5-code20.apk` a la zona de adjuntos.
5. **Publish release** ✅

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

## Paso 4 — Futuras actualizaciones (cuando saques v1.4.5, etc.)

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
