# 🚴 Cumbre30

**Ciclocomputador con límite de 30 km/h para el Cerro San Cristóbal (Parquemet, Santiago de Chile).**

App Android nativa (APK) + vista web, construida con Next.js y Capacitor. Traza rutas reales por calle y ciclovía hasta los destinos del parque (Cumbre, Zoológico, Piscina Antilén, accesos…), mide velocidad/desnivel/tiempo, avisa por voz y pitidos cuando te pasas de 30 km/h dentro del parque, y guarda tu historial, retos y pines **sin necesidad de servidor** (todo queda en el teléfono).

## ✨ Funciones

- **Rutas por calle**: arranque siempre en tu ubicación GPS (sin líneas que crucen cuadras), preferencia por ciclovías, instrucciones voz + turnos, funcionando offline con mapa vectorial propio (grafo OSM de ~58k aristas del sector).
- **Límite 30 km/h**: geocercas del parque, alertas sonoras/voz, resumen de excesos por ride.
- **Inicio de sesión con Google** (APK): selector de cuentas nativo, sin Firebase ni servidor; si ya tienes cuenta con el mismo correo se enlaza y conservas km y logros. Requiere configurar el Client ID (ver `GUIA-GOOGLE-SIGNIN.md`).
- **Cuenta local sin servidor**: registro/login guardado en el teléfono (PBKDF2 100k), credencial QR Pedalea Seguro (solo guarda la imagen que emite Parquemet), logros y pines evaluados localmente.
- **Sync de progreso con la cuenta**: los km y logros del APK quedan enlazados a la cuenta — base IndexedDB con cola outbox que se sube sola al servidor (token Bearer); al iniciar sesión en cualquier teléfono recuperas todo tu progreso.
- **Amigos**: conexión mutua por nombre de usuario; cada uno ve los km totales, rides, velocidad máxima y logros del otro. Funciona en la web (cookies) y en el APK (token del servidor de cuenta).
- **Sensores Bluetooth nativos (APK)**: pulso cardíaco (HRM) y velocidad de rueda (CSC) por BLE nativo de Android — pide permisos, abre el selector del sistema y empareja por GATT; en la web sigue por Web Bluetooth (Chrome/Edge).
- **Demo en vivo en la web**: el modo demo corre en el navegador desde el botón "Probar demo" del modal en cumbregeo.cl/geo (ruta `/demo`) — probar la app sin instalar nada. El APK es solo GPS: el modo demo ya no existe dentro de la app.
- **Clima, ciudad y hora en tiempo real** en el banner del ride: Open-Meteo se refresca solo (cada 15 min y al volver del segundo plano), la ciudad sale del GPS por reverse geocoding (caché offline, fallback Santiago) y el reloj de Santiago corre en vivo.
- **Reportes de incidencias** en el mapa (baches, perros, obstáculos) con modo local si no hay conexión.
- **Temas y pantalla ride (Pro)**: color de la app completo (Cerro, Andes, Atardecer, Lila, Grafito), velocímetro personalizable (digital, arco, dial o aguja; tamaños grande y gigante) y altura del minimapa. En Configuración, con vista previa; persiste en el teléfono. La píldora compacta de modo (MODO PARQUE/LIBRE, pausa, exceso) reemplaza al banner grande en la pantalla ride.
- **SOS ampliado**: tarjeta de emergencia con 133/131/132 más Parquemet, Municipalidad de Providencia y Salud Responde, y compartir la ubicación GPS actual.
- **Descarga de la app** desde su propio botón de Perfil (endpoint `/api/apk`, versión única en `src/lib/appVersion.ts`).

## 🗂️ Estructura

```
src/
  app/            Páginas y rutas API (Next.js App Router)
  components/     UI (mapa, navegar, historial, retos, perfil, wallet…)
  hooks/          useMe (sesión), useIncidentFeed
  lib/            routing (grafo+A*), routingService (OSRM/Overpass),
                  offlineAuth (login sin servidor), appVersion, pins, db
android/          Proyecto Capacitor/Android (appId cl.cumbre30.app)
public/           Mapa vectorial (red-ciclista.json), iconos, manifest
scripts/          export-web.sh (APK), tests del enrutador, utilidades
prisma/           Esquema de base de datos (solo se usa en modo web/servidor)
```

## 🛠️ Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 20+ (o Bun) |
| JDK | 21 (Temurin recomendado) |
| Android SDK | platform 35/36, build-tools 35/36 |
| Capacitor CLI | `npm i -g @capacitor/cli` |

## 💻 Desarrollo web

```bash
npm install
npx prisma generate && npx prisma db push   # crea db/custom.db local
npm run dev                                  # http://localhost:3000
```

## 📦 Compilar el APK

```bash
# 1) Export estático con login offline (excluye las rutas API)
bash scripts/export-web.sh

# 2) Copiar la web al proyecto Android
npx cap sync android

# 3) Compilar
cd android && ./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

Versión y nombre de archivo se controlan en **`src/lib/appVersion.ts`** (fuente única) junto con `android/app/build.gradle` (`versionCode`/`versionName`).

> La APK se firma siempre con el mismo keystore debug (`android/debug.keystore`), así el SHA-1 no cambia entre builds y el inicio con Google sigue funcionando (ver `GUIA-GOOGLE-SIGNIN.md`).

## 🔐 Privacidad

- Sin analytics, sin trackers, sin cuentas en la nube: los datos del ciclista viven en el dispositivo.
- La base de datos del modo web (`db/custom.db`) es local y **no se sube al repo**.
- El modo servidor (login con BD) es opcional y solo se usa si despliegas la web.

## ✍️ Convenciones de texto

- **Sin guiones largos**: en todo el texto de la app, la web y la documentación se usa el guión simple `-` (nunca guión largo ni guión medio), también en cambios futuros.

## 📄 Licencia

Uso personal del autor. Los datos de mapa provienen de © OpenStreetMap contributors.
