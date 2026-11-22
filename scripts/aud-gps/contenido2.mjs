// ============================================================
// contenido2.mjs - sección 4 (matriz, en orientación horizontal),
// 5 (precisión), 6 (rendimiento), 7 (comparación profesional),
// 8 (debilidades por tipo de evidencia).
// ============================================================
import { h1, h2, body, r, ev, bullet, dataTable, tableTitle, figure } from "./helpers.mjs";
import { MATRIZ, ESTADO_LABEL } from "./datos-matriz.mjs";

const CHARTS = "/home/z/my-project/scripts/aud-gps";

export function seccion4Intro() {
  return [
    h1("4. Matriz: qué tenemos y qué deberíamos tener"),
    body([
      r("La matriz compara cada funcionalidad evaluada con el estándar esperado de un ciclocomputador profesional basado en el GNSS del teléfono. Cada fila distingue tres estados: "),
      r("Implementada", { bold: true }),
      r(" (el código garantiza el comportamiento), "),
      r("Parcial", { bold: true }),
      r(" (existe pero con deficiencias concretas) e "),
      r("Inexistente", { bold: true }),
      r(". La columna Evidencia cita archivo, símbolo y líneas verificados el 2026-11-22. Por el volumen de columnas, la matriz se presenta en orientación horizontal al final de este capítulo (tablas 2.A a 2.H)."),
    ]),
    ...figure(`${CHARTS}/chart_estado.png`, "Figura 1. Cobertura por área: funcionalidades implementadas, parciales e inexistentes (conteo de la Tabla 2).", 560),
    body([
      r("La lectura agregada confirma el diagnóstico del resumen ejecutivo: las áreas de velocidad (B) y arquitectura (H) están cerca del estándar; captura (A), distancia (C) y registro (F) funcionan pero con deficiencias de confiabilidad (sin checkpoint, sin banda muerta, sin detección de señal obsoleta); y las áreas de altitud (D) e inteligencia del ciclocomputador (E) son las más rezagadas: sin barómetro ni histéresis vertical en la primera, sin pausa automática ni perfiles configurables en la segunda."),
    ]),
  ];
}

export function seccion4Landscape() {
  const out = [
    h1("4. Matriz funcional (continuación) — tablas por área"),
    body([
      r("Columnas: Funcionalidad · Estado actual (I/P/X) · Implementación técnica · Evidencia · Debilidad · Estándar esperado · Brecha · Prioridad. El texto de las celdas es telegráfico a propósito; el desarrollo de cada debilidad está en la sección 8."),
    ], { after: 160 }),
  ];
  const widths = [12, 6, 19, 16, 17, 15, 9, 6];
  const headers = ["Funcionalidad", "Estado", "Implementación técnica", "Evidencia", "Debilidad", "Estándar esperado", "Brecha", "Prio."];
  for (const area of MATRIZ) {
    out.push(h2(`Tabla 2${area.area.toLowerCase()}. ${area.titulo}`));
    out.push(dataTable(
      headers,
      area.filas.map((x) => [
        x.f, ESTADO_LABEL[x.e], x.impl, x.ev, x.deb, x.std, x.bre, x.prio,
      ]),
      widths,
      { size: 14, headerSize: 15 }
    ));
    out.push(body("", { after: 60 }));
  }
  return out;
}

