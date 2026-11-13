# 🔑 Guía: activar "Continuar con Google" en Cumbre30

El inicio de sesión con Google ya está **programado en la app** (v1.3.9+). Solo falta
que registres la app en Google — es gratis, sin servidor y se hace una sola vez.
Toma unos 10 minutos.

---

## Antes de partir: datos que vas a necesitar

| Dato | Valor |
|---|---|
| Nombre de paquete de la app | `cl.cumbre30.app` |
| Huella SHA-1 de la APK | `D6:D0:BB:2A:CA:31:D1:EC:A6:5C:98:06:73:DE:55:01:71:D5:EE:68` |

> El SHA-1 corresponde al keystore debug que ya vive en `android/debug.keystore`.
> Como se sube al repo, **todas** las APKs (hechas por ti, por mí o por GitHub Actions)
> quedan firmadas igual y Google las acepta siempre.

---

## Paso 1 — Crear el proyecto en Google Cloud Console (2 min)

1. Entra a https://console.cloud.google.com con tu cuenta de Google.
2. Arriba a la izquierda, junto al logo, abre el selector de proyectos → **New project**.
3. Nombre: `Cumbre30` → **Create**. Quédate dentro de ese proyecto.

## Paso 2 — Configurar la pantalla de consentimiento (3 min)

1. Menú ☰ → **APIs & Services** → **OAuth consent screen**.
2. User type: **External** → **Create**.
3. App name: `Cumbre30` · User support email: tu correo · **Save and continue**.
4. En **Scopes**: no agregues nada (basta email/perfil básico) → **Save and continue**.
5. En **Test users**: agrega los correos de quienes van a probar (hasta 100).
   Google pide modo "Testing" para apps que no están publicadas; con 100 usuarios
   de prueba es más que suficiente para un grupo de ciclistas → **Save and continue** → **Back to dashboard**.

## Paso 3 — Crear los DOS Client ID (5 min)

1. Menú ☰ → **APIs & Services** → **Credentials** → **+ Create credentials** → **OAuth client ID**.

### 3a. Client "Android" (hace que Google reconozca tu APK)

2. Application type: **Android**.
   - Package name: `cl.cumbre30.app`
   - SHA-1: `D6:D0:BB:2A:CA:31:D1:EC:A6:5C:98:06:73:DE:55:01:71:D5:EE:68`
   → **Create**. (No se usa su valor, solo registra la app.)

### 3b. Client "Web application" (el que va dentro del código)

3. Otra vez **+ Create credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Cumbre30 token` (no importa el nombre).
   - Authorized redirect URIs: **no agregues ninguno**.
   → **Create** y **copia el Client ID** (parece `1234567890-abc123xyz.apps.googleusercontent.com`).

## Paso 4 — Pegar el Client ID en la app (1 min)

> ✅ **Ya hecho en la v1.4.0**: el Client ID del proyecto Cumbre30 está pegado en
> `src/lib/googleAuth.ts` y la APK ya se compiló con él. Estos pasos solo se
> repiten si algún día cambias de proyecto de Google Cloud o de Client ID.

Abre `src/lib/googleAuth.ts` y reemplaza la línea:

```ts
export const GOOGLE_WEB_CLIENT_ID = "";
```

por (con TU valor):

```ts
export const GOOGLE_WEB_CLIENT_ID = "1234567890-abc123xyz.apps.googleusercontent.com";
```

## Paso 5 — Compilar de nuevo

```bash
bash scripts/export-web.sh
npx cap sync android
cd android && ./gradlew assembleDebug
```

o simplemente pídeme el rebuild cuando cambies el Client ID.

---

## ¿Cómo funciona? (sin servidor)

1. La app abre el **selector de cuentas de Google nativo** (plugin propio en
   `android/.../GoogleAuthPlugin.java`).
2. Google entrega `email`, `nombre` y `idToken` directo al teléfono.
3. La auth offline (`src/lib/offlineAuth.ts`) crea la cuenta local o **enlaza** la
   existente si el correo coincide — conservas km, logros y pines.
4. Al "Salir" también se desloguea de Google para poder cambiar de cuenta.

## Problemas frecuentes

| Síntoma | Causa y arreglo |
|---|---|
| "Not implemented" al tocar el botón | APK anterior a la v1.4.1 (los plugins nativos se registraban tarde). Instala la v1.4.1+. |
| Al elegir la cuenta la app se cierra (o "vuelve" a otra app como Descargas) | APK anterior a la v1.4.2: el callback recibía un `Intent` en vez del `ActivityResult` de Capacitor 8 y el app crasheaba al recibir la respuesta. Instala la v1.4.2+. |
| "Google no reconoce esta app (código 10)" | El SHA-1 o el paquete no coinciden. Desde v1.8.3 las APK se firman con el **keystore release** (`cumbre30-release.keystore`, SHA-1 `96:29:F6:76:0F:A6:D8:99:42:42:4A:01:D0:83:4C:22:55:92:3F:74`): el cliente OAuth Android de Cloud Console debe tener **ambas** huellas (debug D6:D0:BB:… y release 96:29:F6:…). Edita el cliente en Credentials → tu cliente Android → agrega la huella y guarda. Además: si la pantalla de consentimiento sigue en Testing, el correo que prueba debe estar en Test users. Tras guardar, espera unos minutos (Google cachea la config) y reintenta. Cuando la app se distribuya por Play, agrega también el SHA-1 de la App signing key de Play Console (Setup → App signing). |
| "El inicio con Google está disponible en la app Android" **dentro del APK** (aparece justo después de elegir la cuenta) | El APK se compiló **sin** `NEXT_PUBLIC_STATIC=1`: el bundle cree que está en modo servidor y rechaza la cuenta al enlazarla (build 30 salió así; corregido desde build 31 en `scripts/build-android.sh`, que ahora exporta con `NEXT_PUBLIC_STATIC=1`). Regenera la APK con `bash scripts/build-android.sh`. Nota: si el selector abrió y dejaste elegir la cuenta, el flujo Google (Client ID Web + SHA-1) ya funciona — este error es solo del modo offline. |
| El botón avisa que falta el Client ID | Paso 4 no aplicado o la APK no se recompiló. |
| "Sin conexión con Google" | Sin internet al momento de entrar; los rides nunca la necesitan, solo este botón. |
| Cancelaste el selector | Solo vuelve a intentarlo (código 12501, no es error). |
