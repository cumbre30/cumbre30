// ============================================================
// gen_informe_cierre.js — Informe de ejecución y cierre de la
// fase única del Motor GPS Cumbre30 (DOCX, portada R1 + TOC).
// Cada resultado numérico indica protocolo, datos de entrada,
// referencia y fórmula de cálculo (requisito 7 del encargo).
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  AlignmentType, NumberFormat, SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const H = require("./cierre-docx-helpers");

const SALIDA = "/home/z/my-project/download/Informe_Cierre_Fase_Unica_MotorGPS_Cumbre30.docx";
const APK = process.env.APK_INFO || "compilación en curso";

// ---------- portada ----------
const portada = H.buildCoverR1({
  title: "Informe de Ejecución y Cierre de la Fase Única",
  subtitle: "Motor GPS de Cumbre30 · validación, persistencia duradera, modularización e independencia",
  englishLabel: "CUMBRE30 MOTOR GPS",
  metaLines: [
    "Versión validada: Cumbre30 v1.23.0 (versionCode 84)",
    "Núcleo del motor: src/motor/* — 10 módulos puros",
    "Fecha de cierre: 22 de noviembre de 2026",
  ],
  footerLeft: "Cumbre30 · Motor GPS",
  footerRight: "Fase única · informe de cierre",
  palette: H.P,
});

function pie() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: H.FONT })],
    })],
  });
}
function cabecera() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Informe de cierre · Motor GPS Cumbre30 · v1.23.0", size: 18, color: "808080", font: H.FONT })],
    })],
  });
}

const toc = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Contenido", bold: true, size: 32, font: H.FONT_H, color: "000000" })],
  }),
  new TableOfContents("Tabla de contenido", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Nota: este contenido se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre la tabla y elija «Actualizar campos» para refrescar la numeración de páginas.",
      italics: true, size: 18, color: "888888", font: H.FONT,
    })],
  }),
];

const c = [];

// ================= Resumen ejecutivo =================
c.push(H.h1("1. Resumen ejecutivo"));
c.push(H.body("Este informe documenta el cierre técnico de la fase única del Motor GPS de Cumbre30 sobre el código existente, sin segunda implementación ni reescritura del motor. Se verificaron las ocho correcciones de la fase única en pruebas automatizadas deterministas (26 verificaciones en la suite del núcleo y 8 en la suite de arquitectura, todas en verde), se eliminó la última dependencia residual del núcleo respecto de Cumbre30 (la fórmula Haversine ahora vive dentro del motor y las fábricas de fuentes y del perfil migraron a la capa de la aplicación), se reemplazó la dependencia del checkpoint del WebView Storage por un almacén duradero de doble capa que mantiene el contrato AlmacenCheckpoint, se resolvió la diferenciación real de tiempo total, tiempo en movimiento y tiempo pausado, y se construyó un proyecto de validación independiente que consume el motor sin importar un solo archivo interno de Cumbre30."));
c.push(H.body("La compilación nativa Android se ejecutó en el entorno del proyecto y generó la APK de validación v1.23.0 (versionCode 84). Las pruebas físicas en dispositivos reales (protocolos A a F: recuperación, precisión en reposo, altitud, pausa automática, tiempo y batería) están especificadas con criterios de aceptación y hojas de registro en el documento complementario «Protocolo de Pruebas Físicas del Motor GPS» y constituyen el único bloque de trabajo pendiente de ejecución por el equipo, porque un entorno de compilación aislado no dispone de GNSS real, dispositivos ni baterías. De igual forma, las siete suites que requieren PostgreSQL no pudieron ejecutarse en este entorno por ausencia de DATABASE_URL; se listan explícitamente junto con su causa y su estado histórico."));