export function seccion5() {
  return [
    h1("5. Evaluación de precisión"),
    h2("5.1 Velocidad y distancia"),
    body([
      r("La velocidad tiene la cadena más cuidada del motor: Doppler del chip ("),
      r("hasSpeed", { italics: true }),
      r(" nativo) filtrada por un Kalman escalar con compuerta de outliers en dos niveles (amortiguación ×25 ante aceleraciones implícitas superiores a 8 m/s², rechazo ×60 sobre 25 m/s²) y una predicción de 400 ms para tapar la latencia. Cuando el Doppler no es válido, la velocidad se deriva por delta de posición y se anula (NaN) si la precisión del fix es ≥60 m ("),
      ev("useRideEngine.ts L194, L614-619; geo.ts L92-95"),
      r("). El eslabón débil es la ausencia de verificación cruzada: el motor no comprueba en cada fix que la velocidad sea coherente con el desplazamiento ("),
      r("d ≈ v̄·dt", { italics: true }),
      r("), de modo que un Doppler esporádico con posición congelada, o una deriva de posición con Doppler nulo, pueden colarse en métricas."),
    ]),
    body([
      r("En distancia, el problema confirmado más importante es la acumulación sin banda muerta. El pipeline suma todo desplazamiento haversine menor a 100 m con precisión <60 m ("),
      ev("useRideEngine.ts L203-211"),
      r("), sin considerar si el ciclista está detenido: con precisión declarada de 3-5 m, el ruido de posición en reposo suma metros a cada fix. El criterio de «tiempo en movimiento» (v > 1.5 km/h, "),
      ev("L229"),
      r(") no aplica a la distancia, por lo que promedio, distancia y tiempo en movimiento se calculan con reglas distintas — la inconsistencia es estructural, no numérica. El caso extremo (fila parada en un semáforo largo) suma distancia sin tiempo en movimiento, inflando el promedio posterior."),
    ]),
    body([
      r("El umbral anti-salto de 100 m por fix es además laxo para 1 Hz: 100 m en 1 s equivalen a 360 km/h. Un umbral dependiente del intervalo real y de la precisión declarada (por ejemplo, 3 desviaciones estándar de la accuracy) sería defendible; el actual deja pasar desplazamientos falsos de hasta 99 m por fix y, por el contrario, junto con el umbral de 60 m de precisión, puede descartar tramos legítimos en bosque. No se detectaron errores matemáticos en haversine, Kalman o EMA (la implementación es estándar y "),
      ev("route-geo.test.ts"),
      r(" valida haversine contra un caso conocido: 1° de latitud ≈ 111,19 km)."),
    ]),
    h2("5.2 Altitud y desnivel"),
    body([
      r("La cadena vertical es la de menor precisión del motor. En nativo, "),
      ev("RideNativePlugin.kt"),
      r(" envía la altitud cruda de "),
      r("Location.getAltitude()", { italics: true }),
      r(" y usa 0.0 si el fix no la tiene (L71); en web, "),
      ev("c.altitude ?? 0", { italics: true }),
      r(" ("),
      ev("useRideEngine.ts L584"),
      r("). Un fix sin altitud entra al pipeline como 0 m: la pendiente salta a un valor absurdo (capado a ±35 %) y la EMA de altitud tarda varios fixes en volver, con posible gain falso. Además no se lee "),
      r("getVerticalAccuracyMeters()", { italics: true }),
      r(" (disponible desde API 26), lo que impediría ponderar la calidad vertical de cada fix. La acumulación de gain usa Math.max(0, Δalt suavizada) con avance >3 m ("),
      ev("L217-223"),
      r("): sin histéresis vertical explícita de ±2-3 m, el ruido GNSS vertical (±10-20 m típico sin barómetro) puede generar desnivel falso, aunque la EMA α=0.3 lo amortigua parcialmente. La métrica del Perfil Ciclista sí usa grupos de ≥3 m en subidas >4 % ("),
      ev("rideMetrics.ts L185-206"),
      r("), un filtro adicional correcto pero posterior al cierre."),
    ]),
    body([
      r("Dos matices que la auditoría no puede resolver sin medición: la altitud de "),
      r("Location", { italics: true }),
      r(" puede ser elipsoidal (WGS84) según proveedor, con offset de decenas de metros respecto del nivel del mar (irrelevante para gain, importante si algún día se muestra altitud absoluta); y la exactitud del gain frente a los desniveles reales del parque (Pío Nono ≈ [valor a medir en terreno]) es una prueba física pendiente — este informe no inventa cifras de error."),
    ]),
    h2("5.3 Tiempo"),
    body([
      r("El tiempo total se acumula por diferencia entre fixes con acotamiento 0.15-10 s ("),
      ev("useRideEngine.ts L172, L228"),
      r("), no por reloj de pared. Con señal estable a 1 Hz es exacto; con un túnel de 3 minutos o con el modo ahorro en web cuando el navegador congela timers, el tiempo real avanza y el motor no: el ride queda internamente inconsistente (distancia y tiempo subestimados en el mismo factor). La detección de caída usa "),
      r("Date.now()", { italics: true }),
      r(" del dispositivo ("),
      ev("fallDetect.ts L124"),
      r("), lo que confirma que el reloj está disponible y no se aprovecha para el tiempo de ride."),
    ]),
  ];
}

