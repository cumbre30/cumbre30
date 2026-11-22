// ============================================================
// contenido3.mjs - secciones 9 (faltantes), 10 (riesgos y
// prioridades), 11 (plan), 12 (madurez), 13 (reutilización y
// activo tecnológico) y anexo metodológico.
// ============================================================
import { h1, h2, body, r, ev, bullet, dataTable, tableTitle, figure } from "./helpers.mjs";

const CHARTS = "/home/z/my-project/scripts/aud-gps";

export function seccion9() {
  return [
    h1("9. Funcionalidades faltantes"),
    body([
      r("El listado ordena lo ausente por su peso en la experiencia de un ciclocomputador profesional. Ninguna de estas funciones requiere reconstruir el motor: todas se apoyan en el pipeline actual o en el plan de modularización de la sección 13."),
    ]),
    tableTitle("Tabla 5. Funcionalidades ausentes y su vía de implementación"),
    dataTable(
      ["Funcionalidad", "Por qué importa", "Vía técnica sobre el código actual", "Prioridad"],
      [
        ["Checkpoint y recuperación de sesión", "Un ciclocomputador no pierde la actividad; hoy un crasheo sí la pierde", "Persistir el estado del motor (métricas + trackPts) cada 10-30 s a IndexedDB y al pausar; diálogo «¿retomar ride?» al abrir; buffer opcional en el FGS nativo", "P0"],
        ["Banda muerta de distancia y coherencia v-d-t", "Métricas honestas en reposo y semáforos", "Gate por fix: descartar d < f(accuracy) cuando v < umbral; invariante d ≈ v̄·dt con tolerancias", "P0"],
        ["Cadena de altitud robusta", "Desnivel creíble en un parque de montaña", "hasAltitude + verticalAccuracy; retener último válido; histéresis ±2-3 m; barómetro si existe (SensorManager PRESSURE); altMin/altMax y loss acumulado", "P0"],
        ["Tiempo por reloj con pausas explícitas", "Coherencia distancia-tiempo-velocidad", "elapsed desde t0 real menos pausas; señal degradada no resta tiempo", "P0"],
        ["Pausa/reanudación/inicio automáticos", "Comodín estándar de la categoría", "Máquina de estados parado/moviendo (histéresis + tiempos configurables) sobre el Kalman existente", "P1"],
        ["Ecosistema de sensores completo", "Pulso/cadencia/potencia/velocidad en la medición, no solo en pantalla", "Reusar sensors.ts BLE; fusión de velocidad de rueda; grabar HR en TrackPt/extensiones; alimentar zonas en vivo", "P1"],
        ["Export FIT + GPX completo", "Interoperabilidad (Strava, Garmin Connect)", "Librería FIT o codificador propio; GPX con extensiones; quitar la poda destructiva del track (páginas en IndexedDB)", "P1"],
        ["Tests del núcleo con el simulador", "Confiabilidad de cambios futuros", "Fixtures de fixes deterministas (RideSimulator) validando distancia/gain/velocidad/caída/vehículo", "P1"],
        ["Vueltas automáticas por distancia/tiempo/ubicación", "Análisis por tramos; fácil sobre el track", "Segmentación del track al cerrar o en vivo", "P2"],
        ["Navegación eficiente: reroute por evento, instrucciones por voz", "Batería y utilidad real en ruta", "Eliminar el intervalo ciego de 30 s; TTS de giros con la red existente; caché de ruta", "P2"],
        ["Perfil altimétrico en vivo y ascensiones reconocidas", "Experiencia de montaña", "Buffer de altitud suavizada + detección de grupos de subida (ya existe en rideMetrics, moverlo a tiempo real)", "P2"],
        ["Perfiles de actividad configurables", "MTB/ruta/city con umbrales propios; base del producto reutilizable", "Objeto de configuración (frecuencia, gates, pausas, reglas) inyectado al motor — sección 13", "P2"],
        ["Calorías y carga de entrenamiento", "Métrica habitual del ciclista", "Estimación honesta con el modelo de watts existente (solo subida) + met por velocidad; documentar limitaciones", "P3"],
        ["Segmentos en vivo del parque", "Diferenciador alineado con la guía existente", "Los segmentos ya existen en Estadísticas Pro; faltaría cronometraje en ride con voz", "P3"],
        ["Tracking en vivo opt-in (SOS ampliado)", "Seguridad; ya hay caída + ICE", "Publicar posición truncada solo con consentimiento; compatible con privacidad actual", "P3"],
      ],
      [22, 22, 44, 12],
      { size: 19 }
    ),
  ];
}