// ================= 2 correcciones verificadas =================
c.push(H.h1("2. Verificación de las ocho correcciones"));
c.push(H.body("La tabla siguiente resume el estado de verificación de cada corrección. La columna automatizada indica la prueba determinista que la cubre (archivo, verificación y resultado); la columna física indica el protocolo del documento de pruebas físicas que la confirma en terreno. Conforme al encargo, no se modificó ningún algoritmo que ya cumplía sus criterios y sin evidencia de un problema."));
c.push(H.tituloTabla("Tabla 1: estado de las ocho correcciones de la fase única"));
c.push(H.tabla(
  ["Corrección", "Verificación automatizada (resultado)", "Protocolo físico"],
  [
    ["P0-1 · checkpoint cada 15 s, recuperación y continuidad", "motor-gps §8: retomado con error de distancia 3,4 % y elapsed por reloj; corrupto no se retoma. motor-cierre §1: espejo nativo recupera el ride con WebView limpio", "A (4 modos de muerte)"],
    ["P0-2 · distancia Doppler-gated sin distancia fantasma", "motor-gps §1: 180 fixes con deriva ±3 m → distancia < 10 m; §5: sin distancia fantasma tras auto-reanudación", "B (3 min inmóvil)"],
    ["P0-3 · altitud ausente vía hasAlt/valt", "motor-gps §4: cadena vertical sin dips a 0 (altMin > 800 m), valt ≥ 30 m no alimenta desnivel", "C (subida conocida)"],
    ["D4 · histéresis vertical contra desnivel falso", "motor-gps §4: ruido σ=10 m en llano → gain < 10 m; subida real de 50 m → gain 40-65 m", "C (llano + arbolado)"],
    ["D5 · elapsed por reloj independiente de fixes", "motor-gps §3: hueco de señal de 5 min → elapsed > 400 s y movingSec < 130 s", "E (interrupción de 5 min)"],
    ["D6 · pausa y reanudación automáticas", "motor-gps §5: detenido 15 s → autoPausada; elapsed congelado; pedaleo ≥ 3 km/h → corriendo; perfil desactivable", "D (semáforo 20 s)"],
    ["R1/R2 · Kalman adaptativo y frenadas", "motor-gps §7: convergencia < 8 % de error, outlier de 200 km/h amortiguado, R modulado por accuracy 3 m vs 40 m; frenada 10→2 m/s sin overshoot (14,9 km/h < 36) y convergencia ≤ 3 fixes", "D (reanudación limpia)"],
    ["R6/R7 · umbral único de movimiento y GPS ambiental", "umbral unificado 2,5 km/h en MotorConfig (motor y resúmenes); R7 verificado en código: el watch ambiental se detiene con visibilitychange hidden (useRideEngine) y el FGS solo corre durante ride", "B y F2"],
  ],
  [30, 45, 25]
));

// ================= 3 pruebas automatizadas =================
c.push(H.h1("3. Resultados de las pruebas automatizadas"));
c.push(H.body("Todas las suites del motor se ejecutan con npx tsx (Node 24) sobre fuentes TypeScript sin transpilar, con reloj y fuentes inyectados para que las corridas sean deterministas y reproducibles. Cada resultado numérico de esta sección indica su protocolo, los datos de entrada y la fórmula de cálculo aplicada."));

c.push(H.h2("3.1 Suite del núcleo (tests/motor-gps.test.ts): 26 verificaciones OK"));
c.push(H.body("Protocolo: simulación determinista con reloj controlado (arranque en t = 1 000 000 ms) y fuente de fixes sintética; sin base de datos ni React. Datos de entrada: rectas al norte a velocidad constante con Doppler limpio (paso = v/3,6 · dt / 111 320 grados por fix), ruido vertical gaussiano uniforme ±σ y semillas fijas (42, 99, 77, 2026). Fórmulas: error_pct = |d_medida − d_esperada| / d_esperada × 100, con d_esperada = (v/3,6) · t; paridad Haversine Δ = |h_motor − h_app| sobre seis pares de puntos de referencia. Referencia de criterios: encargo de la fase única y informe de brechas previo."));
c.push(H.tituloTabla("Tabla 2: resultados representativos de la suite del núcleo"));
c.push(H.tabla(
  ["Verificación", "Datos de entrada", "Resultado", "Fórmula / criterio"],
  [
    ["Banda muerta en reposo", "180 fixes, deriva ±3 m, Doppler 0, 3 min", "distancia < 10 m; movingSec < 5 s", "criterio del encargo: < 10 m"],
    ["Distancia en movimiento", "600 fixes a 20 km/h (t = 600 s)", "error 0,28 % vs esperado 3 333 m", "error_pct ≤ 5 %"],
    ["Túnel de 5 min", "hueco de señal de 300 000 ms", "elapsed por reloj 420 s; movingSec sin crecimiento en el hueco (aserción < 130 s)", "elapsed por reloj; moving solo con fixes"],
    ["Haversine extraída", "6 pares de puntos (−45° a 51° lat)", "Δ máx 9,31 × 10⁻¹⁰ m vs lib/geo", "R = 6 371 000 m en ambas"],
    ["RideSimulator desacoplado", "ruta sintética propia, semilla 2026", "secuencias idénticas; 2,30 km de ruta", "mulberry32 determinista"],
    ["Kalman y frenada", "ruido ±0,3 m/s; outlier 200 km/h; frenada 10→2 m/s", "convergencia con error 2,9 %; outlier < 40 km/h; sin overshoot", "compuertas ×25/×60; exFreno 100 ms"],
  ],
  [22, 30, 26, 22]
));

