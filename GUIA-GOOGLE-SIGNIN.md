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
| "Google no reconoce esta app (código 10)" | El SHA-1 o el paquete no coinciden. Revisa el paso 3a (debe ser el mismo proyecto que el client Web). |
| El botón avisa que falta el Client ID | Paso 4 no aplicado o la APK no se recompiló. |
| "Sin conexión con Google" | Sin internet al momento de entrar; los rides nunca la necesitan, solo este botón. |
| Cancelaste el selector | Solo vuelve a intentarlo (código 12501, no es error). |
