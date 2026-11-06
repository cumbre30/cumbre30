# Cumbre30 — Ficha para Google Play Console

Todo lo que se pide al crear la app en Play Console. Los archivos gráficos
están en esta misma carpeta (`capturas/`, `feature-graphic-1024x500.png`,
ícono: `../../public/icons/icon-512.png`).

---

## Datos básicos

| Campo | Valor |
| --- | --- |
| Nombre de la app (≤30 car.) | `Cumbre30 · Cerro San Cristóbal` |
| Package / ID de aplicación | `cl.cumbre30.app` |
| Categoría | Deportes (alternativa: Salud y bienestar) |
| Etiquetas sugeridas | ciclismo, montaña, GPS, ciclocomputador |
| Correo de contacto | contacto.cumbre30@gmail.com |
| Teléfono | +56 9 4296 1619 (WhatsApp) |
| Sitio web | la URL del preview (página de venta: misma URL + `/pro`) |
| Versión a subir | v1.8.0 (versionCode 25) — `cumbre30-v1.8.0-code25.aab` |

## Descripción corta (≤80 caracteres)

```
Ciclocomputador del cerro San Cristóbal: límite 30 km/h, GPS y alertas.
```
(72 caracteres)

## Descripción completa (≤4000 caracteres)

```
Cumbre30 es el ciclocomputador pensado para pedalear el Cerro San Cristóbal
del Parque Metropolitano de Santiago, respetando el límite de 30 km/h.

🚴 CICLOCOMPUTADOR COMPLETO
Velocidad actual y máxima, distancia, tiempo, desnivel acumulado y mapa en
tiempo real. Todo funciona sin señal: descarga la app y pedalea con GPS
aunque no tengas datos móviles en el cerro.

⚠️ LÍMITE 30 KM/H CON ALERTAS
Avisos de voz, pitidos y vibración cuando te acercas o superas el límite de
30 km/h dentro del parque. Conduce más seguro y cuida a peatones y a otros
ciclistas. Además, la app detecta si el viaje se hizo en vehículo motorizado
para que tus estadísticas reflejen solo tus pedaleos.

🗺️ RUTAS Y LUGARES DEL PARQUE
Navegación hacia Plaza México, los accesos Pío Nono, Pedro de Valdivia y La
Pirámide, Piscina Antilén, Jardín Japonés y más. Rutas trazadas sobre el
grafo de calles y senderos del cerro, con distancias reales.

🏆 DESAFÍOS Y RECOMPENSAS
Series de desafíos por nivel, con desafíos diarios, semanales y mensuales.
Desbloquea pines exclusivos para tu perfil. El primer desafío de cada serie
es gratis; el resto con Cumbre30 PRO.

🪪 CREDENCIAL DIGITAL
Enrolamiento Parquemet con código QR: tu credencial digital de ciclista
siempre a un toque, con los datos de tu bicicleta.

📊 HISTORIAL Y ESTADÍSTICAS
Cada ride queda guardado con su trazado GPS; expórtalo en GPX, revisa tus
constancias y comparte tu resumen en Instagram.

🔐 PRIVACIDAD
Tus rides viven en tu teléfono. Si creas cuenta, tus contraseñas se guardan
siempre cifradas y puedes eliminar tu cuenta y todos tus datos desde la
propia app (Perfil → Mis datos → Eliminar cuenta) o en la web.

Cumbre30 es una app independiente de apoyo al ciclista; no es una aplicación
oficial del Parque Metropolitano de Santiago.
```

## Gráficos

| Asset | Archivo | Especificación |
| --- | --- | --- |
| Ícono 512×512 | `public/icons/icon-512.png` (en el repo) | 32-bit PNG |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 |
| Captura 1 | `capturas/01-ride-mapa.png` | 1080×1920 — ciclocomputador |
| Captura 2 | `capturas/02-explorar.png` | 1080×1920 — destinos y rutas |
| Captura 3 | `capturas/03-desafios.png` | 1080×1920 — desafíos (con sesión muestra progreso) |
| Captura 4 | `capturas/04-perfil.png` | 1080×1920 — perfil |

Mínimo requerido: 2 capturas — ya hay 4 listas.

## Declaraciones obligatorias del Console

- **Política de privacidad (URL)**: `https://<tu-dominio-preview>/privacidad`
- **URL de eliminación de cuenta** (Seguridad de datos → obligatoria porque
  la app permite crear cuentas): `https://<tu-dominio-preview>/eliminar-cuenta`
  — el borrado real ya funciona: en la app (Perfil → Mis datos → Eliminar
  cuenta, con confirmación) y por API `DELETE /api/auth/account`.