export function seccion10() {
  return [
    h1("10. Matriz de riesgos y prioridades"),
    body([
      r("Cada riesgo se califica por impacto (qué pierde el ciclista o el producto) y probabilidad (qué tan probable es que ocurra en uso normal), con su mitigación recomendada. Los riesgos R7-R9 son derivados de la sección de reutilización."),
    ]),
    tableTitle("Tabla 6. Riesgos ordenados por severidad"),
    dataTable(
      ["ID", "Riesgo", "Impacto", "Prob.", "Mitigación recomendada", "Prio."],
      [
        ["R1", "Muerte del proceso/WebView durante un ride → pérdida total de la actividad", "Alto: dato irreemplazable para el usuario", "Media (OEM agresivos, OOM, updates)", "Checkpoint 10-30 s + recuperación al abrir (P0-1)", "Crítica"],
        ["R2", "Distancia/tiempo inconsistentes (deriva en reposo, huecos de señal)", "Alto: métricas del producto dejan de ser creíbles", "Alta (ocurre en cada ride con paradas)", "Banda muerta + tiempo por reloj (P0-2, P0-4)", "Crítica"],
        ["R3", "Gain falso por ruido vertical o altitud 0", "Alto en un producto de montaña", "Alta en dispositivos sin buen GNSS vertical", "Cadena vertical robusta (P0-3)", "Crítica"],
        ["R4", "Regresión silenciosa del núcleo al evolucionar (0 % cobertura)", "Medio-alto: sin red de seguridad", "Media (cada refactor)", "Tests con el simulador (P1-4)", "Alta"],
        ["R5", "Muerte del proceso y no-retorno en navegación con OSRM público", "Medio: desvío falla en terreno", "Media", "Instancia propia o degradación al grafo local (ya existe)", "Alta"],
        ["R6", "Consumo de batería percibido alto (GPS ambiental + pantalla)", "Medio: abandono del uso continuo", "Media", "Medición + timeout del GPS ambiental + ahorro por defecto en rides largos", "Media"],
        ["R7", "Acoplamiento al parque impide reutilizar el motor en otros productos", "Medio (estratégico)", "Alta si no se modulariza", "Extracción por capas (sección 13)", "Media"],
        ["R8", "Dependencias con licencias o términos que impidan distribución comercial", "Alto si se ignora (bajo si se revisa)", "Baja (dependencias actuales MIT/BSD)", "Revisión legal al empaquetar SDK; ODbL por tiles/datos OSM", "Media"],
        ["R9", "Expectativa de precisión profesional sin pruebas físicas publicadas", "Medio: credibilidad", "Media", "Campaña de mediciones documentadas (sección 6.4 del plan)", "Media"],
      ],
      [7, 28, 17, 13, 25, 10],
      { size: 19 }
    ),
  ];
}

