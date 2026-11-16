# Cumplimiento legal y trazabilidad de geocercas

**Fecha:** 2026-11-16 · **Alcance:** requerimiento «cumplimiento legal y trazabilidad de geocercas» · **Estado:** implementado (v1.12.12+) · **Motor de geocercas:** intocado.

## 1. Funcionalidades mantenidas

Nada se eliminó ni bloqueó. La detección GPS (pre-aviso a 100 m, alerta al entrar al radio, cooldown de 150 s), las alertas de voz (`alerts.speak`), el triple beep y la bitácora visual siguen en `src/hooks/useRideEngine.ts` (bloque «7) Zonas de riesgo»), sin una línea cambiada — verificado por `scripts/reg-geocercas.ts` (`git diff useRideEngine.ts = 0`). Las geocercas son informativas: ninguna regla bloquea recorridos.

## 2. Clasificación

Nueva en `src/lib/geocercas.ts` (`ClasificacionGeocerca`):

| Categoría | Uso | Geocercas |
| --- | --- | --- |
| `INFORMATIVE` | advertencias orientativas | defecto para ids futuros sin registro |
| `SAFETY` | zonas de riesgo y precaución | las 5 `RISK_ZONES` (Anáhuac, Antilén, Jardín Japonés, salida Pedro de Valdivia, Zoológico) |
| `OFFICIAL_RESTRICTION` | restricciones de fuente oficial verificada | accesos ciclistas autorizados y prohibidos (Parquemet), corte horario Tupahue→Cumbre |

**Regla dura (§2):** una geocerca cuya única fuente sea OpenStreetMap **no puede** clasificarse `OFFICIAL_RESTRICTION` — `clasificarGeocerca()` la degrada a `INFORMATIVE` (probado en la regresión con una geocerca OSM sintética). También exige `verification_status = verified_official` para la categoría oficial.

## 3. Procedencia y trazabilidad

Los 7 campos exigidos viven en `TrazabilidadGeocerca` (`source`, `source_reference`, `created_at`, `updated_at`, `verification_status`, `confidence_level`, `restriction_type`):

- **Zonas de riesgo:** campo inline en cada zona de `park.ts`. Fuente: coordenadas exactas entregadas por el cliente (2026-11-12/13, ya documentadas en los comentarios de procedencia del código), `verified_client`, confianza alta, `restriction_type: none`. `updated_at: 2026-11-16` (revisión de trazabilidad).
- **Accesos y corte horario:** tabla por id en `TRAZABILIDAD_GEOCERCAS` (9 entradas), fuente «Parquemet (administración del parque)», `verified_official`, restricciones `acceso_bicicletas` / `ingreso_bicicletas_prohibido` / `horario_fin_de_semana`.
- **Auditoría:** `validarTrazabilidad()` corre al cargar el módulo y en la regresión: campos completos, fechas ISO, `updated_at ≥ created_at` y la regla OSM.

**Visibilidad:** el popup de cada zona del mapa Explorar (`MapView.tsx`) muestra clasificación, fuente, fecha de verificación y la nota orientativa.

## 4. OpenStreetMap (ODbL)

- Atribución visible y con enlace en ambos mapas: minimapa (`navStyle.ts`: «© OpenStreetMap contributors · ODbL» con enlaces a copyright de OSM y a la licencia) y mapa Explorar (`MapView.tsx`, idem).
- **Obligaciones por bases derivadas:** `public/red-ciclista.json` (grafo de ruteo del APK) es una obra derivada de OSM que se distribuye, por lo que la atribución y la licencia ODbL viajan con la app (attribution en pantalla + tarjeta «Fuentes cartográficas y licencias» en Ayuda). La app no redistribuye la base OSM completa, solo un extracto ciclable procesado.
- **Nada de OSM se presenta como normativa oficial:** el texto de Ayuda lo declara explícitamente y la regla dura del §2 lo impone en el modelo de datos.

## 5. Mensajes de responsabilidad

El texto exigido aparece en dos lugares (clave i18n `cfg.disclaimerTexto` / `ay.terminosCuerpo`, en es/en/pt con el español como versión oficial):

> «Las alertas geográficas son orientativas y no sustituyen la señalización oficial, las disposiciones de la administración del parque ni las condiciones reales del terreno.»

- Configuración → General → **Seguridad** (fila «Alertas orientativas», al final de la tarjeta).
- Ayuda → tarjeta **Términos de uso**.

## 6. Protección de datos (Ley 21.719)

Tarjeta «Tus datos y privacidad (Ley 21.719)» en Ayuda, basada en lo que el código efectivamente hace (sin declaraciones que no se pueden cumplir):

- **Transparencia:** la ubicación se recopila solo durante el uso y se procesa en el propio dispositivo (detección de zonas, alertas, registro del ride).
- **Finalidad:** geocercas, distancias del ride y rutas; nada de publicidad ni compartición con otros usuarios.
- **Duración:** rides locales (plan gratis: últimos 20); con sesión, estadísticas y hasta 100 viajes con pista GPS sincronizados a la cuenta (`/api/rides`, `take: 100` en `src/app/api/rides/route.ts`), hasta borrarlos o eliminar la cuenta.
- **Protección del historial:** token de sesión privado (`serverToken`, HTTPS) — solo la cuenta titular lee sus rides.
- **Eliminación:** borrado de viaje por viaje (Mis viajes), desuscripción de push (`DELETE /api/push/subscribe`) y **baja definitiva de cuenta con todos los datos del servidor** (`DELETE /api/auth/account`, UI en Perfil → Eliminar cuenta; preexistente, exigida también por Play Store).
- **Control de acceso:** autenticación por token en los endpoints de datos; la app no usa ubicación en segundo plano fuera de un ride.

## 7. Restricción de cambios y regresión

El motor GPS, la detección, los radios y las alertas no cambiaron (verificado). Regresión nueva `scripts/reg-geocercas.ts` (ejecutar con `node node_modules/.bin/tsx scripts/reg-geocercas.ts`):

1. `git diff useRideEngine.ts = 0` (motor intocado) y park.ts sin cambios en radios/condiciones.
2. Detección idéntica en las 5 zonas: centro → alerta, +50 m sobre el radio → pre-aviso, +400 m → nada, cooldown → nada.
3. Trazabilidad completa (14 ids + 5 inline), regla OSM≠`OFFICIAL_RESTRICTION` probada con una geocerca OSM sintética.

Además: `tsc` 0 errores y `scripts/reg-rutas.ts` sin cambios (r1–r5 por ambos orígenes).

## Cambios de código

| Archivo | Cambio |
| --- | --- |
| `src/lib/geocercas.ts` | NUEVO — tipos, regla dura, tabla de trazabilidad (14 ids), auditoría en carga |
| `src/lib/park.ts` | Campo opcional `trazabilidad` en `RiskZone` + inline en las 5 zonas (data pura, sin lógica) |
| `src/components/MapView.tsx` | Popup de zona con clasificación/fuente/verificación/nota + attribution ODbL |
| `src/lib/navStyle.ts` | Attribution del minimapa con ODbL |
| `src/components/ConfigTab.tsx` | Fila «Alertas orientativas» en Seguridad |
| `src/components/HelpTab.tsx` | Tarjetas Fuentes y licencias / Términos de uso / Privacidad Ley 21.719 |
| `src/lib/i18n.ts` | Claves `geo.*`, `cfg.disclaimer*`, `ay.fuentes*/terminos*/privacidad*` (es/en/pt) |
| `scripts/reg-geocercas.ts` | NUEVO — regresión de detección + auditoría de trazabilidad |
