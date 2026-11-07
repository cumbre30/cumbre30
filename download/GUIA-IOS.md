# Guía iOS — Cumbre30 (Capacitor)

El proyecto iOS ya está generado y committeado en `ios/`. Este repo se
compila **solo en macOS** (Xcode de Apple no corre en Linux/servicios de
Windows — es restricción de Apple, no del proyecto).

```
Código compartido   →  src/ (misma app que el APK)
Build web offline   →  bash scripts/export-web.sh  → build-static/
Proyecto iOS        →  ios/App/App.xcworkspace  (bundle cl.cumbre30.app)
Versión actual      →  1.8.2 (code 27) en project.pbxproj
Íconos y splash     →  generados desde public/logo.svg (scripts/gen-ios-assets.mjs)
```

## Requisitos (una vez)

1. **Mac** con macOS 14+ y **Xcode 16+** (App Store, gratis).
2. **CocoaPods**: `brew install cocoapods`
3. **Node 20+**
4. Cuenta Apple: para instalar en tu propio iPhone basta una cuenta
   gratuita (expira cada 7 días). Para **TestFlight / App Store** se
   necesita **Apple Developer Program — US$99/año**
   (https://developer.apple.com/programs).

## Pasos en el Mac (cada build)

```bash
git clone <tu-repo> cumbre30 && cd cumbre30   # o git pull
npm install
bash scripts/export-web.sh          # genera build-static (13 MB)
npx cap sync ios                    # copia la web + pods
open ios/App/App.xcworkspace        # ¡el .xcworkspace, no el .xcodeproj!
```

En Xcode:
1. Target **App** → **Signing & Capabilities** → selecciona tu **Team**
   (el bundle ya está en `cl.cumbre30.app`).
2. Conecta un iPhone y presiona **Run** para probar, o
3. **Product → Archive → Distribute App** →
   - *TestFlight & App Store Connect* (oficial), o
   - *Ad Hoc* para .ipa de prueba con dispositivos registrados.

Subida al Store: el mismo Archive, o la app **Transporter** de Apple con
el .ipa. En App Store Connect: crear la app (iOS), misma ficha base,
screenshots de iPhone, y la revisión de Apple (suele tardar 24–48 h).

## Compilar sin Mac propio

- **Codemagic** (codemagic.io): plan gratuito con minutos macOS; tiene
  plantilla para Capacitor. Conectar el repo GitHub, firma con
  certificados, entrega .ipa o TestFlight automático.
- **GitHub Actions**: runner `macos-latest` trae Xcode; build sin firma
  o con secretos (.p12 + perfil). Útil para validar que compila.

## Importante: la compra Pro en iOS (regla de Apple)

Apple exige **In-App Purchase de Apple** (comisión 30%) para contenido
digital comprado DENTRO de la app. Mostrar el link de Mercado Pago
dentro de la app iOS = rechazo casi seguro (guía 3.1.1).

**Estrategia recomendada para iOS** (la licencia es offline y por correo,
así que funciona cruzada):
- La app iOS **oculta la compra con MP** reutilizando la bandera que ya
  existe para Google Play: `PLAY_BUILD=1 bash scripts/export-web.sh`
  antes de `npx cap sync ios`.
- El usuario iOS compra el código Pro en **cumbregeo.cl** (navegador,
  $6.500 vía Mercado Pago) y lo **activa en la app** con su correo:
  Perfil → Pagos y suscripciones → Habilitar modo Pro.
- En la versión iOS, el texto de venta dice "Activa Pro con tu código
  en cumbregeo.cl" sin precios ni links dentro de la app.

## Diferencias con Android

| | Android | iOS |
| --- | --- | --- |
| Compila en | Linux (este proyecto) | Solo macOS |
| Artefacto | APK/AAB | .ipa (vía Xcode) |
| Distribución | Play / descarga directa (`/api/apk`) | Solo App Store / TestFlight |
| Compra Pro | Play Billing (Play build) o MP (web) | Código comprado en web |