export function seccion6() {
  return [
    h1("6. Evaluación de rendimiento"),
    body([
      r("Lo que el código garantiza: captura a 1 Hz con FGS y pantalla bloqueada (el caso de uso fundacional del producto), un modo ahorro que reduce el pipeline a 0.5 Hz y deja la pantalla apagable con activación automática por batería baja, estructuras acotadas (track de 600 puntos con decimación, bitácora de 40 eventos) y escrituras diferidas. Lo que el código NO garantiza: cifras de consumo, CPU, RAM o latencia — no existe instrumentación ni publicación de mediciones, y esta auditoría no fabrica números. El desglose siguiente identifica los factores de costo y su evidencia."),
    ]),
    tableTitle("Tabla 3. Factores de costo identificados por inspección (sin medición física)"),
    dataTable(
      ["Factor", "Impacto esperado", "Evidencia", "Clasificación"],
      [
        ["Wake lock con pantalla encendida a 1 Hz", "Principal consumo del ride; por eso el modo ahorro lo suspende", "useRideEngine.ts (L749-751); rideBateria.ts (L71-83)", "Diseño consciente; requiere medición"],
        ["GPS ambiental en idle (watchPosition permanente sin ride)", "Duplica el uso del chip GNSS cuando la app está abierta sin ride", "useRideEngine.ts (L900-920)", "Riesgo de consumo confirmado por inspección"],
        ["Recálculo de ruta cada 30 s incondicional durante el ride con destino activo", "Tráfico de red y CPU periódicos aunque no haya desvío (OSRM público)", "useNavEngine.ts (L344-351); routingService.ts (L30-31)", "Ineficiencia confirmada por inspección"],
        ["Pipeline por fix con 4-6 haversine + punto-en-polígono + distancias a 4 accesos y 5 zonas", "Costo O(n) por fix acotado y pequeño en CPU moderna; no medido", "useRideEngine.ts §2, §5-§7", "Costo razonable; sin profiling"],
        ["Re-render de React a cada fix (1 Hz)", "Aceptable a 1 Hz; sin cap si la frecuencia sube a 5-10 Hz", "useRideEngine.ts §9 (L515-528)", "Riesgo futuro al subir frecuencia"],
        ["JSON.parse del historial completo en cada lectura del store", "Costo creciente con el historial (localStorage único)", "history.ts · readFromStorage (L89-97)", "Riesgo de escalabilidad confirmado"],
        ["Pista completa en IndexedDB con migración al arranque", "Espacio controlado; parseo único por carga", "history.ts (L305-325)", "Diseño correcto"],
        ["Doze/deep sleep y OEM agresivos", "Pérdida de fixes agrupados; muerte del proceso; sin exención solicitada", "RideLocationService.kt (START_STICKY, L82); Manifest sin REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", "Riesgo confirmado por ausencia; requiere prueba física por OEM"],
      ],
      [24, 30, 26, 20],
      { size: 19 }
    ),
    body([
      r("El punto de rendimiento más relevante para la confiabilidad no es el consumo sino la resiliencia: "),
      r("START_STICKY reinicia el servicio de ubicación, pero no restaura el estado del ride que vive en el WebView", { bold: true }),
      r(". Tras la muerte del proceso, el servicio puede volver a arrancar con el motor JS vacío: GPS activo, ride perdido. Esto conecta directamente con la mejora P0-1 (checkpoint) de la sección 11."),
    ]),
    body([
      r("Pruebas físicas recomendadas (no ejecutadas aquí, por ser una auditoría estática): perfil de batería con y sin pantalla a 1 Hz y en ahorro durante ≥4 h; comportamiento bajo Doze con pantalla apagada 30-60 min; TTFF en arranque frío bajo cielo abierto y bajo techo; estabilidad de memoria en un ride simulado de 12 h con el simulador incorporado ("),
      ev("simulation.ts"),
      r("), que permite exactamente ese ensayo sin terreno."),
    ]),
  ];
}