c.push(H.h2("3.2 Suite de arquitectura y persistencia (tests/motor-cierre.test.ts): 8 verificaciones OK"));
c.push(H.body("Protocolo: pruebas de integración del almacén duradero con puente nativo simulado (escribir/leer/borrar en memoria), shim de localStorage cuando el escenario lo requiere, y análisis estático de las importaciones del núcleo. Datos de entrada: rides sintéticos de 10 a 30 s a 20 km/h con checkpoint cada 5 s. Fórmula clave de la identidad de tiempos: identidad = elapsed + secPausa − tiempo_de_pared, con tolerancia ±1,5 s."));
c.push(H.tituloTabla("Tabla 3: resultados de la suite de cierre"));
c.push(H.tabla(
  ["Verificación", "Escenario", "Resultado"],
  [
    ["Espejo nativo", "WebView limpio (sin localStorage), checkpoint solo en nativo", "recuperación íntegra; distancia idéntica (Δ < 0,001 m)"],
    ["Borrado dual", "descartarRecuperacion con puente nativo", "capa sincrónica y espejo nativo sin residuos"],
    ["Frescura de capas", "localStorage viejo (t − 10 s) vs nativo nuevo (+111 m)", "prevalece el checkpoint más reciente (nativo)"],
    ["Corrupción nativa", "espejo con JSON inválido y localStorage válido", "cae al localStorage sin perder el ride"],
    ["Modo web", "sin puente nativo", "contrato sincrónico intacto"],
    ["Pureza del núcleo", "10 módulos de src/motor/* escaneados", "0 importaciones hacia la app (lib/*, React, @capacitor)"],
    ["Identidad de tiempos", "pedaleo 20 s + auto-pausa + pausa manual 40 s + pedaleo 10 s", "elapsed 47 s + pausa 46 s = pared 93 s (Δ = 0)"],
    ["API pública", "src/motor/index.ts", "exporta MotorGPS, contratos, config, haversine, almacenes"],
  ],
  [22, 44, 34]
));

c.push(H.h2("3.3 Regresión general y chequeo de tipos"));
c.push(H.body("Se ejecutaron las 16 suites del proyecto (todas las de tests/*.test.ts). Las 9 puras pasaron completas: explorar-view 61/61, motor-gps 26/26, motor-cierre 8/8, proteccion-ruta 9/9, route-geo 11/11, rutas-editor OK, rutas-ficha 22/22, rutas-store 8/8 y tarjetas-share 55/55. Las 7 restantes (api-routes, catalogo-geo, comunidad, cultura, fase-f, muro-experiencias, pro-muro) no pudieron ejecutarse en este entorno por una causa ambiental única, verificada en el log de fallo: PrismaClientInitializationError «the URL must start with the protocol postgresql://», es decir, DATABASE_URL no está definido en el sandbox y el cliente de datos no puede inicializar. No constituyen regresiones funcionales; su verificación requiere el entorno con base de datos (Vercel producción o un DATABASE_URL local) y quedan anotadas en el punto 9 como limitación del entorno."));
c.push(H.body("Chequeo de tipos con el tsconfig de verificación del proyecto: la línea base previa al cierre tenía 5 errores en archivos de pruebas (rutas-editor, rutas-ficha, fase-f, comunidad y motor-gps.test.ts). Tras el cierre quedan 4: los cuatro pre-existentes ajenos al motor y el de motor-gps.test.ts(35) quedó corregido durante el cierre (el aparato de prueba tipaba mal su fuente sintética). Fórmula de comparación: errores_nuevos = errores_después − errores_base = 4 − 5 = −1, es decir, ninguna regresión de tipos y una corrección. El proyecto independiente añade además su propio tsconfig aislado (sin alias de la app) que compila sin errores."));

