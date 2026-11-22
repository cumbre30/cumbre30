# Motor GPS de Cumbre30 — documentación técnica (fase única 2026-11-22)

Esta fase estabiliza y modulariza el motor GPS según la auditoría
`Auditoria_Brechas_Motor_GPS_Cumbre30.docx` (54/100). El núcleo vive en
`src/motor/*` y es agnóstico de React, del parque San Cristóbal y de la
interfaz: puede moverse a un paquete TypeScript propio sin reescribir nada.

## 1. Proveedor de ubicación (verificación de fuente)

- **Proveedor Android**: `LocationManager.GPS_PROVIDER` a 1 Hz en el
  Foreground Service (`RideLocationService.kt`). La posición proviene
  del chip GNSS del dispositivo (GPS/GLONASS/Galileo/BeiDou según
  hardware). Verificación por fix: `loc.getProvider() == "gps"`.
- **A-GNSS ≠ Wi-Fi/red**: la asistencia A-GNSS solo acelera la primera
  adquisición de satélites (efemérides por red). La posición resultante
  sigue siendo un cálculo de rango GNSS. La app **no usa**
  `NETWORK_PROVIDER` ni FusedLocationProvider para el ride; no hay
  triangulación Wi-Fi/celular en la medición.
- **Sin Play Services**: el motor no depende de Google Play Services
  (condición D.3 del encargo).

## 2. Arquitectura de módulos

| Módulo | Archivo | Responsabilidad | Reutilizable |
|---|---|---|---|
| GPS Core | `android/…/RideLocationService.kt`, `RideNativePlugin.kt` | captura GNSS 1 Hz, FGS, puente de fixes | AAR futuro |
| Location Source | `src/motor/fuente.ts` | interfaz `FuenteUbicacion` con fábricas nativa/web/sim | sí |
| Position Processing | `src/motor/procesamiento.ts` | frescura, accuracy, salto dinámico, extrap. de velocidad | sí |
| Signal Filtering | `src/motor/kalman.ts` | `KalmanVelocidad` con R adaptativo y compuertas | sí |
| Metrics Engine | `src/motor/metricas.ts` | distancia, altitud, desnivel con histéresis, tiempos por reloj, track, serialización | sí |
| Activity Engine | `src/motor/actividad.ts` | FSM idle/corriendo/pausada/autoPausada | sí |
| Persistence Layer | `src/motor/persistencia.ts` | checkpoint validado + fábricas de almacén | sí |
| Activity Profiles | `src/motor/config.ts` | `MotorConfig` con validación de rangos + perfil persistido de la app | sí |
| Integration API | `src/motor/nucleo.ts` + `src/motor/tipos.ts` | `MotorGPS`: pipeline + checkpoint + `EventoMotor` tipados | sí |
| Consumidor Cumbre30 | `src/hooks/useRideEngine.ts` | reglas del parque (geocercia, accesos, zonas, corredores, bajadas 30, horario, fiscalización 30, caída, vehículo), voz, UI | Cumbre30 |

Flujo: `FuenteUbicacion → ProcesadorPosicion → MotorActividad →
MotorMetricas → checkpoint → EventoMotor → oyentes (consumidor)`.

## 3. Correcciones de la auditoría incluidas

| ID auditoría | Corrección | Dónde |
|---|---|---|
| P0-1 (sin checkpoint) | checkpoint cada 15 s + hitos (pausa, `visibilitychange hidden`, `pagehide`), validación y diálogo de recuperación | `nucleo.ts`, `persistencia.ts`, `page.tsx` |
| P0-2 (deriva en reposo) | distancia Doppler-gated: con velocidad bajo el umbral (2.5 km/h) la distancia es 0; km del parque con el mismo criterio | `metricas.ts` |
| P0-3 (altitud→0) | `hasAlt` + `valt` en el plugin nativo; alt ausente = nula (se conserva la última válida); `valt ≥ 30 m` no alimenta el desnivel | `RideNativePlugin.kt`, `fuente.ts`, `metricas.ts` |
| D4 (gain sin histéresis) | EMA lenta de desnivel (α 0.1) + histéresis 4 m; calibrado contra ruido σ=10-15 m (gain en plano ≤ ~5-17 m por 2 min; subida real 50 m ≥ 90 % capturada) | `metricas.ts`, `config.ts` |
| D5 (tiempo por fixes) | elapsed por reloj de pared menos pausas; pérdida de señal no resta tiempo; `movingSec` con el umbral unificado | `metricas.ts`, `actividad.ts` |
| D6 (sin auto-pausa) | FSM configurable (`autoPausa.activada`, `kmhParada` 2.0, `segParada` 15, `kmhReanudar` 3.0) + toggle en Ajustes → Seguridad | `actividad.ts`, `ConfigTab.tsx` |
| R6 (umbrales 1.5/2.5) | umbral de movimiento único (2.5 km/h) en motor, resumen y km del parque | `config.ts` |
| R7 (GPS ambiental) | el watch ambiental se detiene con la app oculta/bloqueada y al iniciar ride | `useRideEngine.ts` |
| R1 (Kalman fijo) | R adaptativo por accuracy (`rAccReferenciaM` 6, `rAccMax` ×4) | `kalman.ts` |
| R2 (extrapolación al frenar) | extrapolación de 400 ms subiendo, 100 ms frenando | `procesamiento.ts` |

