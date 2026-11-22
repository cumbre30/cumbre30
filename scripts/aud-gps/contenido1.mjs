// ============================================================
// contenido1.mjs - secciones 1 a 3 del informe:
// resumen ejecutivo, arquitectura GPS actual e inventario.
// ============================================================
import { h1, h2, body, r, ev, bullet, dataTable, tableTitle, figure } from "./helpers.mjs";

export function seccion1() {
  return [
    h1("1. Resumen ejecutivo"),
    body([
      r("Esta auditoría inspeccionó, línea por línea, el motor GPS de Cumbre30: el hook "),
      ev("src/hooks/useRideEngine.ts"),
      r(" (941 líneas), el servicio Android en primer plano "),
      ev("RideLocationService.kt"),
      r(", el puente Capacitor "),
      ev("RideNativePlugin.kt"),
      r(", y los módulos algorítmicos y de persistencia asociados ("),
      ev("geo.ts, rideMetrics.ts, history.ts, gpx.ts, fallDetect.ts, vehicleDetect.ts, rideBateria.ts, sync.ts, cloudSync.ts"),
      r("), además del cableado con mapas y navegación. Ninguna funcionalidad se dio por correcta por existir: cada conclusión cita archivo, clase, método y líneas."),
    ]),
    body([
      r("El motor real de Cumbre30 es una arquitectura híbrida bien concebida: captura nativa a 1 Hz vía un servicio en primer plano (FGS tipo LOCATION, sin dependencia de Play Services), procesamiento y métricas enteramente en el WebView con un pipeline único y determinista ("),
      ev("processFix"),
      r("), y persistencia local con sincronización diferida (outbox en IndexedDB). La velocidad es la fortaleza técnica: velocidad Doppler del GPS filtrada con un filtro de Kalman con compuertas de outliers, algo poco común en apps de ciclismo."),
    ]),
    body([
      r("Sin embargo, frente al estándar de un ciclocomputador profesional la auditoría identifica "),
      r("una brecha crítica de confiabilidad y tres brechas mayores de precisión", { bold: true }),
      r(". Primero: el ride se persiste únicamente al detenerlo ("),
      ev("useRideEngine.ts · stop, L855"),
      r("); un crasheo del WebView o del proceso Android pierde la actividad completa — un ciclocomputador nunca pierde la sesión. Segundo: la acumulación de distancia no tiene banda muerta en reposo, de modo que la deriva GPS con el ciclista detenido suma metros yuxtapuestos y contradice el criterio de «tiempo en movimiento». Tercero: la cadena de altitud acepta fixes sin altitud como 0 m ("),
      ev("RideNativePlugin.kt L71; useRideEngine.ts L584"),
      r(") y acumula desnivel sin histéresis vertical sobre el ruido GNSS. Cuarto: no existe pausa automática, reanudación automática ni recuperación de sesión tras un cierre inesperado."),
    ]),
    body([
      r("La puntuación de madurez global, ponderada por área y respaldada en la sección 12, es "),
      r("54/100", { bold: true }),
      r(": un prototipo sólido y honesto (los algoritmos están documentados y los umbrales son verificables), pero aún en nivel «aplicación de guía de parque», no en nivel de ciclocomputador confiable. El plan recomendado (sección 11) ordena 12 mejoras: 4 de prioridad P0 (checkpoint de sesión, banda muerta de distancia, cadena de altitud robusta y tiempo por reloj), 4 P1 (pausa automática, sensores BLE completos al motor, export FIT, tests unitarios del núcleo) y 4 P2/P3 de precisión y diferenciación. La sección 13 evalúa además la reutilización tecnológica: aproximadamente un 60-65 % del motor es directamente reutilizable si se extraen las reglas del parque San Cristóbal del pipeline, lo que convierte la inversión en un activo modular viable sin reconstrucción."),
    ]),
    body([
      r("La auditoría no modificó código, no implementó mejoras y distingue en todo momento entre problemas "),
      r("confirmados por inspección", { bold: true }),
      r(", "),
      r("detectados por pruebas automatizadas", { bold: true }),
      r(" (cobertura nula del núcleo matemático del motor — ver sección 8.2), "),
      r("riesgos potenciales", { bold: true }),
      r(" y "),
      r("aspectos que requieren prueba física en terreno", { bold: true }),
      r(" (batería, TTFF, comportamiento boscoso, ganancia contra desniveles reales)."),
    ]),
  ];
}