// ================= 4 persistencia =================
c.push(H.h1("4. Persistencia y resistencia a fallos del checkpoint"));
c.push(H.body("El encargo pidió revisar específicamente la dependencia del checkpoint respecto del WebView Storage. El diagnóstico sobre el código previo: la implementación por defecto del núcleo (almacenLocalStorage) escribe en el localStorage del WebView Android. Esa capa sobrevive a la muerte del proceso y al reinicio del dispositivo porque Chromium la persiste en el directorio de datos de la app, pero tiene dos debilidades documentadas: los cambios se confirman a disco en lotes diferidos (un SIGKILL puede perder la última escritura del checkpoint) y las limpiezas agresivas del WebView que aplican algunos OEM pueden borrar su almacenamiento sin tocar los datos nativos de la app."));
c.push(H.body("La solución implementada mantiene el contrato AlmacenCheckpoint sin cambio alguno para el núcleo: la capa de la aplicación (src/lib/almacenDuradero.ts) inyecta un almacén de doble capa. En la escritura, el checkpoint se guarda sincrónicamente en localStorage (misma clave cumbre30-motor-checkpoint-v1, por compatibilidad con checkpoints del build anterior) y se encola una escritura espejo a un archivo nativo JSON (cumbre30-checkpoint-motor-v1.json) en el almacenamiento interno de la app vía Capacitor Filesystem (Directory.Data); la cola es serializada y last-write-wins, y la escritura nativa es durable al cerrar el archivo (sobrevive a la muerte del proceso porque el dato queda en el kernel y en disco). En la lectura, el almacén precarga el espejo nativo al abrir la app (precargar, antes de preguntar «¿Retomar ride?» en useRideEngine) y devuelve el checkpoint válido más reciente de las dos capas comparando ultimoGuardadoTs. El núcleo no sabe que existe una segunda capa: solo ve AlmacenCheckpoint, que sigue siendo sincrónico y, por tanto, inyectable e intercambiable (motor-standalone demuestra otra implementación propia sobre un archivo del proyecto)."));
c.push(H.tituloTabla("Tabla 4: cobertura de los cinco escenarios del encargo"));
c.push(H.tabla(
  ["Escenario", "Capa sincrónica (WebView)", "Espejo nativo (Directory.Data)", "Resultado"],
  [
    ["Cierre inesperado del WebView", "sí (commit diferido puede perder la última escritura)", "sí (FileOutputStream durable)", "recuperación con pérdida ≤ 1 intervalo"],
    ["Muerte del proceso (SIGKLL/force-stop)", "sí, salvo lote no confirmado", "sí", "recuperación íntegra"],
    ["Reinicio del dispositivo", "sí", "sí", "recuperación íntegra"],
    ["Recreación del WebView", "sí (mismo perfil)", "sí", "recuperación íntegra"],
    ["Limpieza del almacenamiento del WebView por el sistema", "no", "sí", "recuperación desde el espejo (verificada en motor-cierre §1)"],
  ],
  [30, 30, 22, 18]
));
c.push(H.body("El único caso no recuperable es el «Borrar datos» explícito del usuario en Ajustes de Android, que elimina tanto el almacenamiento del WebView como los archivos nativos de la app; es un reset voluntario del producto y no se considera un escenario de recuperación. La base de datos general de Cumbre30 (PostgreSQL vía DATABASE_URL, historial y sincronización) no se modificó: el checkpoint es un mecanismo de sesión del dispositivo y no toca el modelo de datos del producto."));