- **Seguridad de datos (formulario)**:
  - Se recopilan: correo electrónico (cuenta), datos de actividad/fitness
    (rides: distancia, velocidad, ruta GPS), nombre de usuario.
  - Se procesan de forma efímera: ubicación precisa DURANTE el ride (no se
    sale del dispositivo salvo sincronización del ride en modo web).
  - No se comparte con terceros. No se vende. Cifrado en tránsito (HTTPS).
  - Eliminación: sí, por la app y por URL.
- **Clasificación de contenido**: cuestionario IARC — sin violencia, sin
  apuestas; esperado: Todos / 3+.
- **Anuncios**: la app no contiene publicidad.
- **Acceso a funciones con restricción**: ninguno (no se usan permisos de
  primer plano en segundo plano ni SMS/contactos).

## Firma y OAuth (Google Sign-In)

1. La app usa `play-services-auth` (selector nativo de cuentas Google).
2. Los clientes OAuth de tipo **Android** en Google Cloud Console deben
   tener el SHA-1 del certificado que firma la app:
   - Debug (usuarios actuales del APK directo):
     `D6:D0:BB:2A:CA:31:D1:EC:A6:5C:98:06:73:DE:55:01:71:D5:EE:68`
   - Release / upload key (el AAB que subas a Play):
     `96:29:F6:76:0F:A6:D8:99:42:42:4A:01:D0:83:4C:22:55:92:3F:74`
3. Tras subir el primer AAB, Play App Signing crea la **clave de firma de
   producción**: cópiala desde Consola de Play → Configuración → Firma de
   app y agrégala también como cliente OAuth Android (SHA-1 de "App signing
   key certificate"). Sin ese paso, "Entrar con Google" falla en los
   usuarios que instalen desde Play.
4. La contraseña del keystore de release está en `android/keystore.properties`
   (committeado junto a `android/cumbre30-release.keystore`). **Guarda una
   copia offline de ambos** (por ejemplo en tu gestor de contraseñas): si se
   pierde la upload key hay que pedir reset a Google.

## Cuenta de desarrollador y pruebas

- Si tu cuenta Play Console es **personal creada después de nov. 2023**:
  Google exige una **prueba cerrada con 12 testers optados durante 14 días
  corridos** antes de permitir producción. Tu comunidad de WhatsApp sirve:
  los testers solo deben abrir el link de opt-in e instalar.
- Si la cuenta es de **organización**, ese requisito no aplica.
- Ruta recomendada: crear la app → pista **interna** con el AAB (validación
  técnica) → pista **cerrada** con 12+ testers → solicitar producción.

## Pagos (Pro) — decisión v1.8.0: Play Billing + canje web

Decisión tomada (nov. 2026), la app **no contiene links de pago** (cumple
política de Google Play para funciones digitales):

1. **Google Play Billing (build Play, AAB)**: producto único
   (non-consumable) con ID **`cumbre30_pro`**, precio recomendado
   **CLP $7.650** → con la comisión del 15% (programa para desarrolladores
   pequeños, primera mejora de US$1M/año) quedan **~$6.502 netos**.
   En Play Console: Monetización → Productos → Crear producto único
   `cumbre30_pro` → precio $7.650. Y en "Configuración de monetización"
   inscribirse en el programa de desarrolladores pequeños.
   La compra se muestra solo en el AAB (export con `PLAY_BUILD=1`):
   Pagos y suscripciones → "Comprar con Google Play", con restauración.
2. **Canje por código (web y APK directo)**: la venta con Mercado Pago
   vive SOLO en la página web **`/pro`** (paleta CumbreLabs, link
   mpago.la/1WdyZaW + botón de aporte voluntario). El usuario paga allí,
   recibe el código C30P- por correo y lo activa en la app (validación
   offline HMAC). Envío manual al inicio: notificación de MP →
   `node scripts/gen-license.mjs correo` → responder con el código.
3. **Nada de links de compra dentro de la app**: Planes muestra los pasos
   ("paga en la web oficial → recibe código → actívalo aquí") sin enlace;
   HelpTab conserva contacto de soporte (permitido). El AAB lo genera
   `PLAY_BUILD=1 bash scripts/export-web.sh` antes de `npx cap sync android`
   y `bundleRelease`; el APK directo va sin el flag (assembleDebug).