export function seccion2() {
  return [
    h1("2. Arquitectura GPS actual"),
    body([
      r("La arquitectura vigente tiene tres capas claras. La capa de captura es doble: en el APK nativo, "),
      ev("RideLocationService.kt"),
      r(" es un Foreground Service de Android (tipo "),
      r("location", { italics: true }),
      r(", obligatorio desde API 34) que escucha "),
      ev("LocationManager.GPS_PROVIDER"),
      r(" a 1 Hz con el feed directo del hardware, sin Play Services ni FusedLocationProvider; cada fix cruza el puente del plugin "),
      ev("RideNativePlugin.kt"),
      r(" como evento "),
      r("gpsfix", { italics: true }),
      r(" hacia el WebView. En web (y como respaldo si el plugin falla), "),
      ev("navigator.geolocation.watchPosition"),
      r(" con alta precisión alimenta el mismo pipeline. Una tercera fuente, el simulador "),
      ev("RideSimulator"),
      r(" ("),
      ev("simulation.ts"),
      r("), reproduce un recorrido del parque para demostración y pruebas sin GPS."),
    ]),
    body([
      r("La capa de procesamiento vive íntegra en "),
      ev("useRideEngine.ts · processFix"),
      r(" (L166-547): una función única que recibe cada fix y aplica, en orden, filtro de velocidad (Kalman + predicción de 400 ms), acumulación de distancia con compuertas, cadena de altitud (EMA) y pendiente, tiempos, huella de vehículo motorizado, geocerca del parque con histéresis de 18 metros, avisos de accesos, zonas de riesgo, reglas direccionales del cliente, bajadas fiscalizadas, horarios, detección de caída, máquina de estados de velocidad (30 km/h) y publicación del estado a la interfaz. El muestreo del track para GPX (1 punto cada 5 s, máximo 600 puntos con decimación progresiva) ocurre dentro del mismo pipeline."),
    ]),
    body([
      r("La capa de persistencia separa resúmenes y pistas: el resumen del ride va a "),
      r("localStorage", { italics: true }),
      r(" ("),
      ev("history.ts · saveRide, L204-215"),
      r(") y la pista completa a IndexedDB ("),
      ev("idb.ts · putTrack"),
      r("), con migración automática de pistas antiguas fuera del historial reciente ("),
      ev("history.ts · migrateTracksToIdb, L305-325"),
      r("). Al cerrar, "),
      ev("sync.ts"),
      r(" sube un resumen SIN pista al servidor (privacidad: el track crudo nunca sale del teléfono, "),
      ev("sync.ts · rideToPayload, L23-39"),
      r("), o lo encola en un outbox persistente si no hay red ("),
      ev("cloudSync.ts"),
      r(", con reintento y límite de intentos). Las métricas del Perfil Ciclista (VAM, paradas, watts estimados en subida, P95 en llano) se calculan en el dispositivo al cerrar ("),
      ev("rideMetrics.ts · computeRideMetrics"),
      r(")."),
    ]),
    body([
      r("En Android nativo, además del GPS, el plugin expone hápticos por waveform ("),
      ev("VibratorManager"),
      r("), control de sesiones de música de otras apps vía "),
      ev("MediaSessionManager"),
      r(" (requiere acceso a notificaciones) y login con Google; el keep-awake de pantalla usa "),
      ev("@capacitor-community/keep-awake"),
      r(". El modo ahorro de batería ("),
      ev("rideBateria.ts"),
      r(") procesa 1 de cada 2 fixes, suspende el wake lock y se activa automáticamente con la Battery API bajo el 20 %. El motor de navegación ("),
      ev("useNavEngine.ts"),
      r(") es un hook independiente que consume la posición del ride por parámetro y recalcula rutas (grafo local del parque u OSRM público) con reanclaje y detección de desvío a 140 m."),
    ]),
    body([
      r("La separación motor-mapa es correcta: "),
      ev("MapView.tsx"),
      r(" es un consumidor pasivo de propiedades ("),
      r("position, track, accuracyM, heading", { italics: true }),
      r(") y por decisión explícita del cliente no persigue la posición del usuario sin pedirlo. La debilidad arquitectónica principal no está en la separación de capas sino en la monolítica "),
      ev("processFix"),
      r(": mezcla matemática genérica, reglas del parque San Cristóbal y publicación a React en una sola función dentro de un hook, lo que impide testear el núcleo fuera de la app (desarrollo en sección 13)."),
    ]),
  ];
}