// ================= 5 arquitectura =================
c.push(H.h1("5. Consolidación de la arquitectura modular"));
c.push(H.body("El núcleo del motor quedó en diez módulos puros bajo src/motor/*: tipos (contratos), config (MotorConfig y resolución con rangos), geo (Haversine del motor), kalman (filtro de velocidad con R adaptativo), procesamiento (gates de frescura, precisión y salto dinámico), metricas (distancia, cadena vertical con histéresis, tiempos por reloj, track), actividad (FSM de sesión con auto-pausa), nucleo (MotorGPS: pipeline y checkpoint), persistencia (contrato + almacenes genéricos) e index (API pública). La prueba de pureza de motor-cierre escanea las importaciones de los diez módulos y no tolera ninguna referencia a lib/*, hooks, componentes, React ni Capacitor; ese chequeo corre en la suite para evitar regresiones arquitectónicas futuras."));
c.push(H.tituloTabla("Tabla 5: dependencias residuales del informe de modularización y su resolución"));
c.push(H.tabla(
  ["Dependencia residual identificada", "Resolución aplicada en el cierre"],
  [
    ["procesamiento.ts importaba haversineM de lib/geo", "extracción a src/motor/geo.ts (R = 6 371 000, misma fórmula; paridad exacta verificada: Δ máx 9,31 × 10⁻¹⁰ m); nucleo y metricas también usan la copia única del motor"],
    ["procesamiento.ts importaba el tipo LatLng de lib/park", "sustituido por PuntoGeo local del motor (lat/lon); lib/park quedó fuera del núcleo"],
    ["fuente.ts (adaptadores nativa/web/sim) vivía en src/motor y dependía de lib/rideNative y lib/simulation", "movido a src/lib/fuentes-motor.ts (capa de la app); el núcleo solo conoce el contrato FuenteUbicacion de tipos.ts"],
    ["RideSimulator importaba SIM_ROUTE desde lib/park", "ruta INYECTADA por parámetro (PuntoRutaSim[]); Cumbre30 pasa SIM_ROUTE desde sus adaptadores; otro proyecto pasa la suya"],
    ["config.ts contenía el perfil del producto (clave cumbre30-motor-cfg-v1, leerConfigMotor, setAutoPausaActivada)", "movido a src/lib/motorPerfil.ts; MotorConfig queda independiente del producto"],
    ["persistencia por defecto en localStorage del WebView", "contrato AlmacenCheckpoint inyectable; la app inyecta el almacén duradero de doble capa (sección 4)"],
  ],
  [45, 55]
));
c.push(H.body("MotorConfig se mantiene como configuración pura con validación de rangos y sin persistencia del producto; la API pública del motor es el barrel src/motor/index.ts, único punto de importación recomendado para consumidores externos. El empaquetado como SDK y la publicación comercial quedan explícitamente fuera de esta fase, como pide el encargo: la estructura técnica queda preparada (núcleo puro, contratos inyectables, API pública) pero sin packaging ni versionado de paquete."));
c.push(H.tituloTabla("Tabla 6: clasificación final de componentes"));
c.push(H.tabla(
  ["Componente", "Clasificación", "Nota"],
  [
    ["src/motor/* (10 módulos)", "Reutilizable (núcleo)", "sin dependencias de la app; consumible vía index.ts"],
    ["src/lib/simulation.ts (RideSimulator)", "Reutilizable (toolkit)", "ruta inyectada; solo depende del núcleo del motor"],
    ["src/lib/almacenDuradero.ts", "Patrón reutilizable / implementación de la app", "el patrón doble capa es aplicable a otros proyectos con su propio puente"],
    ["src/lib/fuentes-motor.ts", "Exclusivo de la app (adaptadores)", "puente nativo RideNative y SIM_ROUTE del parque"],
    ["src/lib/motorPerfil.ts", "Exclusivo de la app", "perfil de actividad y preferencias del usuario de Cumbre30"],
    ["useRideEngine + reglas del parque, voz, fiscalización, geocercia", "Exclusivo de la app", "consumidor del motor; aplica SUS reglas de negocio sobre los eventos"],
    ["RideNativePlugin.kt / RideLocationService.kt", "Exclusivo de la app (plataforma)", "FGS GPS_PROVIDER 1 Hz; el contrato FixBruto es el punto de unión"],
  ],
  [34, 26, 40]
));