export function seccion11() {
  return [
    h1("11. Plan recomendado de optimización"),
    body([
      r("El plan ordena 12 mejoras (P0: 4, P1: 4, P2: 2, P3: 2) con su problema, solución, archivos, complejidad y criterio de terminación. Ninguna reconstruye el motor; todas respetan las restricciones del encargo (no cambiar tecnologías, no alterar interfaces). El orden dentro de cada prioridad es el de ejecución sugerida."),
    ]),
    tableTitle("Tabla 7. Mejoras P0 — confiabilidad de la medición"),
    dataTable(
      ["Mejora", "Problema / Situación actual", "Solución recomendada", "Archivos", "Complejidad", "Criterio de terminación"],
      [
        ["P0-1 Checkpoint y recuperación de sesión", "Ride solo en RAM; saveRide único al detener (useRideEngine.stop L855)", "Persistir snapshot del motor (métricas + trackPts + estado) cada 10-30 s y al pausar, en IndexedDB; al abrir con sesión viva, ofrecer «¿retomar ride?»; opcional: buffer del FGS nativo que re-entregue los últimos fixes", "useRideEngine.ts; idb.ts; history.ts; (opcional) RideLocationService.kt", "Media-alta", "Se mata la app a mitad de un ride simulado y el ride se recupera con métricas continuas; test automatizado de checkpoint/restauración"],
        ["P0-2 Banda muerta de distancia", "La deriva en reposo suma distancia (processFix §2 L203-211)", "Gate por fix: descartar d < max(2 m, 0.5·accuracy) si vKmh < umbral de movimiento; aplicar el mismo criterio a inParkKm; documentar la fórmula", "useRideEngine.ts", "Baja", "Test con simulación de deriva en reposo: distancia acumulada ≈ 0 tras 10 min detenido; promedio estable"],
        ["P0-3 Cadena de altitud robusta", "alt=0 si el fix no trae altitud (plugin L71, L584); gain sin histéresis vertical", "Rechazar fixes sin hasAltitude reteniendo el último válido; leer verticalAccuracy y ponderar; histéresis ±2-3 m en el gain; altMin/altMax/loss; barómetro opcional si el sensor existe", "RideNativePlugin.kt; useRideEngine.ts; rideMetrics.ts", "Media", "Fix sin altitud no altera gain; test de ruido vertical sintético (±15 m) produce gain ≈ 0; gain positivo en subida real ≥ 70 % del valor de referencia medido"],
        ["P0-4 Tiempo por reloj", "elapsed por fixes acotados (L172, L228)", "elapsed desde t0 menos pausas explícitas (reloj de pared); señal perdida no resta tiempo; mantener movingSec como está", "useRideEngine.ts", "Baja", "Hueco de señal simulado de 5 min: tiempo total incluye el hueco, distancia no; coherencia d-t-v verificada por test"],
      ],
      [16, 22, 28, 14, 8, 12],
      { size: 17, headerSize: 17 }
    ),
    tableTitle("Tabla 8. Mejoras P1 — esenciales de ciclocomputador"),
    dataTable(
      ["Mejora", "Problema / Situación actual", "Solución recomendada", "Archivos", "Complejidad", "Criterio de terminación"],
      [
        ["P1-1 Pausa automática configurable", "No existe; pausa solo manual (L762-787)", "Máquina de estados parado/moviendo (v < 2-3 km/h por X s → auto-pausa; v > umbral → reanudar), con configuración por perfil; reutilizable para auto-start", "useRideEngine.ts; rideBateria o nueva rideConfig.ts", "Media", "En ride real con 3 detenciones >30 s, la pausa se activa/reanuda sin tocar pantalla; configurable en Ajustes"],
        ["P1-2 Sensores BLE al motor y en el track", "HR solo en UI; velocidad de rueda no conectada al motor; sin cadencia/potencia", "Inyectar datos de sensor al pipeline como fuentes opcionales; fusionar velocidad de rueda (preferida sobre GPS a baja velocidad); grabar HR en el track (quinta componente opcional o registro paralelo); zones en vivo", "sensors.ts; SensorPanel/RideView; useRideEngine.ts; history.ts (TrackPt v2)", "Alta", "Ride con sensor: HR visible en GPX/FIT y en métricas; velocidad de rueda priorizada bajo techo"],
        ["P1-3 Export FIT (+ GPX completo)", "Solo GPX Pro de pista decimada", "Codificador FIT (activity + record + session) con HR/alt; track sin poda destructiva (páginas IndexedDB); GPX con extensiones", "gpx.ts (nuevo fit.ts); history.ts; idb.ts", "Media", "FIT del ride abre en Strava/Garmin Connect con HR y altitud; pista de 3 h conserva detalle ≤5 s"],
        ["P1-4 Tests del núcleo", "0 % de cobertura del motor", "Suite de fixtures deterministas con RideSimulator: distancia, gain, Kalman (ruido/saltos), caída, vehículo, checkpoint; CI como las demás suites", "tests/motor-gps.test.ts (nuevo); simulation.ts", "Media", "Suite verde en CI con ≥25 comprobaciones del pipeline; se rompe si alguien cambia un umbral sin actualizar"],
      ],
      [16, 22, 28, 14, 8, 12],
      { size: 17, headerSize: 17 }
    ),
    tableTitle("Tabla 9. Mejoras P2/P3 — precisión, eficiencia y diferenciación"),
    dataTable(
      ["Mejora", "Problema / Situación actual", "Solución recomendada", "Archivos", "Complejidad", "Criterio de terminación"],
      [
        ["P2-1 Kalman adaptativo + v-d-t", "Q/R fijos; sin cross-check velocidad-desplazamiento", "R ∝ accuracy²; validación v-d-t por fix con descarte del outlier de menor calidad; quitar extrapolación al frenar", "geo.ts; useRideEngine.ts", "Media", "Suite de ruido sintético muestra menor error cuadrático medio que el filtro actual"],
        ["P2-2 Navegación por evento + voz de giros", "Reroute ciego cada 30 s (useNavEngine L344-351); sin TTS de instrucciones", "Reroute solo en desvío (>140 m) o al terminar tramo; caché de ruta; TTS de giros con alertEngine; OSRM propio o fallback grafo", "useNavEngine.ts; routingService.ts; alertEngine.ts", "Media", "Un ride de 1 h con destino genera ≤5 llamadas de recalculo; giros anunciados por voz"],
        ["P3-1 Vueltas y perfil altimétrico en vivo", "No existen laps ni perfil en vivo", "Laps automáticos por distancia/tiempo/presión; buffer de altitud para perfil y ascensiones en vivo (migrar lógica de grupos de rideMetrics)", "useRideEngine.ts; rideMetrics.ts; RideView.tsx", "Media", "Vuelta visible en ride y en resumen; perfil dibujado en vivo en el minimapa"],
        ["P3-2 Perfiles de actividad y segmentos en vivo", "Un solo conjunto de umbrales; segmentos solo en Estadísticas Pro", "Activity Profiles (sección 13): config inyectada (frecuencia, gates, pausas, reglas); cronometraje de segmentos del parque con voz", "rideConfig.ts (nuevo); useRideEngine.ts; segmentos existentes", "Alta", "Perfil MTB con auto-pausa más laxa y fiscalización opcional; segmento cronometrado en ride con anuncio de PR"],
      ],
      [16, 22, 28, 14, 8, 12],
      { size: 17, headerSize: 17 }
    ),
    body([
      r("Secuencia sugerida: P0-1 → P0-2 → P0-4 (un mismo sprint, tocan processFix); P0-3 (nativo+JS); P1-4 en paralelo desde el inicio (protege todo lo demás); P1-1; P1-3; P1-2; P2 y P3 según producto. El resultado de la fase P0 ya coloca a Cumbre30 por encima de la media de las apps de ciclismo en confiabilidad; P1 lo pone en el estándar de la categoría."),
    ]),
  ];
}

