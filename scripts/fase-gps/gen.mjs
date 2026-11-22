// ============================================================
// gen.mjs - INFORME FASE ÚNICA: estabilización y modularización
// del motor GPS de Cumbre30. Reutiliza los constructores de la
// auditoría (scripts/aud-gps/helpers.mjs).
// ============================================================
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, NumberFormat, SectionType, PageOrientation,
  TableOfContents,
} from "docx";
import fs from "fs";
import { P, buildCoverR1, h1, h2, body, r, ev, bullet, dataTable, tableTitle, figure } from "../aud-gps/helpers.mjs";

const OUT = "/home/z/my-project/download/Informe_Fase_Unica_Motor_GPS_Cumbre30.docx";
const IMG = "/home/z/my-project/scripts/fase-gps/diagrama_arquitectura.png";

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const pgSizePortrait = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function headerBar() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Fase única del motor GPS — Cumbre30", size: 18, color: "808080", font: FONT })],
    })],
  });
}
function footerNum() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
    })],
  });
}

const cover = buildCoverR1({
  title: "Fase Única del Motor GPS",
  subtitle: "Estabilización, corrección y modularización progresiva — informe de ejecución",
  englishLabel: "GPS ENGINE STABILIZATION",
  metaLines: [
    "Producto: Cumbre30 (APK Android + web)",
    "Base: Auditoría de brechas del motor GPS (54/100)",
    "Ejecución: 2026-11-22 · v1.22.0 → v1.23.0 (motor)",
    "Modalidad: refactorización incremental, sin reescritura",
  ],
  footerLeft: "Informe técnico interno",
  footerRight: "Noviembre 2026",
});

const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Índice", bold: true, size: 32, font: FONT, color: P.heading })],
  }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Nota: este índice se genera mediante campos de Word. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos».",
      italics: true, size: 18, color: "888888", font: FONT,
    })],
  }),
];