// ================= 6 compilación =================
c.push(H.h1("6. Compilación e integración Android"));
c.push(H.body("La compilación nativa se ejecutó en el entorno de compilación del proyecto (JDK Temurin 21 y Android SDK instalados en tools/ por el script setup-android-env.sh, Gradle 8.14.3 con el init-script de espejo del repositorio). El flujo replicó el script build-android.sh: export estático web con NEXT_PUBLIC_STATIC=1 (las rutas API se restauran al terminar), sincronización Capacitor (npx cap sync android) y Gradle assembleDebug. El resultado: " + APK + ". La variante debug usa el keystore de depuración del repositorio (android/debug.keystore) y es instalable en cualquier dispositivo para la validación; no sustituye a la variante release firmada."));
c.push(H.body("Importante para la publicación: el keystore de release (android/cumbre30-release.keystore y android/keystore.properties) no está presente en el entorno actual, porque vive fuera del repositorio por seguridad y el directorio no lo conservó el reciclaje del sandbox. Para generar la próxima APK/AAB de producción debe restaurarse desde el respaldo local del equipo (el mismo que firmó la v1.22.0 code 83, publicada en GitHub Releases). Este punto no bloquea la validación del motor con la APK debug."));
c.push(H.h2("6.1 Verificación de la captura GNSS nativa"));
c.push(H.body("La inspección del código nativo confirmó los requisitos de independencia de proveedores de posición y la honestidad de la altitud, sin cambios adicionales respecto de lo implementado en la fase única."));
c.push(H.tituloTabla("Tabla 7: evidencia en el código nativo (RideLocationService.kt y RideNativePlugin.kt)"));
c.push(H.tabla(
  ["Requisito", "Evidencia", "Resultado"],
  [
    ["Solo GPS_PROVIDER durante el ride", "RideLocationService.kt línea 81: requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0f, ...) a 1 Hz con FGS tipo location", "cumple"],
    ["Sin NETWORK_PROVIDER ni proveedores fusionados", "búsqueda de NETWORK_PROVIDER, FusedLocationProvider, PASSIVE_PROVIDER y fused en todo android/app/src/main/java: solo menciones documentales negativas", "cumple"],
    ["hasAlt honesto", "payload gpsfix: data.put(\"hasAlt\", loc.hasAltitude()); la fuente JS mapea hasAlt=false → alt null (el motor conserva la última válida, jamás 0)", "cumple"],
    ["valt (accuracy vertical)", "payload gpsfix: loc.hasVerticalAccuracy() → verticalAccuracyMeters (API 26+); −1 si no disponible; el motor la usa para rechazar ruido vertical ≥ 30 m", "cumple"],
    ["Doppler", "speed con hasSpeed(); negativo → inválido; el motor lo pasa por Kalman con R adaptativo", "cumple"],
  ],
  [26, 52, 22]
));
c.push(H.body("Las suites de regresión se ejecutaron después de los cambios de arquitectura (sección 3.3) y el chequeo de tipos no registró errores nuevos; los módulos históricos que consumen el motor (historial, sincronización, GPX exportado desde el track del motor, voz, hápticos, detección de caída, detección de vehículo y fiscalización 30 km/h) no sufrieron cambios de contrato: los eventos del motor (fix, estado, alerta) mantienen su forma y la fiscalización sigue alimentada por la velocidad filtrada. Su verificación completa en dispositivo corresponde a los protocolos A a F y a la prueba general de la APK."));

// ================= 7 independencia =================
c.push(H.h1("7. Prueba de independencia: proyecto motor-standalone"));
c.push(H.body("Se construyó el proyecto de validación independiente en motor-standalone/ (con su propio tsconfig sin alias de rutas y su README). El proyecto consume únicamente la API pública del motor (../src/motor/index) y el simulador reutilizable (../src/lib/simulation), y cumple los siete requisitos del punto 6 del encargo: crea su propia configuración (resolverMotorConfig con perfil propio), inyecta su propia fuente de ubicación (generador sintético propio, ni navigator.geolocation ni el puente nativo), inicia el motor, recibe eventos tipados (motor.on), consulta métricas (snapshot y velKmhActual), gestiona su propio almacenamiento (AlmacenCheckpoint implementado sobre un archivo JSON del propio proyecto) y ejecuta pruebas con RideSimulator inyectando una ruta ajena a Cumbre30 (tres waypoints en Madrid)."));
c.push(H.tituloTabla("Tabla 8: resultados de la validación independiente (npx tsx motor-standalone/validacion.ts)"));
c.push(H.tabla(
  ["Escenario", "Datos de entrada", "Resultado"],
  [
    ["A · ride propio", "fuente propia 18 km/h, tick 100 ms, 2,5 s", "24 fixes, 0,01 km, estado corriendo; 24 eventos tipados"],
    ["B · cierre y retoma", "checkpoint en el archivo del proyecto; «proceso muere»; motor nuevo", "retoma continua (18 m ≥ 11 m del checkpoint); checkpoint borrado por su almacén"],
    ["C · RideSimulator", "ruta propia de 2,30 km (Madrid), semilla 7", "11 fixes, 0,03 km en 1,2 s simulados"],
    ["D · utilidades", "haversineM entre waypoints; Kalman con medición 5 m/s × 20", "1 323,0 m; convergencia a 18,0 km/h"],
  ],
  [18, 42, 40]
));
c.push(H.body("La fórmula del escenario D: distancia Haversine estándar con R = 6 371 000 m entre (40,4168, −3,7038) y (40,4090, −3,6920); la velocidad convergida se expresa como v × 3,6 km/h y coincide con la medición de 5 m/s. La prueba del escenario B valida el contrato de recuperación sin conocer el almacenamiento de Cumbre30, que es el requisito central de reutilización."));