export function seccion12() {
  return [
    h1("12. Conclusión sobre el nivel de madurez del motor GPS"),
    body([
      r("La puntuación por área se asigna con evidencia de código (no con mediciones de campo), en la escala 0-100 donde 60 representa «estándar de la categoría». Las ponderaciones reflejan el peso de cada área en un ciclocomputador confiable. La cifra global es un juicio técnico trazable: cada puntaje se descompone en la matriz de la sección 4."),
    ]),
    tableTitle("Tabla 10. Madurez por área y puntaje ponderado"),
    dataTable(
      ["Área", "Madurez", "Peso", "Justificación resumida (evidencia en §4 y §8)"],
      [
        ["A. Captura GPS", "62", "15 %", "FGS 1 Hz sólido y portable; le faltan calidad de señal, recovery de señal y gates adaptativos (A: 3 I, 4 P, 1 X)."],
        ["B. Velocidad", "72", "12 %", "La mejor cadena del motor: Doppler+Kalman+outliers; sin v-d-t ni adaptabilidad (B: 6 I, 2 P)."],
        ["C. Distancia", "58", "15 %", "Correcta en movimiento; banda muerta ausente y sin coherencia v-d-t (C: 3 I, 3 P)."],
        ["D. Altitud y desnivel", "40", "12 %", "El eslabón más débil: alt 0 sin verificación, sin histéresis vertical, sin barómetro, sin loss/altMax (D: 2 I, 4 P, 1 X)."],
        ["E. Inteligencia", "30", "15 %", "Sin pausa/inicio automáticos ni estados de detención en vivo; detección de paradas solo post-ride (E: 2 I, 1 P, 4 X)."],
        ["F. Registro", "48", "15 %", "Persistencia al cierre con outbox correcto, pero sin checkpoint (pérdida total ante crasheo) y track decimado (F: 4 I, 4 P)."],
        ["G. Rendimiento", "65", "8 %", "FGS + ahorro + keep-awake bien resueltos; sin mediciones y con riesgos de Doze/OEM (G: 4 I, 3 P)."],
        ["H. Arquitectura", "68", "8 %", "Separación motor-mapa-nav correcta; pipeline monolítico y estado React acoplado limitan tests y reutilización (H: 5 I, 3 P)."],
      ],
      [22, 10, 8, 60],
      { size: 19 }
    ),
    ...figure(`${CHARTS}/chart_madurez.png`, "Figura 2. Madurez por área (juicio técnico sobre evidencia de código; línea punteada: puntaje ponderado global).", 560),
    body([
      r("Puntaje global ponderado: 62·0.15 + 72·0.12 + 58·0.15 + 40·0.12 + 30·0.15 + 48·0.15 + 65·0.08 + 68·0.08 = "),
      r("54/100", { bold: true }),
      r("."),
    ]),
    body([
      r("Interpretación del nivel: Cumbre30 es hoy un "),
      r("prototipo avanzado con un dominio vertical (el parque) muy superior a su nivel de producto genérico", { bold: true }),
      r(". Cumple el ciclo mínimo de un ciclocomputador — capturar, medir, registrar y exportar — pero falla en la promesa implícita del producto profesional: "),
      r("la actividad nunca se pierde y las métricas son honestas en cualquier condición", { bold: true }),
      r(". Las cuatro mejoras P0 atacan exactamente esa promesa; con ellas, el puntaje estimado sube a ≈ 68-70 sin tocar interfaces; con P1 completa, a ≈ 78-82, que es el umbral donde la comparación con Garmin/Wahoo/Bryton deja de ser desventajosa en software (el techo restante es de hardware: batería, ANT+, multibanda)."),
    ]),
  ];
}

