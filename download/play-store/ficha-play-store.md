# Cumbre30 - Ficha para Google Play Console

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
| Sitio web | **https://cumbregeo.cl** (redirige a `/geo`, el sitio de Cumbre GEO: apps, detalles y planes) |
| Versión a subir | v1.8.5 (versionCode 31) - AAB listo: `cumbre30-v1.8.5-code31-play.aab` (generado con `PLAY_BUILD=1 bash scripts/build-android.sh`, firma release) |

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
Guarda tu QR Pedalea Seguro de Parquemet en el teléfono y muéstralo sin
señal: el registro oficial del parque para ciclistas de montaña, pensado
para emergencias y fiscalizaciones. La app no gestiona tus datos: solo
guarda la imagen del QR en tu teléfono.

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
| Captura 1 | `capturas/01-ride-mapa.png` | 1080×1920 - ciclocomputador |
| Captura 2 | `capturas/02-explorar.png` | 1080×1920 - destinos y rutas |
| Captura 3 | `capturas/03-desafios.png` | 1080×1920 - desafíos (con sesión muestra progreso) |
| Captura 4 | `capturas/04-perfil.png` | 1080×1920 - perfil |

Mínimo requerido: 2 capturas - ya hay 4 listas.

## Declaraciones obligatorias del Console

- **Política de privacidad (URL)**: `https://<tu-dominio-preview>/privacidad`
- **URL de eliminación de cuenta** (Seguridad de datos → obligatoria porque
  la app permite crear cuentas): `https://<tu-dominio-preview>/eliminar-cuenta`
  - el borrado real ya funciona: en la app (Perfil → Mis datos → Eliminar
  cuenta, con confirmación) y por API `DELETE /api/auth/account`.
- **Seguridad de datos (formulario)**:
  - Se recopilan: correo electrónico (cuenta), datos de actividad/fitness
    (rides: distancia, velocidad, ruta GPS), nombre de usuario.
  - Se procesan de forma efímera: ubicación precisa DURANTE el ride (no se
    sale del dispositivo salvo sincronización del ride en modo web).
  - No se comparte con terceros. No se vende. Cifrado en tránsito (HTTPS).
  - Eliminación: sí, por la app y por URL.
- **Clasificación de contenido**: cuestionario IARC - sin violencia, sin
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

## Pagos (Pro) - decisión v1.8.0: Play Billing + canje web

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
   vive SOLO en la venta web **`/cumbre30pro`** (vista de planes de /geo; alias heredado `/pro`) (link de cobro
   único mpago.la/2tghXUc - $6.500 precio fundador; el link anterior
   1WdyZaW era una suscripción anual y se reemplazó - + botón de aporte
   voluntario). El usuario paga allí,
   recibe el código C30P- por correo y lo activa en la app (validación
   offline HMAC). Envío AUTOMÁTICO (nov. 2026): webhook de Mercado Pago
   (`/api/mp/webhook`) + respaldo cron cada 15 min (`/api/mp/sync`) entregan
   el código sin intervención manual; respaldo semiauto:
   `POST /api/pro/send-code`; manual de última instancia: `gen-license.mjs`.
3. **Nada de links de compra dentro de la app**: Planes muestra los pasos
   ("paga en la web oficial → recibe código → actívalo aquí") sin enlace;
   HelpTab conserva contacto de soporte (permitido). El AAB de Play lo genera
   `PLAY_BUILD=1 bash scripts/build-android.sh` (export + sync + bundleRelease en
   un solo paso, con NEXT_PUBLIC_STATIC=1 incluido desde build 31); el APK directo
   va con PLAY_BUILD=0.

## Notas de la versión (para el release de Play)

v1.8.5 (versionCode 31):

```
• Corrección importante: el inicio de sesión (Google y correo) dentro de la app Android vuelve a funcionar; las cuentas se guardan en tu teléfono
• Preparación para Google Play: versión de tienda con compras dentro de la app
```

v1.8.4 (versionCode 30):

```
• Aviso por voz al entrar a las bajadas fiscalizadas de 30 km/h y avisos de ingreso/cierre del parque según horario
• Nueva capa de mapas: Paseo Metropolitano (8 tramos mixtos peatonales y ciclistas)
• Desafíos: nueva Serie Metropolitana (El anillo, Ida y vuelta, Cuatro anillos) y reto diario Vuelta al anillo
• Teléfono de emergencias del parque actualizado a 1466 (línea oficial Parquemet)
• Trazados MTB 1 y MTB 2 afinados: bajan los senderos reales completos
• Estadísticas Pro afinadas y mejoras de estabilidad
```

v1.8.3 (versionCode 29):

```
• Temas de color para toda la app y pantalla ride personalizable: velocímetro digital, arco, dial o aguja (Cumbre30 Pro)
• SOS ampliado: Parquemet, Municipalidad de Providencia y Salud Responde además de 133, 131 y 132
• Datos oficiales del parque: accesos, cumbres, senderos enduro y horario de ciclistas
• Descenso limpio: resumen cuando respetas los 30 km/h
• Mejoras de estabilidad
```

v1.8.2 (versionCode 28):

```
• Nueva marca: Cumbre GEO - sitio oficial cumbregeo.cl
• Compra Pro con entrega automática: tu código llega solo al correo tras pagar
• Mejoras de estabilidad
```

(v1.8.1 / code 26: link de cobro único corregido y precio Play en app;
v1.8.0 / code 25: monetización Pro - historial, estadísticas avanzadas,
GPX, constancias y segmentos.)