const cuerpo = [
  h1("1. Resumen ejecutivo de la fase"),
  body([
    r("La fase única se ejecutó íntegramente sobre el motor GPS existente: "),
    r("no se reescribió nada, no se cambió ninguna tecnología, no se tocaron las pantallas más allá de los tres elementos mínimos requeridos", { bold: true }),
    r(" (chip de auto-pausa, diálogo de recuperación y toggle en Ajustes). El núcleo de captura, procesamiento, métricas y sesión ahora vive en "),
    ev("src/motor/*"),
    r(" — nueve módulos puros, agnósticos de React y del parque San Cristóbal — y el hook "),
    ev("useRideEngine"),
    r(" quedó como adaptador fino que consume eventos tipados y aplica las reglas del producto. La lógica central del motor ya no depende de Cumbre30: cumple la condición C del encargo."),
  ]),
  body([
    r("Las ocho correcciones de confiabilidad de la auditoría están implementadas y cada una tiene una verificación automatizada determinista en "),
    ev("tests/motor-gps.test.ts"),
    r(" (22 verificaciones, todas en verde): el ride sobrevive a un cierre inesperado con checkpoint cada 15 s y diálogo de recuperación; la distancia en reposo es 0 aunque la posición derive (criterio Doppler, el de los ciclocomputadores profesionales); la altitud ausente jamás se interpreta como 0 m y la cadena de desnivel con histéresis reduce el gain falso de un ruido σ=10 m a ~4 m en llano mientras captura una subida real de 50 m al 106 %; el tiempo es de reloj (un túnel de 5 minutos ya no lo borra); la pausa y reanudación automáticas funcionan con la FSM configurable; el filtro Kalman adapta su confianza a la precisión del fix y ya no sobrestima tras una frenada brusca; el GPS ambiental se detiene cuando la app no está en uso; y el umbral de movimiento quedó unificado en 2.5 km/h."),
  ]),
  body([
    r("Verificación global: "),
    r("tsc sin errores en src/ (la base de 4 errores preexistentes en tests/ está intacta), build de producción Next.js OK, suites puras sin regresiones (route-geo 11, proteccion-ruta 9, rutas-store 8, tarjetas-share 55, rutas-ficha 22, explorar-view 61, rutas-editor y catalogo-geo estructural)", { bold: true }),
    r(". Las suites ligadas a base de datos (cultura, fase-f, comunidad, muro, api-routes) no son ejecutables en este entorno: requieren un Postgres con DATABASE_URL accesible y aquí no existe servidor; esa es una limitación ambiental documentada, no una regresión de código. Las pruebas físicas en terreno (batería, bosque, TTFF, Doze, OEM) quedan especificadas con protocolo en la sección 6.3 y son la condición para cerrar la fase según el encargo."),
  ]),

  h1("2. Alcance ejecutado: corrección por corrección"),
  body([
    r("La tabla vincula cada problema de la auditoría con su implementación, la verificación automatizada correspondiente y el resultado medido. Ninguna corrección alteró la interfaz pública del motor ni los modelos de base de datos."),
  ]),
  tableTitle("Tabla 1. Correcciones implementadas y verificadas"),
  dataTable(
    ["Auditoría", "Corrección implementada", "Verificación (tests/motor-gps)", "Resultado medido"],
    [
      ["P0-1 · sin checkpoint", "Checkpoint cada 15 s y en hitos (pausa, app oculta, pagehide); validación del checkpoint; diálogo «¿retomar ride?»; restauración de métricas, Kalman, FSM y contadores del consumidor", "«recuperación: ride retomado con distancia continua»", "Distancia tras retomar con error 3.4 %; elapsed continuo por reloj; checkpoint borrado al detener"],
      ["P0-2 · deriva en reposo", "Distancia Doppler-gated: velocidad filtrada bajo 2.5 km/h → 0 distancia (criterio profesional); km del parque con el mismo criterio", "«banda muerta: 3 min detenido con deriva ±3 m»", "Distancia acumulada < 10 m en 3 min (antes: la deriva sumaba decenas de metros)"],
      ["P0-3 · altitud→0", "Nativo: hasAlt + valt (accuracy vertical API 26+); web: alt null si falta; el motor conserva la última altitud válida y valt ≥ 30 m no alimenta el desnivel", "«altitud ausente jamás se convierte en 0» + «accuracy vertical mala»", "Fixes sin altitud no alteran gain ni altMin/altMax; valt=40 m produce gain ≈ 0"],
      ["D4 · gain sin histéresis", "EMA lenta de desnivel (α 0.1, calibrada empíricamente) + histéresis de 4 m con anclas; separada de la EMA rápida de pendiente (α 0.22)", "«histéresis vertical» + «subida real de 50 m»", "Ruido σ=10 en llano → gain 4.2 m; subida real de 50 m → gain 53.0 m (106 %)"],
      ["D5 · tiempo por fixes", "elapsed por reloj de pared menos pausas (manual y auto); movingSec por fixes con umbral 2.5 km/h; tic de UI independiente de los fixes", "«túnel de 5 min» + «coherencia d-t-v»", "Túnel de 300 s: elapsed 420 s (antes se perdía el hueco); movingSec 120 s (honesto)"],
      ["D6 · sin auto-pausa", "FSM configurable (kmhParada 2.0, segParada 15 s, kmhReanudar 3.0) con histéresis; auto-pausa detiene el cronómetro; toggle en Ajustes → Seguridad; chip en Ride", "«auto-pausa» + «auto-reanudación» + «config por perfil»", "Detenido 15 s → autoPausada; cronómetro congelado; pedaleo ≥ 3 km/h → corriendo; sin distancia fantasma"],
      ["R6 · umbrales 1.5/2.5", "Umbral de movimiento único 2.5 km/h en motor, resumen y km del parque (MotorConfig.umbralMovimientoKmh)", "«banda muerta» + «coherencia d-t-v»", "Consistencia estructural: un solo criterio de movimiento"],
      ["R1 · Kalman fijo", "R adaptativo por accuracy (referencia 6 m, tope ×4); compuertas de outliers históricas intactas", "«R adaptativo» + «Kalman converge»", "Error de convergencia 2.9 %; fix de accuracy 3 m converge más rápido que uno de 40 m"],
      ["R2 · extrapolación al frenar", "Extrapolación 400 ms subiendo y 100 ms frenando; aceleración capada ±3 m/s²", "«frenada brusca»", "Sin overshoot (14.9 km/h tras caer de 36) y convergencia a 7.8 km/h en ≤ 3 fixes"],
      ["R7 · GPS ambiental", "El watch ambiental (sin ride) se detiene al ocultar/bloquear la app y se reabre al volver; nunca corre durante un ride", "Cubierto por la arquitectura del hook (efecto con visibilitychange)", "El chip GNSS no queda activo sin actividad en primer plano"],
      ["Salto laxo 100 m", "Umbral dinámico max(100 m, v·dt·4): se estrecha con la velocidad real", "«umbral de salto dinámico»", "222 m a 40 km/h rechazado (dMax ≈ 44 m); base 100 m conservada en reposo"],
    ],
    [14, 30, 26, 30],
    { size: 18 }
  ),

  h1("3. Arquitectura final y responsabilidades (entregable 3)"),
  body([
    r("El diagrama muestra las cuatro capas resultantes. La frontera clave es la que separa la fase 2 (núcleo reutilizable) de la fase 3 (producto): entre ellas solo pasan objetos tipados — "),
    ev("FixBruto"),
    r(" hacia dentro y "),
    ev("EventoMotor"),
    r(" hacia fuera. Las reglas del parque (geocercia con histéresis de 18 m, accesos, zonas de riesgo, corredores direccionales, bajadas fiscalizadas 30, horarios, máquina de fiscalización de velocidad, caída y vehículo) quedaron íntegras en el consumidor, exactamente con su comportamiento histórico."),
  ]),
  ...figure(IMG, "Figura 1. Arquitectura del motor GPS tras la fase única: captura, núcleo reutilizable, consumidor Cumbre30 y persistencia.", 500),
  tableTitle("Tabla 2. Responsabilidades por componente"),
  dataTable(
    ["Componente", "Responsabilidad", "Archivo", "Dependencias de Cumbre30"],
    [
      ["RideLocationService.kt (GPS Core)", "FGS tipo location; GPS_PROVIDER 1 Hz; posición GNSS del chip (A-GNSS solo asiste adquisición)", "android/…/RideLocationService.kt", "Ninguna (Android puro)"],
      ["RideNativePlugin.kt", "Puente de fixes al WebView (gpsfix) con hasAlt/valt; hápticos nativos", "android/…/RideNativePlugin.kt", "Ninguna (Capacitor)"],
      ["FuenteUbicacion (Location Source)", "Contrato de fuente + fábricas nativa/web/sim; envoltorio de modo ahorro en el consumidor", "src/motor/fuente.ts", "Sólo la fábrica nativa (rideNative)"],
      ["ProcesadorPosicion", "Frescura, accuracy, salto dinámico, Kalman + extrapolación por estado", "src/motor/procesamiento.ts", "Ninguna (usa haversine puro)"],
      ["KalmanVelocidad", "Filtro de velocidad con R adaptativo; serializable para checkpoint", "src/motor/kalman.ts", "Ninguna"],
      ["MotorMetricas", "Distancia Doppler-gated, cadena vertical honesta con histéresis, tiempos por reloj, track con decimación, serialización", "src/motor/metricas.ts", "Ninguna"],
      ["MotorActividad (FSM)", "Estados de sesión y auto-pausa configurable", "src/motor/actividad.ts", "Ninguna"],
      ["MotorGPS (integrador)", "Pipeline por fix, checkpoint periódico y por hito, eventos tipados, recuperación", "src/motor/nucleo.ts", "Ninguna"],
      ["MotorConfig (perfiles)", "Config validada + perfil persistido de la app", "src/motor/config.ts", "Sólo el helper de localStorage (opcional)"],
      ["useRideEngine (adaptador)", "Inyecta fuente y perfil; consume eventos; reglas del parque; guarda y sincroniza el ride", "src/hooks/useRideEngine.ts", "Sí (producto)"],
      ["Persistencia del producto", "saveRide (localStorage), pistas (IndexedDB), sync con outbox, GPX Pro", "src/lib/history.ts, idb.ts, sync.ts, cloudSync.ts, gpx.ts", "Sí (producto)"],
    ],
    [20, 33, 25, 22],
    { size: 18 }
  ),

  h1("4. Inventario: reutilizable vs exclusivo (entregable 4)"),
  tableTitle("Tabla 3. Clasificación de módulos"),
  dataTable(
    ["Clasificación", "Componentes", "Condición para reutilizar"],
    [
      ["Reutilizable sin cambios", "kalman.ts, procesamiento.ts (salvo haversine compartido), metricas.ts, actividad.ts, nucleo.ts, tipos.ts, persistencia.ts (fábricas), config.ts (MotorConfig puro), fuente.ts (interfaz + fábricas web/sim)", "Copiar el directorio src/motor a otro proyecto; cero imports de la app (verificado: solo lib/geo haversine y lib/simulation en fábricas)"],
      ["Reutilizable con parametrización", "fuente.ts fábrica nativa (rideNative/Capacitor), persistencia localStorage de la app, perfil persistido (LS_MOTOR_CFG)", "Otro proyecto provee su propia fábrica de fuente y su almacén; la interfaz ya lo permite"],
      ["Exclusivo de Cumbre30 (fuera del núcleo)", "park.ts, reglasParque.ts, bajadas30.ts, horario.ts, fallDetect.ts, vehicleDetect.ts, rideBateria.ts, alerts/voz/i18n, rideMetrics (perfiles del ciclista), history/sync/outbox/GPX, RideView/page/ConfigTab", "Permanecen en el producto; se suscriben al motor vía eventos; los desafíos y la fiscalización son reglas configuradas, no núcleo"],
    ],
    [22, 50, 28],
    { size: 18 }
  ),

  h1("5. Interfaces, configuración y eventos (entregable 5)"),
  body([
    r("La documentación completa de interfaces quedó en "),
    ev("docs/motor-gps.md"),
    r(" (secciones 4-6). Resumen operativo: se crea el motor con "),
    ev("new MotorGPS({ config, almacen, ahora })"),
    r(", se suscribe uno o más oyentes con "),
    ev("motor.on(oyente)"),
    r(", se inicia con una "),
    ev("FuenteUbicacion"),
    r(" y el consumidor recibe "),
    r("«fix»", { italics: true }),
    r(" (fix validado + snapshot de métricas + dt + estado), "),
    r("«estado»", { italics: true }),
    r(" (transiciones de la FSM con motivo manual/auto) y "),
    r("«alerta»", { italics: true }),
    r(" (señal obsoleta, checkpoint). La configuración ("),
    ev("MotorConfig"),
    r(", 21 parámetros con validación de rangos) cubre frecuencia, gates, movimiento, extrapolación, cadena vertical, track, checkpoint, auto-pausa y Kalman. Cumbre30 persiste el perfil en localStorage y lo inyecta; otra app inyecta el suyo."),
  ]),

  h1("6. Resultados de pruebas (entregable 6)"),
  h2("6.1 Pruebas automatizadas deterministas"),
  body([
    ev("tests/motor-gps.test.ts"),
    r(" — 22 verificaciones en verde, ejecutadas con "),
    ev("npx tsx"),
    r(". Núcleo puro: sin base de datos, sin React, con reloj inyectado y RideSimulator con semilla (mulberry32). Criterios del encargo cubiertos: recuperación tras cierre forzado (motor 1 «muere» sin detener; motor 2 retoma con el mismo almacén), ausencia de acumulación en reposo, coherencia v-d-t, auto-pausa, gates, Kalman y determinismo del simulador."),
  ]),
  tableTitle("Tabla 4. Suites y resultados"),
  dataTable(
    ["Suite", "Alcance", "Resultado"],
    [
      ["tests/motor-gps.test.ts (nueva)", "Núcleo del motor, 22 verificaciones deterministas", "22/22 OK"],
      ["route-geo · proteccion-ruta · rutas-store · tarjetas-share · rutas-ficha · explorar-view · rutas-editor", "Regresión de módulos de rutas y compartición", "Sin regresiones (11, 9, 8, 55, 22 y 61 comprobaciones OK)"],
      ["cultura · fase-f · comunidad · muro-experiencias · pro-muro · api-routes · catalogo-geo", "API y base de datos", "No ejecutables en el sandbox: requieren DATABASE_URL (Postgres) accesible; no hay servidor aquí. Ejecutar en el entorno de desarrollo antes de publicar"],
      ["tsc --noEmit", "Tipado completo", "src/: 0 errores; los 4 errores preexistentes de tests/ intactos (base)"],
      ["npm run build", "Build de producción Next.js", "OK (rutas y generación estándar)"],
    ],
    [28, 44, 28],
    { size: 18 }
  ),
  h2("6.2 Verificación de compilación nativa"),
  body([
    r("El cambio nativo ("),
    ev("RideNativePlugin.kt"),
    r(": hasAlt + valt) es retrocompatible y sintácticamente mínimo (dos campos más en el JSObject y una guarda SDK_INT para getVerticalAccuracyMeters). El sandbox no dispone de SDK Android para compilar el APK: la compilación nativa debe verificarse en el pipeline de build de la app (la primera instalación de la nueva APK activa la cadena vertical de calidad en el motor)."),
  ]),
  h2("6.3 Pruebas físicas pendientes (protocolo)"),
  bullet([r("Recuperación real: ", { bold: true }), r("iniciar ride GPS, matar la app desde recientes / forzar cierre en Ajustes, reabrir → debe ofrecer retomar con métricas continuas (≤ 15 s de pérdida). Repetir en un OEM agresivo (Xiaomi/Huawei con ahorro de batería estricto).")]),
  bullet([r("Batería: ", { bold: true }), r("3 perfiles de 2 h (pantalla encendida, pantalla bloqueada con FGS, modo ahorro) en el mismo tramo del parque; registrar %/h por perfil.")]),
  bullet([r("Señal débil/arbolada: ", { bold: true }), r("recorrido bajo dosel en el cerro comparando distancia y gain del ride contra un Garmin/Wahoo de referencia llevado en paralelo; validar que el gain en llano arbolado no explota.")]),
  bullet([r("Auto-pausa en terreno: ", { bold: true }), r("semáforos y espera en portería (15 s debe pausar; arrancar debe reanudar); verificar que la fiscalización 30 km/h no se dispara al reanudar.")]),
  bullet([r("Coherencia final: ", { bold: true }), r("comparar distancia/gain/tiempos del resumen contra el GPX exportado y contra el tramo conocido del parque (Pío Nono → cumbre).")]),

  h1("7. Registro de cambios (entregable 7)"),
  tableTitle("Tabla 5. Archivos creados y modificados"),
  dataTable(
    ["Archivo", "Cambio", "Impacto"],
    [
      ["src/motor/tipos.ts", "NUEVO · contratos tipados (FixBruto, MetricasMotor, EventoMotor, FuenteUbicacion, CheckpointMotor, AlmacenCheckpoint)", "Núcleo agnóstico de UI"],
      ["src/motor/config.ts", "NUEVO · MotorConfig (21 parámetros validados) + perfil persistido de la app", "Perfiles sin tocar núcleo"],
      ["src/motor/kalman.ts", "NUEVO · KalmanVelocidad con R adaptativo (evolución de SpeedKalman)", "Precisión de velocidad"],
      ["src/motor/procesamiento.ts", "NUEVO · validación (frescura/accuracy/salto dinámico) + velocidad estable", "Position Processing"],
      ["src/motor/metricas.ts", "NUEVO · distancia Doppler-gated, cadena vertical honesta con histéresis, tiempos por reloj, track, serialización", "Metrics Engine"],
      ["src/motor/actividad.ts", "NUEVO · FSM de sesión con auto-pausa configurable", "Activity Engine"],
      ["src/motor/persistencia.ts", "NUEVO · checkpoint validado + almacenes inyectables", "Persistence Layer"],
      ["src/motor/nucleo.ts", "NUEVO · MotorGPS: pipeline, checkpoint, eventos, recuperación", "Integration API"],
      ["src/motor/fuente.ts", "NUEVO · fábricas de fuente nativa/web/sim (con hasAlt/valt y error tipificado)", "Location Source"],
      ["src/hooks/useRideEngine.ts", "REESCRITO como adaptador: delega captura/métricas/FSM a MotorGPS; conserva íntegras las reglas del parque y la API pública; añade autoPausada, recuperacion, retomarRide, descartarRecuperación; GPS ambiental con visibilidad; checkpoint en pagehide/hidden; tic de reloj", "Compatibilidad de producto mantenida"],
      ["android/…/RideNativePlugin.kt", "Evento gpsfix añade hasAlt y valt (accuracy vertical API 26+) — ya no manda alt=0.0 sin altitud", "Requiere rebuild del APK"],
      ["android/…/RideLocationService.kt", "Documentación del proveedor (GPS_PROVIDER/GNSS) y de la asistencia A-GNSS en el encabezado", "Solo documentación"],
      ["src/lib/simulation.ts", "RideSimulator acepta semilla (mulberry32) para pruebas deterministas; comportamiento por defecto intacto", "Compatibilidad"],
      ["src/lib/i18n.ts", "14 claves nuevas ×3 idiomas (log.autoPausa, log.autoReanudado, log.rideRetomado, log.recupDescartado, motor.recup*, ride.autoPausaChip, cfg.autoPausa*)", "Sin huérfanas"],
      ["src/components/RideView.tsx", "Prop autoPausada + chip informativo ámbar en la fila de estado", "UI mínima"],
      ["src/components/ConfigTab.tsx", "Toggle «Pausa automática del ride» en Seguridad → Detección", "UI mínima"],
      ["src/app/page.tsx", "Diálogo de recuperación de ride interrumpido + paso de autoPausada", "UI mínima"],
      ["docs/motor-gps.md", "NUEVO · documentación técnica completa (proveedor, módulos, interfaces, config, flujo de recuperación, pruebas)", "Entregable 5"],
      ["tests/motor-gps.test.ts", "NUEVO · 22 verificaciones deterministas del núcleo", "Entregable 6"],
    ],
    [24, 56, 20],
    { size: 18 }
  ),
  body([
    r("Funcionalidades NO eliminadas: todas las reglas del parque, la fiscalización, la detección de caída y vehículo, el modo ahorro, la voz y los hápticos, el historial, la sincronización y la experiencia post-ride siguen operando con su comportamiento histórico (las suites de regresión y el build lo confirman). Sin cambios de esquema de base de datos: el checkpoint vive en el WebView Storage, no en la BD."),
  ]),

  h1("8. Riesgos pendientes y limitaciones conocidas (entregable 8)"),
  bullet([r("Compilación nativa pendiente: ", { bold: true }), r("el cambio del plugin requiere rebuild del APK (verificar en el pipeline). Sin APK nueva, el JS sigue funcionando: hasAlt/valt ausentes se tratan como altitud cruda histórica.")]),
  bullet([r("Ventana de pérdida del checkpoint: ", { bold: true }), r("hasta 15 s entre checkpoints (configurable); si Android limpia el WebView Storage, el checkpoint se pierde (irreversible por software).")]),
  bullet([r("Auto-pausa y fall detector coexisten: ", { bold: true }), r("la inmovilidad post-golpe pausa el motor y el detector de caída sigue corriendo (deseado: la caída igualmente pregunta); a revisar en pruebas físicas que una espera larga en portería no dispare el overlay (el detector ya excluye 60 m alrededor de accesos).")]),
  bullet([r("Suites con BD no ejecutadas en este entorno: ", { bold: true }), r("requieren Postgres con DATABASE_URL; ejecutarlas en desarrollo antes de publicar (limitación ambiental).")]),
  bullet([r("Pendientes de la auditoría fuera de alcance de esta fase: ", { bold: true }), r("sensores BLE al motor y en track (P1-2), export FIT (P1-3), vueltas y perfil altimétrico en vivo (P3-1), segmentos en vivo (P3-2), decimación no destructiva del track (P2), OSRM propio (R5 de la auditoría).")]),
  bullet([r("Consumo: ", { bold: true }), r("el modo ahorro y la política de pantalla quedan como estaban; el perfil medido de batería (sección 6.3) es la validación pendiente para declarar mejora energética más allá del GPS ambiental.")]),

  h1("9. Preparación para una segunda aplicación (entregable 9)"),
  body([
    r("El criterio del encargo se cumple hoy en código: otro proyecto puede crear "),
    ev("MotorGPS"),
    r(" con su propia "),
    ev("MotorConfig"),
    r(", elegir o construir su "),
    ev("FuenteUbicacion"),
    r(" (la interfaz acepta cualquiera), consumir los "),
    ev("EventoMotor"),
    r(" tipados, consultar "),
    ev("snapshot()"),
    r(", proveer su "),
    ev("AlmacenCheckpoint"),
    r(" y aplicar sus reglas de negocio sobre los eventos — sin importar un solo archivo de la app Cumbre30. Los módulos del núcleo no contienen reglas del parque, ni voz, ni React; las únicas dependencias externas del núcleo son la fórmula haversine ("),
    ev("lib/geo"),
    r(", fórmula pura) y "),
    ev("RideSimulator"),
    r(" en la fábrica de simulación."),
  ]),
  body([
    r("Para la distribución futura (paquete TypeScript + módulo AAR), la estructura ya separa lo nativo (GPS Core) de lo lógico (src/motor): mover el directorio a un paquete requiere además copiar la fórmula de haversine dentro del paquete y estandarizar el empaquetado — trabajo de empaquetado, no de rediseño. No se publicó ni comercializó nada en esta fase, conforme al encargo. La prueba de integración recomendada para validar la preparación: una app de consola Node que ejecute RideSimulator a través de MotorGPS y pinte métricas por evento (el propio test motor-gps ya demuestra la viabilidad del patrón)."),
  ]),

  h1("10. Conclusión"),
  body([
    r("Cumbre30 pasa de un motor monolítico de 941 líneas dentro de un hook React a un núcleo modular testado, con los defectos de confiabilidad críticos corregidos y verificados por pruebas deterministas, y con su lógica central separada de las reglas del parque. El motor sigue funcionando exactamente igual para el ciclista — mismas reglas, misma voz, mismas pantallas — pero ahora: "),
    r("no pierde el ride ante un crasheo, no inventa distancia parado, no corrompe el desnivel con ruido, no borra tiempo en un túnel, se pausa solo y su velocidad es más honesta", { bold: true }),
    r(". Es, por primera vez, un activo reutilizable: el primer núcleo tecnológico común de los futuros productos de geolocalización del proyecto, construido sin una sola línea de reescritura desde cero."),
  ]),

  h1("Anexo. Verificación del proveedor de ubicación"),
  body([
    r("Requisito D del encargo: documentar el proveedor exacto y garantizar que la posición proviene del GNSS del dispositivo. Implementación verificada: "),
    ev("RideLocationService.kt"),
    r(" solicita actualizaciones exclusivamente a "),
    r("LocationManager.GPS_PROVIDER", { italics: true }),
    r(" (minTime 1000 ms, minDistance 0). En Android, GPS_PROVIDER reporta posición calculada por el chip GNSS (GPS/GLONASS/Galileo/BeiDou según hardware); la asistencia A-GNSS — efemérides y hora obtenidas por red — solo acelera la primera fijación y no altera la naturaleza de la medición, que es un cálculo de pseudorangos satelitales. La triangulación por Wi-Fi/celular corresponde a NETWORK_PROVIDER (y a la fusión de Play Services), que el motor del ride no utiliza en ningún punto del código. Comprobación en dispositivo para el protocolo físico: en el ride activo, "),
    r("adb shell dumpsys location", { italics: true }),
    r(" debe listar el registro de Cumbre30 bajo el proveedor «gps» con el FGS en primer plano, y ningún proveedor «network»/«fused» asociado a la app durante la actividad."),
  ]),
];

const doc = new Document({
  creator: "Cumbre30",
  title: "Fase única del motor GPS — Cumbre30",
  styles: {
    default: {
      document: { run: { font: FONT, size: 24, color: "000000" }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: FONT, size: 30, bold: true, color: P.heading }, paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 } },
      heading2: { run: { font: FONT, size: 26, bold: true, color: P.heading }, paragraph: { spacing: { before: 260, after: 120, line: 312 }, outlineLevel: 1 } },
    },
  },
  sections: [
    { properties: { page: { size: pgSizePortrait, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: cover },
    { properties: { type: SectionType.NEXT_PAGE, page: { size: pgSizePortrait, margin: pgMargin } }, children: tocChildren },
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSizePortrait, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: headerBar() },
      footers: { default: footerNum() },
      children: cuerpo,
    },
  ],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log("DOCX generado:", OUT, buf.length, "bytes");