export function seccion13() {
  return [
    h1("13. Diagnóstico de reutilización tecnológica y propuesta de producto independiente"),
    h2("13.A Independencia tecnológica: qué depende de Cumbre30 hoy"),
    body([
      r("La dependencia no está distribuida por igual: el núcleo matemático es genérico, la capa de reglas es del parque y el estado vive en React. Componentes exclusivos de Cumbre30: park.ts (geocercia, accesos, zonas), reglasParque.ts, bajadas30.ts, horario.ts, las claves i18n de voz y los desafíos. Genéricos y reutilizables: geo.ts (haversine, Kalman, EMA, bearing), rideMetrics.ts (modelo de watts, VAM, paradas — ciclismo-genérico, no del parque), fallDetect.ts (heurística de caída configurable), vehicleDetect.ts, rideBateria.ts, rideNative.ts (puente) y RideLocationService.kt (FGS parametrizable casi en su totalidad). Lógica acoplada a la interfaz: la publicación por setState del hook y la lectura de configuración desde localStorage. Lógica acoplada a mapas: ninguna en el motor (MapView consume por props); la navegación sí consume tiles y servicios externos pero es otro módulo. Reglas específicas de ciclismo: vehicleDetect, fiscalización 30 km/h (parametrizable como límite genérico), watts, VAM."),
    ]),
    h2("13.B Arquitectura modular propuesta"),
    body([
      r("La partición de ocho módulos del encargo es viable y coincide con la extracción natural del código; se propone con una variante: fusionar Signal Filtering dentro de Position Processing en una primera etapa (hoy ambos viven juntos en processFix y separarlos antes de tener tests sería Artificial), para luego dividirlos. La estructura recomendada, de menor a mayor costo:"),
    ]),
    bullet([r("GPS Core (nativo): ", { bold: true }), r("RideLocationService.kt + el fragmento de RideNativePlugin.kt de ubicación, ya parametrizable (frecuencia, proveedor, buffer). Conviene en módulo Gradle/AAR propio.")]),
    bullet([r("LocationSource (TS): ", { bold: true }), r("interfaz única con tres implementaciones que ya existen: NativeSource (gpsfix), WebSource (watchPosition), SimSource (RideSimulator). Hoy la selección vive en el hook; formalizarla es barato.")]),
    bullet([r("Position Processing + Signal Filtering (TS): ", { bold: true }), r("gates de precisión, banda muerta, coherencia v-d-t, Kalman/EMA (geo.ts). Entrada: fix tipado; salida: fix validado + calidad.")]),
    bullet([r("Metrics Engine (TS): ", { bold: true }), r("velocidad, distancia, altitud con histéresis, tiempos (rideMetrics.ts ya es la mitad). Entrada: fixes validados; salida: métricas tipadas.")]),
    bullet([r("Activity Engine (TS): ", { bold: true }), r("máquina de estados idle/running/paused con auto-pausa, vueltas y perfiles; hoy dispersa en el hook (start/pause/resume/stop).")]),
    bullet([r("Persistence Layer (TS): ", { bold: true }), r("interfaz de almacenamiento con implementaciones localStorage/IndexedDB (history.ts + idb.ts) y checkpoint; hoy acoplada a localStorage.")]),
    bullet([r("Activity Profiles (TS): ", { bold: true }), r("objeto de configuración (frecuencia, gates, pausas, límite fiscalizado, políticas de energía) inyectado; hoy constantes dispersas (TICK_MS, umbral 1.5, clamp ±3, Q/R fijos).")]),
    bullet([r("Integration API (TS): ", { bold: true }), r("emisor de eventos tipados (fix, tick, alerta, estado) + store de snapshot agnóstico de React (EventTarget o similar); el hook de Cumbre30 pasa a ser un adaptador fino que conecta el motor con React. Los plugins de reglas (parque) se suscriben a la misma API.")]),
    h2("13.C Adaptabilidad a otros proyectos"),
    body([
      r("Universal y directamente reusable en ciclismo, MTB, downhill, running, trekking, senderismo, caminatas y seguimiento geográfico: captura, validación de posición, distancia, velocidad, tiempos, pausa automática, registro/checkpoint, GPX/FIT y el emisor de eventos. Requiere configuración por disciplina: umbrales de movimiento y pausa (running ~5 km/h, caminata ~3 km/h), gates de precisión, frecuencia (downhill se beneficia de 5-10 Hz si el hardware lo permite), límites fiscalizados y criterios de caída. Específico de ciclismo que conviene mantener como módulo opcional: vehicleDetect, watts por gravedad, VAM, pesos del conjunto. El módulo de reglas del parque se convierte en un plugin de geofences y POI con avisos — Cumbre30 sería simplemente el primer consumidor con su configuración del cerro San Cristóbal."),
    ]),
    h2("13.D Configuración y extensibilidad"),
    body([
      r("El motor hoy hard-codea al menos dieciocho constantes de comportamiento en el hook y los módulos (TICK_MS, dt clamp 0.15-10, gates 60/100/18/80 m, umbrales 1.5 km/h, ±3 m/s², 400 ms, α 0.3/0.22, Q/R 0.55/0.35, 600 puntos/5 s, límites 45/90 s/32 km/h, umbral fiscalización). El objetivo de configuración del encargo se cumple definiendo un único objeto "),
      r("MotorConfig", { italics: true }),
      r(" con valores por defecto iguales a los actuales (cero cambio de comportamiento), validación de rangos y resolución por perfil: frecuencia de captura, criterios de precisión, filtrado, cálculo de velocidad/distancia, detección de movimiento, pausa automática, reglas de desnivel, frecuencia de almacenamiento y políticas energéticas. Sin modificar el núcleo: el pipeline lee la config inyectada; los overrides se validan en el borde."),
    ]),
    h2("13.E Reutilización y distribución: alternativas y costos"),
    tableTitle("Tabla 11. Alternativas de empaquetado del motor"),
    dataTable(
      ["Alternativa", "Qué implica", "Ventajas", "Limitaciones / costos"],
      [
        ["Módulo TS interno (monorepo)", "Extraer los módulos 13.B a un paquete del propio repositorio (@cumbre30/gps-core) sin publicar", "Costo mínimo; protege del acoplamiento; habilita tests propios", "No distribuye a terceros; requiere disciplina de fronteras"],
        ["Paquete npm privado", "Publicar @cumbre30/gps-core en un registry privado con semver", "Consumo por cualquier proyecto TS (web/PWA/Node); versionado", "El Core nativo (FGS) no viaja en npm: se necesita el AAR aparte"],
        ["Módulo Gradle/AAR", "GPS Core como biblioteca Android (FGS parametrizable + plugin de eventos)", "Reutilización nativa directa; objetivo Android puro", "Solo Android; dos artefactos (TS+AAR) que evolucionan juntos"],
        ["SDK distribuible a terceros", "npm público/privado + AAR + documentación, semver, CI, ejemplos y soporte", "Producto real; posible comercialización", "Costo alto y permanente: soporte, compatibilidad, seguros de API; exige madurez (tests, telemetría) que hoy no existe"],
        ["Componente multiplataforma futuro", "Kotlin Multiplatform o Rust core con bindings", "Un solo núcleo para Android/iOS/web", "Reescritura del pipeline; no se recomienda en esta fase (viol espíritu «no reconstruir»)"],
      ],
      [18, 27, 25, 30],
      { size: 19 }
    ),
    body([
      r("Recomendación: avanzar por etapas en ese mismo orden. La primera (módulo TS interno) es la que la sección 11 ya requiere para los tests P1-4; la segunda y tercera se habilitan casi sin costo extra si las fronteras se respetan desde el día uno. El SDK público solo tiene sentido después de la fase P1 y de las mediciones físicas."),
    ]),
    h2("13.F Propiedad intelectual, licencias y mantenimiento"),
    body([
      r("Titularidad: el código del motor es propio del proyecto Cumbre30 (autoría interna del repositorio); para comercializar como SDK corresponde confirmar el régimen de propiedad con quien encargó el desarrollo — este informe lo marca como verificación pendiente y no lo presume. Licencias de dependencias del motor: Capacitor y su core son MIT; Leaflet es BSD-2-Clause; react-leaflet MIT; @capacitor-community/keep-awake MIT; no se detectan dependencias copyleft (GPL/AGPL) en la cadena del motor. Restricciones de terceros a considerar al distribuir: los datos/tiles de OpenStreetMap son ODbL con atribución, y los servicios públicos de OSRM/Overpass tienen políticas de uso que no amparan explícitamente un producto comercial — el SDK debe documentar instancia propia o proveedor con SLA. Mantenimiento: versionamiento semver con las interfaces de la sección 13.B como API pública, changelog por release (la práctica de releases de Cumbre30 ya existe), pruebas unitarias del núcleo (P1-4) como puerta de CI y pruebas de integración independientes de Cumbre30 construidas sobre RideSimulator (ya apto para eso: recorridos deterministas sin GPS real). Distribución comercial: viable tras P1 con el esquema npm+AAR; el diferenciador comercial honesto del motor es su cadena de fiscalización y alertas configurables por geofence, no la medición cruda, donde la categoría ya está madura."),
    ]),
    h2("13.G Respuestas al cuestionario del activo tecnológico"),
    tableTitle("Tabla 12. Respuestas directas a las ocho preguntas de reutilización"),
    dataTable(
      ["Pregunta", "Respuesta"],
      [
        ["1. ¿Qué porcentaje del motor es reutilizable?", "≈ 60-65 % reutilizable casi sin cambios (geo.ts, rideMetrics.ts, fallDetect.ts, vehicleDetect.ts, rideBateria.ts, rideNative.ts, RideLocationService.kt, simulation.ts); ≈ 10-15 % reutilizable tras parametrizar (gates, umbrales, pausas: hoy constantes del hook); ≈ 20-25 % específico de Cumbre30 (reglas del parque, claves de voz, acoplamiento a React y a desafíos). Estimación por inspección de líneas, no métrica de herramienta."],
        ["2. ¿Qué componentes deben desacoplarse?", "Las reglas del parque fuera del pipeline (a plugins por evento); la publicación de estado fuera de React (Integration API); la persistencia detrás de una interfaz; las dieciocho constantes de comportamiento hacia MotorConfig; el FGS hacia un módulo Gradle parametrizable."],
        ["3. ¿Qué debe permanecer en Cumbre30?", "park.ts, reglasParque.ts, bajadas30.ts, horario.ts, la fiscalización como regla configurada, los desafíos y el hook adaptador de React. El parque es el diferenciador de producto, no del motor."],
        ["4. ¿Qué arquitectura lo permitiría?", "La de 13.B: GPS Core (AAR) + LocationSource + Position Processing + Metrics Engine + Activity Engine + Persistence Layer + Activity Profiles + Integration API, con eventos tipados y store agnóstico de UI. No se impone: es la extracción natural del código actual, verificada contra él."],
        ["5. ¿Qué cambios son necesarios para biblioteca independiente?", "Extraer módulos con contratos tipados; inyectar config y persistencia; mover la selección de fuente a LocationSource; desacoplar voz/i18n a un canal de eventos; tests del núcleo sin React (con RideSimulator). Sin reescritura: es refactorización por capas alineada con las mejoras P0-P1."],
        ["6. ¿Cómo se integraría en futuros proyectos?", "Consumo por paquete (TS) + AAR (Android): el cliente crea MotorConfig, elige LocationSource, suscribe eventos y persistencia; la UI del proyecto se suscribe al store. En Cumbre30 el hook actual se convierte en el primer integrador, garantizando que el motor siga sirviendo a la app sin regresiones."],
        ["7. ¿Riesgos técnicos y legales?", "Técnicos: sin tests ni telemetría el SDK se vuelve costoso de sostener; la muerte del proceso (P0-1) y las mediciones físicas pendientes comprometen la promesa del producto. Legales: confirmar titularidad del código; ODbL/atribución por datos OSM; políticas de uso de OSRM/Overpass (usar instancias propias); dependencias actuales MIT/BSD sin restricción detectada."],
        ["8. ¿Camino más económico?", "Fase 0: extraer módulos TS al monorepo con tests (ya exigido por P1-4) — costo marginal sobre el plan. Fase 1: npm privado + AAR parametrizado cuando P0/P1 estén en producción. Fase 2: SDK público solo tras mediciones físicas y documentación. Nunca reescribir en multiplataforma antes de tener el núcleo testado."],
      ],
      [22, 78],
      { size: 19 }
    ),
    body([
      r("Síntesis estratégica: el motor de Cumbre30 ya es, en su núcleo, un motor de actividad geolocalizada parametrizable de facto; lo que le falta para ser un activo es frontera, no reescritura. Ejecutar las mejoras P0-P1 con las fronteras de la sección 13.B deja a Cumbre30 con un motor más confiable y, simultáneamente, con el primer paquete reutilizable del producto — el mismo trabajo sirve dos veces."),
    ]),
  ];
}