export function seccion7() {
  return [
    h1("7. Comparación funcional con ciclocomputadores profesionales"),
    body([
      r("La comparación se centra en prestaciones y experiencia, no en implementaciones propietarias. Garmin Edge, Wahoo ELEMNT y Bryton Rider comparten un conjunto de capacidades ampliamente documentado en sus catálogos públicos (mapas de producto y manuales de usuario de las gamas actuales): multibanda/multi-GNSS, altímetro barométrico, sensores por BLE y ANT+ (pulso, cadencia, potencia), pausa e inicio automáticos, vueltas, entrenamientos e intervalos, segmentos en vivo, reconocimiento de ascensiones, mapas y rutas con redirección, páginas de datos configurables, export FIT, detección de incidentes y baterías de jornadas largas. La tabla clasifica cada prestación en cuatro estados; donde el hardware del teléfono no puede garantizar la función se dice explícitamente, sin atribuir ninguna característica a un modelo comercial concreto."),
    ]),
    tableTitle("Tabla 4. Prestaciones de la categoría frente a Cumbre30"),
    dataTable(
      ["Prestación", "Cumbre30", "Base en el código / límite del teléfono"],
      [
        ["Captura GNSS continua en segundo plano", "Tiene", "FGS tipo LOCATION 1 Hz (RideLocationService.kt) — equivalente funcional al core de un ciclocomputador."],
        ["Velocidad Doppler filtrada", "Tiene", "Kalman con compuertas (geo.ts) — sólido; le falta validación cruzada v-d-t."],
        ["Distancia y tiempo en movimiento", "Tiene (parcial)", "Sin banda muerta en reposo; tiempo por fixes, no por reloj."],
        ["Desnivel positivo/negativo", "Parcial", "Solo gain, sin histéresis vertical ni alt. negativa; el teléfono sin barómetro limita la exactitud (muchos modelos Android sí tienen sensor de presión)."],
        ["Pausa/inicio automáticos", "No tiene", "Ausentes en el código; implementables con el GPS actual."],
        ["Sensores BLE pulso/cadencia/potencia", "Parcial", "Pulso BLE conecta y alimenta zonas (SensorPanel, RideView L478); cadencia/potencia sin ingestión; velocidad de rueda conecta pero no entra al motor."],
        ["ANT+", "No tiene (límite de hardware)", "Los teléfonos Android no incorporan ANT+; BLE es la vía realista."],
        ["Vueltas (laps) automáticas", "No tiene", "Ausente; trivial sobre el pipeline actual."],
        ["Entrenamientos, intervalos y páginas de datos configurables", "No tiene", "Ausente; requiere Activity Profiles (sección 13)."],
        ["Navegación con redirección", "Tiene (parcial)", "Grafo local + OSRM público con reanclaje y desvío a 140 m; sin instrucciones por voz en ride y dependiente de servicio comunitario sin SLA."],
        ["Mapas offline completos", "Parcial", "Tiles OSM en línea; grafo del parque local. El APK estático funciona sin backend, pero los tiles requieren red."],
        ["Export FIT / integración con plataformas", "No tiene (GPX Pro solamente)", "GPX 1.1 implementado; FIT es el formato de facto de la categoría."],
        ["Detección de incidentes", "Tiene", "FallDetector por GPS (golpe+inmovilidad) con contactos ICE opt-in — comparable en intención, distinta en sensor (sin acelerómetro)."],
        ["Tracking en vivo para terceros", "No tiene", "No implementado; el track no sale del teléfono (decisión de privacidad documentada en sync.ts)."],
        ["Batería de jornada completa (10-20 h)", "Límite de hardware", "Un teléfono con pantalla encendida no compite con la autonomía de un dispositivo dedicado; el modo ahorro mitiga parcialmente."],
        ["Multibanda GNSS", "Límite de hardware", "Depende del chip del teléfono; la app no selecciona ni reporta constelaciones."],
        ["Rigor antitrampa (vehículo)", "Tiene", "vehicleDetect + confirmación del usuario — diferenciador respecto de la categoría."],
        ["Guía contextual por voz (zonas, accesos, horarios, bajadas fiscalizadas)", "Tiene", "alertEngine + reglas del parque — hoy el diferenciador real de Cumbre30 frente a Garmin/Wahoo/Bryton, que no conocen la normativa del parque."],
      ],
      [30, 18, 52],
      { size: 19 }
    ),
    body([
      r("Síntesis: Cumbre30 ya cubre el núcleo de medición de un ciclocomputador (posición, velocidad, distancia, desnivel, registro) con calidad desigual, tiene un diferenciador genuino (guía normativa del parque con voz y fiscalización de 30 km/h) y le faltan las tres familias que definen la experiencia profesional: automatización de la sesión (pausa/laps/perfiles), ecosistema de sensores completo y interoperabilidad (FIT). El techo de hardware (batería, ANT+, multibanda) debe asumirse honestamente: sobre él no se promete paridad."),
    ]),
  ];
}