Salto de posición: umbral dinámico `max(saltoBaseM=100, v·dt·4)`.

## 4. Interfaces principales (Integration API)

```ts
const motor = new MotorGPS({ config?: Partial<MotorConfig>, almacen?: AlmacenCheckpoint, ahora?: () => number });
const off = motor.on((e: EventoMotor) => { /* "fix" | "estado" | "alerta" */ });
motor.iniciar(fuente);            // FuenteUbicacion (nativa/web/sim)
motor.pausar(); motor.reanudar(); // FSM
const snap = motor.snapshot();    // { estado, metricas, track }
const final = motor.detener();    // cierra sesión y borra checkpoint
motor.setExtra({...});            // contadores del consumidor al checkpoint
motor.forzarCheckpoint();         // pagehide / visibilitychange
motor.hayRecuperacion(); motor.leerRecuperacion();
motor.retomar(cp, fuente); motor.descartarRecuperacion();
motor.setAutoPausa(on);           // perfil en vivo
```

`MetricasMotor`: `distanciaM, movingSec, elapsedSec, secAutoPausa,
velKmh, velMaxKmh, gainM, lossM, altMinM, altMaxM, pendientePct,
rumboDeg, fixes`.

`EventoMotor`: `{tipo:"fix", metricas, fix, dtSec, velKmh, estado}` ·
`{tipo:"estado", antes, ahora, motivo}` · `{tipo:"alerta", codigo,
detalle?}`.

## 5. Configuración (Activity Profiles)

`MotorConfig` en `src/motor/config.ts` — defectos = valores históricos
salvo los cambios deliberados (ver §3). Rangos validados por
`resolverMotorConfig`; jamás lanza. Cumbre30 persiste su perfil en
`localStorage["cumbre30-motor-cfg-v1"]` (`leerConfigMotor`,
`autoPausaActivada`, `setAutoPausaActivada`). Otra aplicación puede
inyectar su propio objeto o almacén.

## 6. Recuperación de ride (flujo)

1. Durante el ride el motor escribe un checkpoint (localStorage del
   WebView) cada `checkpointCadaSec` (15 s), al pausar, al ocultar la
   app y en `pagehide`.
2. Si el WebView/proceso muere, el checkpoint sobrevive. Al reabrir,
   `useRideEngine` consulta `hayRecuperacion()` y la UI muestra
   «¿Retomar el ride interrumpido?» (fecha, km, minutos).
3. **Retomar**: reconstruye métricas, Kalman, FSM y contadores del
   parque (`extra`) y reabre la fuente; **Descartar**: borra el
   checkpoint. Al detener normalmente el checkpoint se elimina.
4. Límites conocidos: el intervalo entre checkpoints (15 s) es la
   ventana máxima de pérdida; si Android borra el WebView Storage el
   checkpoint se pierde (sin mitigación posible por software).

## 7. Pruebas

- `npx tsx tests/motor-gps.test.ts` — 22 verificaciones deterministas
  del núcleo (banda muerta, coherencia d-t-v, túnel de señal, cadena
  vertical con ruido, FSM, gates, Kalman, checkpoint/recuperación,
  RideSimulator con semilla).
- `RideSimulator` acepta `semilla` (mulberry32) para corridas
  reproducibles.
- Suites existentes sin regresiones (route-geo, proteccion-ruta,
  rutas-store, tarjetas-share, rutas-ficha, explorar-view: OK).
- Las suites con base de datos (cultura, fase-f, comunidad, muro,
  api-routes, catalogo-geo) requieren `DATABASE_URL` accesible; en el
  sandbox sin Postgres no se ejecutan (limitación ambiental, no de código).

## 8. Compatibilidad y cambios con impacto

- **Nativo**: `RideNativePlugin.kt` añade `hasAlt` y `valt` al evento
  `gpsfix` (retrocompatible: el JS valida la presencia). Requiere
  recompilar el APK para efectos completos de la cadena vertical.
- **API del hook**: la pública no cambió; se añadieron `autoPausada`,
  `recuperacion`, `retomarRide()`, `descartarRecuperacion()`.
- **Persistencia de base de datos**: sin cambios de esquema (el
  checkpoint vive en localStorage del WebView, no en la BD).
- **geo.ts `SpeedKalman`** se conserva por compatibilidad; el motor usa
  `src/motor/kalman.ts` (evolución con R adaptativo).

## 9. Preparado para segunda aplicación

Un proyecto externo puede: crear `MotorGPS` con su `MotorConfig`,
elegir/crear su `FuenteUbicacion`, suscribirse a `EventoMotor`, leer
`snapshot()`, proveer su `AlmacenCheckpoint` y aplicar sus reglas de
negocio sobre los eventos — sin importar nada de Cumbre30. La
distribución futura (paquete TS + AAR) queda preparada estructuralmente,
sin publicarse en esta fase.