export function anexo() {
  return [
    h1("Anexo. Metodología, alcance y limitaciones"),
    body([
      r("Metodología: inspección estática completa de los archivos del motor y sus módulos de apoyo (listados íntegros de useRideEngine.ts, RideLocationService.kt, RideNativePlugin.kt, rideNative.ts, geo.ts, rideBateria.ts, rideMetrics.ts, history.ts, gpx.ts, fallDetect.ts, vehicleDetect.ts, sync.ts y MainActivity.java; lectura dirigida de useNavEngine.ts, MapView.tsx, RideView.tsx, sensors.ts, idb.ts, cloudSync.ts, routingService.ts, simulation.ts, AndroidManifest.xml, variables.gradle y package.json), verificación cruzada con las 14 suites de pruebas del repositorio y grep dirigido para confirmar ausencias (saveRide único, sin auto-pausa, sin calorías, sin tests del núcleo). Fecha de la inspección: 2026-11-22, sobre el estado del repositorio en la versión v1.22.0 (code 83)."),
    ]),
    body([
      r("Limitaciones declaradas: (1) es una auditoría estática — no se midieron batería, TTFF, CPU, RAM ni latencia, y las cifras de ese tipo ausentes en el informe no se inventaron; (2) no se ejecutaron rides físicos, por lo que el comportamiento en terreno (bosque, cañón, Doze, OEM) queda marcado como pendiente; (3) la puntuación de madurez es un juicio técnico argumentado sobre evidencia de código, reproducible por cualquier revisor siguiendo las citas; (4) la estimación de reutilización (sección 13.G) es cualitativa, por lectura de líneas y acoplamiento, no un resultado de herramienta de análisis estático. Cumplimiento de restricciones del encargo: no se modificó código, no se eliminó funcionalidad, no se reconstruyó el motor, no se cambiaron tecnologías, no se alteraron interfaces ni bases de datos, y no se implementó ninguna mejora — el informe prescribe, no ejecuta."),
    ]),
  ];
}