export function seccion8() {
  return [
    h1("8. Debilidades y falencias detectadas"),
    body([
      r("Esta sección clasifica cada hallazgo por su tipo de evidencia, conforme al protocolo de la auditoría: (8.1) confirmados por inspección de código, (8.2) detectados por pruebas automatizadas, (8.3) riesgos potenciales y (8.4) aspectos que necesitan prueba física. No se repite aquí la matriz completa: se desarrollan los hallazgos con su explicación técnica."),
    ]),
    h2("8.1 Confirmados por inspección de código"),
    bullet([r("D1 — El ride se guarda solo al detener (P0). ", { bold: true }), r("La única llamada a "), ev("saveRide"), r(" está en "), ev("useRideEngine.ts · stop (L855)"), r("; no hay checkpoint durante el ride ni restauración al arrancar. Un crasheo del WebView, un OOM o la muerte del proceso (el FGS revive, el estado JS no) pierde todo el recorrido — la brecha de confiabilidad más grave del motor.")]),
    bullet([r("D2 — Distancia sin banda muerta en reposo (P0). ", { bold: true }), r("El acumulador suma cualquier d<100 m con accuracy<60 m (L203-211) sin umbral por velocidad ni por precisión; la deriva en reposo infla distancia y contradice movingSec (>1.5 km/h). Inconsistencia estructural entre métricas del mismo pipeline.")]),
    bullet([r("D3 — Altitud ausente se convierte en 0 m (P0). ", { bold: true }), ev("RideNativePlugin.kt L71"), r(" y "), ev("useRideEngine.ts L584"), r(" introducen 0 m cuando el fix no trae altitud; sin "), r("verticalAccuracy", { italics: true }), r(" ni retención del último valor válido, pendiente y gain se corrompen hasta que la EMA recupera.")]),
    bullet([r("D4 — Sin histéresis vertical para el gain (P0). ", { bold: true }), r("Gain = suma de Δalt suavizada positiva con avance >3 m (L217-223); el ruido GNSS vertical puede acumular desnivel falso (amortiguado, no eliminado). La histéresis de 3 m por grupos solo aplica a la métrica posterior de subidas >4 %.")]),
    bullet([r("D5 — Tiempo por fixes, no por reloj (P1). ", { bold: true }), r("elapsed acumula dt acotado a 10 s por fix (L172, L228): un hueco de señal largo subestima tiempo y rompe la coherencia con la distancia."), ]),
    bullet([r("D6 — Sin pausa/reanudación/inicio automáticos (P1). ", { bold: true }), r("pause/resume son manuales (L762-787) y no hay detección de movimiento para arrancar: el estándar de la categoría no existe.")]),
    bullet([r("D7 — Sensores a medio integrar (P1). ", { bold: true }), r("El pulso BLE alimenta zonas de FC en la UI (RideView.tsx L180-193, L478) pero no se graba en el track ni en el GPX; la velocidad de rueda BLE conecta (sensors.ts · connectWheelSpeed) pero "), ev("onSensorSpeed"), r(" no se pasa desde RideView: el motor ignora esa fuente.")]),
    bullet([r("D8 — Recálculo de navegación ciego cada 30 s (P2). ", { bold: true }), r("El intervalo de reroute en marcha (useNavEngine.ts L344-351) recalcula aunque no exista desvío, contra un servicio público sin SLA (routingService.ts L30-31); el desvío ya tiene su propio disparo a 140 m (L354-367).")]),
    bullet([r("D9 — Track con decimación destructiva (P2). ", { bold: true }), r("El track se recorta a 600 puntos duplicando el intervalo cuando crece (L536-540): en un ride de 2 h la pista exportada va a 20 s por punto, degradando GPX y análisis posteriores — y el servidor nunca recibe la pista (privacidad), de modo que la pérdida local es irrecuperable.")]),
    bullet([r("D10 — Núcleo matemático sin tests unitarios (P1). ", { bold: true }), r("Las 14 suites del reposo no cubren SpeedKalman, computeRideMetrics, FallDetector, isMotorizedRide ni la cadena de gain (grep sobre tests/: solo route-geo.test.ts toca haversine). Cambios en el pipeline no tienen red de seguridad.")]),
    bullet([r("D11 — Estado React acoplado al motor (P2, reutilización). ", { bold: true }), r("El motor es un hook que publica por setState y mezcla reglas del parque (geocercia, accesos, corredores, horarios) con matemática genérica: no es reutilizable fuera de Cumbre30 sin extracción (desarrollo en sección 13).")]),
    bullet([r("D12 — Cap freemium poda el historial local (P3, decisión de producto). ", { bold: true }), r("applyFreeCap reduce el historial local a los últimos 20 rides en FREE (history.ts L191-202); los rides ya sincronizados viven en servidor, pero un usuario sin sesión pierde resúmenes viejos — inusual en la categoría.")]),
    h2("8.2 Detectados por pruebas automatizadas"),
    body([
      r("La suite actual (14 suites, 2026-11-22) valida módulos de datos, comunidad y rutas, pero ningún test ejercita el pipeline del ride: no existen fixtures de fixes que verifiquen que un patrón de entrada produce la distancia/gain/velocidad esperados. El único test algorítmico cercano es la sanidad de haversine en "),
      ev("route-geo.test.ts"),
      r(" (L45-49, L117-118). Consecuencia detectada por prueba: la cobertura del motor es 0 %, por lo que cualquier regresión en processFix sería silenciosa. El simulador ("),
      ev("simulation.ts"),
      r(") es la base natural para construir esos fixtures deterministas."),
    ]),
    h2("8.3 Riesgos potenciales"),
    bullet([r("R1 — Kalman con Q/R fijos: ", { bold: true }), r("no adapta R a la precisión del fix; con accuracy 3 m y accuracy 50 m el filtro reacciona igual. Mejora barata y de alto impacto.")]),
    bullet([r("R2 — Extrapolación de 400 ms al frenar: ", { bold: true }), r("la aceleración negativa se capaba a -3 m/s², por lo que tras una frenada fuerte la predicción puede mostrar más velocidad que la real durante un instante (impacto cosmético en UI, real en fiscalización marginal).")]),
    bullet([r("R3 — Altitud elipsoidal vs geoidal: ", { bold: true }), r("según proveedor, getAltitude puede referirse al elipsoide WGS84 con offset de decenas de metros; irrelevante para gain diferencial, relevante si se muestra altitud absoluta o se compara con mapas.")]),
    bullet([r("R4 — Crecimiento del localStorage: ", { bold: true }), r("el historial completo se parsea en cada lectura del store (history.ts L89-97); con cientos de rides el costo crece. La migración de pistas a IndexedDB mitiga el tamaño, no el parseo.")]),
    bullet([r("R5 — Dependencia de servicios públicos en navegación: ", { bold: true }), r("routing.openstreetmap.de y overpass-api.de son servicios comunitarios con políticas de uso; para un producto comercial se requieren instancias propias o degradación elegante (el grafo local del parque ya cubre el caso principal).")]),
    bullet([r("R6 — Estadísticas con dos criterios de movimiento: ", { bold: true }), r("1.5 km/h en el resumen (L229) vs 2.5 km/h en metrics (rideMetrics.ts L168) — el perfil y el resumen pueden discrepar en rides de velocidad baja.")]),
    bullet([r("R7 — Batería del GPS ambiental: ", { bold: true }), r("el watchPosition permanente en idle (L900-920) consume chip GNSS aunque no se pedalée; no hay timeout de inactividad.")]),
    h2("8.4 Aspectos que necesitan prueba física"),
    bullet([r("Exactitud del gain contra desniveles reales del parque (subidas conocidas) con GPS puro y, si el teléfono lo tiene, con barómetro.")]),
    bullet([r("Consumo de batería por hora en los tres modos (pantalla on, pantalla off con FGS, ahorro 0.5 Hz).")]),
    bullet([r("TTFF frío/cálido y comportamiento en bosque/cañón sin fusión de proveedores; comparación con FusedLocation en al menos un dispositivo.")]),
    bullet([r("Resiliencia real por OEM: muerte del proceso con pantalla apagada (Xiaomi/Samsung/Huawei agresivos) y recuperación con checkpoint — hoy garantizada la pérdida, no la continuidad.")]),
    bullet([r("Percepción de latencia del velocímetro (pipeline + puente + render) en dispositivos de gama baja con minSdk 24.")]),
  ];
}