export function seccion3() {
  return [
    h1("3. Inventario de funcionalidades existentes"),
    body([
      r("El inventario siguiente fue verificado contra el código, no contra la pantalla. Para cada capacidad se indica dónde vive y qué garantiza realmente."),
    ]),
    tableTitle("Tabla 1. Inventario verificado de capacidades del motor"),
    dataTable(
      ["Capacidad", "Dónde vive", "Qué garantiza el código"],
      [
        ["Captura nativa 1 Hz con FGS", "RideLocationService.kt; RideNativePlugin.kt · gpsfix", "Fixes continuos con pantalla bloqueada o app en segundo plano; velocidad Doppler, precisión y rumbo por fix."],
        ["Captura web y de respaldo", "useRideEngine.ts · startWebGps (L550-602)", "watchPosition de alta precisión con fallback automático si el plugin nativo falla (L604-641)."],
        ["Fuente de demostración", "simulation.ts · RideSimulator; TICK_MS 500", "Recorrido sintético del parque para probar alertas sin GPS; excluida de todas las estadísticas (history.ts · gpsOnly)."],
        ["Filtro de velocidad", "geo.ts · SpeedKalman; useRideEngine §1", "Kalman escalar con compuerta de outliers en dos niveles; velocidad Doppler con respaldo por delta de posición."],
        ["Distancia con compuertas", "useRideEngine §2", "Acumula solo desplazamientos <100 m con precisión <60 m."],
        ["Geocerca con histéresis", "useRideEngine §5; geo.ts · distToPolygonM", "Estado dentro/fuera estable (18 m de profundidad) frente al ruido en la frontera; km dentro del parque."],
        ["Alertas de voz y hápticos", "alertEngine.ts; RideNativePlugin · vibrate", "Voz (TTS), tonos y vibración nativa por waveform, con wake lock y re-adquisición al volver."],
        ["Reglas del parque", "park.ts, reglasParque.ts, bajadas30.ts, horario.ts", "Zonas de riesgo, accesos, corredores direccionales, bajadas 30 km/h y horarios con avisos de voz."],
        ["Fiscalización 30 km/h", "useRideEngine §8 (máquina de estados)", "Estados ok/caution/over con histéresis 0.6 km/h, tiempo sobre el límite y hápticos progresivos (25/28/30)."],
        ["Detección de caída", "fallDetect.ts · FallDetector", "Golpe (frenado ≥9 km/h en ≤4 s) + inmovilidad 18 s, con anti-falsos (cerca de accesos, cooldown 3 min); solo dentro del parque."],
        ["Detección de vehículo", "vehicleDetect.ts · isMotorizedRide", "Heurística por velocidad sostenida (45 km/h, 45 s continuos, 90 s totales, promedio 32 km/h ×10 min) con confirmación del usuario."],
        ["Registro de ride", "history.ts · saveRide; idb.ts · tracks", "Resumen en localStorage + pista en IndexedDB; cap freemium de 20 rides locales (Pro ilimitado)."],
        ["Métricas derivadas", "rideMetrics.ts · computeRideMetrics", "VAM, grupos de subida ≥3 m, paradas, P95 en llano, watts estimados (modelo gravedad+rodadura+aéro) en subidas >4 %, anti-trampa >55 km/h."],
        ["Export GPX (Pro)", "gpx.ts · buildRideGpxBlob", "GPX 1.1 con ele/time de la pista muestreada; import GPX para el creador de rutas."],
        ["Sincronización y outbox", "sync.ts; cloudSync.ts; idb.ts · outbox", "Resumen sin pista al servidor; sin red, outbox persistente con reintentos (máx. 8 intentos, descarte ordenado)."],
        ["Perfil Ciclista", "profileServer; cloudSync (perfil)", "Arquetipos y ejes desde métricas del dispositivo; rides demo y motorizados excluidos."],
        ["Ahorro de batería", "rideBateria.ts", "0.5 Hz efectivo, pantalla apagable, activación automática por Battery API."],
        ["Navegación", "useNavEngine.ts; routingService.ts", "Rutas por grafo local u OSRM público; recálculo por desvío (>140 m) y cada 30 s en marcha; reanclaje del origen."],
        ["Sensores BLE (parcial)", "sensors.ts; SensorPanel.tsx; RideView.tsx", "Pulso cardíaco BLE conecta y alimenta zonas FC con voz (Z4/Z5); velocidad de rueda conecta pero su dato no entra al motor."],
      ],
      [22, 30, 48],
      { size: 19 }
    ),
    body([
      r("Lo que deliberadamente NO existe en el motor hoy: pausa/reanudación e inicio automáticos, checkpoints de sesión, vueltas (laps), entrenamientos o intervalos, fusión de velocidad de rueda en el motor, ingestión de cadencia o potencia, grabación de pulso en el track, export FIT, barómetro, perfil altimétrico en vivo, calorías y visualización de calidad de señal. Estas ausencias se analizan en las secciones 7 y 9."),
    ], { after: 160 }),
  ];
}