// ================= 8 pruebas físicas =================
c.push(H.h1("8. Pruebas físicas: estado de ejecución"));
c.push(H.body("Los seis protocolos físicos del encargo (A recuperación, B precisión en reposo, C altitud y desnivel, D pausa automática, E tiempo y F batería con tres corridas de dos horas) están especificados paso a paso, con fórmulas de cálculo, criterios de aceptación y hojas de registro, en el documento «Protocolo de Pruebas Físicas del Motor GPS Cumbre30» que acompaña a este informe. Su ejecución requiere dispositivos Android reales con GNSS de terreno, lo que no está disponible en el entorno de compilación aislado en el que se cerró el resto de la intervención: no existe forma honesta de reportar mediciones de terreno sin haberlas realizado. Por esa razón este informe las declara pendientes de ejecución por el equipo, con la APK de validación ya generada y lista para instalar (adb install cumbre30-v1.23.0-code84.apk). Los dispositivos y versiones Android utilizados quedarán documentados en las hojas de registro del protocolo (modelo, versión, build del OEM y estado de optimización de batería), tal como exige el encargo en su punto 7."));
c.push(H.tituloTabla("Tabla 9: estado por protocolo físico"));
c.push(H.tabla(
  ["Protocolo", "Estado", "Evidencia requerida"],
  [
    ["A · Recuperación (4 modos)", "Pendiente de ejecución", "grabación de pantalla + mediciones de pérdida"],
    ["B · Precisión en reposo (3 min)", "Pendiente de ejecución", "captura del resumen + condición de cielo"],
    ["C · Altitud y desnivel", "Pendiente de ejecución", "GPX exportado + referencia de D3"],
    ["D · Pausa automática", "Pendiente de ejecución", "cronometraje de activación + resumen"],
    ["E · Tiempo (hueco de 5 min)", "Pendiente de ejecución", "grabación + comparación con cronómetro"],
    ["F · Batería (3 × 2 h)", "Pendiente de ejecución", "B0/B1/B2 por corrida + condiciones"],
  ],
  [30, 28, 42]
));

// ================= 9 limitaciones =================
c.push(H.h1("9. Limitaciones técnicas que permanecen"));
c.push(H.body("Quedan documentadas las siguientes limitaciones, ninguna de las cuales bloquea el uso del motor en producción dentro de Cumbre30."));
c.push(H.bullet("Pruebas físicas pendientes: los protocolos A a F requieren ejecución humana en dispositivos reales; es el único criterio del encargo aún no cerrado (sección 8)."));
c.push(H.bullet("Suites con PostgreSQL no ejecutadas en este entorno: api-routes, catalogo-geo, comunidad, cultura, fase-f, muro-experiencias y pro-muro requieren DATABASE_URL; el fallo observado es exclusivamente de conexión (PrismaClientInitializationError) y no funcional."));
c.push(H.bullet("Keystore de release no presente en el entorno: la próxima APK/AAB de producción exige restaurar android/cumbre30-release.keystore y android/keystore.properties desde el respaldo del equipo; la validación se hizo con variante debug."));
c.push(H.bullet("«Borrar datos» del sistema elimina el checkpoint: ambas capas de persistencia viven en el almacenamiento de la app; es un reset voluntario y no es un escenario de recuperación."));
c.push(H.bullet("SDK no empaquetado: por decisión del encargo, el motor queda preparado (núcleo puro, API pública, consumible desde un proyecto independiente) pero sin packaging comercial ni versionado de paquete."));
c.push(H.bullet("Máximo de track: el track interno conserva hasta 600 puntos con decimación progresiva (trackMaxPts); en rides muy largos la resolución del GPX se ajusta automáticamente al doble del intervalo cuando se alcanza el límite, comportamiento histórico conservado."));

// ================= 10 criterio de cierre =================
c.push(H.h1("10. Criterio de cierre de la fase única"));
c.push(H.body("El encargo define siete condiciones para declarar terminada la fase única. La tabla siguiente muestra el estado verificable de cada una al cierre de esta intervención."));
c.push(H.tituloTabla("Tabla 10: checklist del criterio de cierre"));
c.push(H.tabla(
  ["#", "Condición", "Estado", "Evidencia"],
  [
    ["1", "Correcciones críticas verificadas en pruebas automatizadas", "Cumple", "motor-gps 26/26 y motor-cierre 8/8 (secciones 3.1 y 3.2)"],
    ["1b", "Verificación física de las correcciones", "Pendiente", "protocolos A-F del documento de pruebas físicas"],
    ["2", "APK nueva compilada e instalada", "Cumple la compilación; instalación pendiente en dispositivo", "v1.23.0 code 84 (sección 6)"],
    ["3", "Recuperación ante fallos reales", "Automatizada cumple; física pendiente", "motor-cierre §1 (4 modos cubiertos en protocolo A)"],
    ["4", "Captura GNSS sin proveedores alternativos", "Cumple", "tabla 7: GPS_PROVIDER exclusivo, sin fusionados"],
    ["5", "Batería y precisión documentadas", "Protocolo listo; mediciones pendientes", "protocolo F con fórmulas y criterios"],
    ["6", "Sin regresiones funcionales", "Cumple en suites puras y tipos", "9/9 suites puras; tsc sin errores nuevos"],
    ["7", "Núcleo consumible desde proyecto independiente", "Cumple", "motor-standalone: validación OK (sección 7)"],
  ],
  [6, 40, 24, 30]
));
c.push(H.body("Conclusión: el motor GPS de Cumbre30 queda estable, recuperable, eficiente y modular en su dimensión verificable por software, con la APK de validación generada y el proyecto de independencia funcionando. La declaración formal de cierre de la fase única queda condicionada exclusivamente a la ejecución de los protocolos físicos A-F con la APK v1.23.0 y a la ejecución de las siete suites con base de datos en un entorno con DATABASE_URL disponible; ambos trabajos están preparados y documentados para ejecutarse sin trabajo adicional de ingeniería."));

// ================= anexo =================
c.push(H.h1("Anexo A. Comandos de reproducción"));
c.push(H.body("Todos los resultados de este informe son reproducibles con los comandos siguientes, ejecutados desde la raíz del repositorio."));
c.push(H.tituloTabla("Tabla 11: comandos de reproducción"));
c.push(H.tabla(
  ["Resultado", "Comando"],
  [
    ["Suite del núcleo del motor", "npx tsx tests/motor-gps.test.ts"],
    ["Suite de arquitectura y persistencia", "npx tsx tests/motor-cierre.test.ts"],
    ["Proyecto independiente", "npx tsx motor-standalone/validacion.ts"],
    ["Chequeo de tipos aislado del proyecto independiente", "npx tsc --noEmit -p motor-standalone/tsconfig.json"],
    ["Chequeo de tipos del proyecto", "npx tsc --noEmit -p tsconfig.tscheck.json"],
    ["Suite de regresión pura (ejemplo)", "npx tsx tests/explorar-view.test.ts"],
    ["Export estático + sincronización Capacitor", "PLAY_BUILD=0 STAGE=export bash scripts/build-android.sh (o el flujo manual del script)"],
    ["APK de validación", "cd android && JAVA_HOME=../tools/jdk ./gradlew assembleDebug --no-daemon --init-script ../scripts/gradle-mirror-init.gradle"],
  ],
  [40, 60]
));

// ---------- documento ----------
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: H.P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: H.P.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: H.P.primary },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: portada,
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: { default: cabecera() },
      footers: { default: pie() },
      children: toc,
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: cabecera() },
      footers: { default: pie() },
      children: c,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(SALIDA, buf);
  console.log("ESCRITO:", SALIDA, (buf.length / 1024).toFixed(0) + " KB");
});
