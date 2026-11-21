// ---------- Contenido: secciones 1 a 5 ----------
const seccion1 = [
  h1("1. Decisiones definitivas y registro de cambios v2 → v2.1"),
  p("Este documento es la **revisión técnica final (v2.1)** de la arquitectura corregida aprobada conceptualmente, y es la versión sometida a aprobación antes de iniciar la fase A. Incorpora las correcciones de los cuatro puntos revisados: consultas geográficas (con la corrección de un error real detectado en el predicado del bounding box de la v2), protección geométrica por niveles, migraciones y despliegue con guard de entorno, y moderación ponderada contra denuncias coordinadas. No modifica el motor GPS ni el motor de trazado y no inicia implementación; su objetivo es que las decisiones estructurales queden cerradas y probadas **antes** de que existan rutas y contenido comunitario publicados."),
  tableTitle("Tabla 1: Estado de las decisiones"),
  dataTable(
    ["Decisión", "Estado", "Detalle en"],
    [
      ["Reutilizar motor de trazado y motor GPS; no duplicar servicios de ubicación", "Aprobada (v1)", "Auditoría v1, secciones 4.1 y 6.6"],
      ["Segmentos personales privados; separar ROUTE / ACTIVITY / SEGMENT", "Aprobada (v1)", "Auditoría v1, sección 5"],
      ["Actividades históricas intactas; fases aditivas; compatibilidad web y APK", "Aprobada (v1)", "Auditoría v1, secciones 8 y 9"],
      ["Geometría original privada y pública protegida, con vista previa", "Corregida (v2) · ajustada (v2.1)", "Sección 3"],
      ["Consultas geográficas sobre columnas dedicadas, no sobre polilíneas", "Corregida (v2) · **corregida (v2.1)**", "Sección 4"],
      ["Elevación null explícita; dificultad física y técnica diferenciadas", "Corregida (v2)", "Sección 5"],
      ["Pipeline seguro de fotografías (EXIF, formatos, límites, borrado)", "Nueva (v2)", "Sección 8"],
      ["Moderación con control de abuso, historial y apelaciones", "Corregida (v2) · **ajustada (v2.1)**", "Sección 7"],
      ["Atributos recreativos orientativos sin clasificación competitiva", "Nueva (v2)", "Sección 5.3"],
      ["Entidad de experiencias comunitarias separada de la geometría oficial", "Nueva (v2)", "Sección 6"],
      ["Control de vigencia con fecha de revisión y estados informativos", "Nueva (v2)", "Sección 7.4"],
      ["Migraciones Prisma con guard de entorno y runbook de fallo", "Corregida (v2) · **ampliada (v2.1)**", "Sección 9"],
      ["Suite de pruebas automatizadas como criterio de aceptación", "**Nueva (v2.1)**", "Sección 12"],
    ],
    [52, 18, 30]
  ),
  h2("1.1 Registro de cambios y justificación técnica"),
  p("Los nueve cambios v2 → v2.1 con su justificación técnica; el detalle de cada punto está en la sección indicada y los casos de prueba asociados en la sección 12."),
  tableTitle("Tabla 2: Registro de cambios v2 → v2.1"),
  dataTable(
    ["#", "Cambio", "Justificación técnica"],
    [
      ["C1", "Predicado del bounding box corregido a la forma de intersección: minLat <= norte AND maxLat >= sur AND minLon <= este AND maxLon >= oeste", "La v2 publicaba el predicado invertido (minLat <= sur AND maxLat >= norte), que es de contención: solo encontraría rutas cuyo bbox contiene TODO el viewport, excluyendo justamente las rutas parcialmente visibles — el caso de uso principal. Error real, corregido con la forma canónica de intervalos superpuestos y fijado con pruebas."],
      ["C2", "Celdas geohash: del valor único del centro a cells String[] con todas las celdas que la geometría toca, índice GIN y consulta hasSome", "Con la celda del centro, una ruta larga cuyo centro cae fuera del viewport era invisible aunque lo atravesara. La celda pasa a ser atributo de la geometría completa, garantizando el requisito del encargo de encontrar rutas multi-celda con centro fuera del viewport."],
      ["C3", "Viewport que cruza el antimeridiano: ramificación longitudinal (minLon <= este OR minLon >= oeste)", "Chile continental no cruza ±180°, pero Rapa Nui (−109°) entra en el catálogo y un viewport mal normalizado rompería la consulta de forma silenciosa. Corrección barata, cubierta por prueba CT-G6."],
      ["C4", "Falso positivo del bbox documentado (rutas en U) con decisión explícita para el MVP", "El bbox sobre-aproxima: puede incluir una ruta cuya geometría no cruza el viewport. Decisión: aceptar el falso positivo en el MVP (el render muestra la geometría real y el costo es un resultado de más) y eliminarlo con ST_Intersects al activar PostGIS."],
      ["C5", "Protección por niveles: snap solo ≤ 30 m (deriva GPS); sin snap entre 30 y 80 m; sin geometría inventada en zonas sin vía", "La regla v2 de snap hasta 80 m podía mover un extremo 80 m — una alteración perceptible y con riesgo de tramo artificial. v2.1 restringe el snap a corrección de deriva y en zonas sin conexión al grafo solo recorta y amplía la zona de imprecisión. La continuidad queda garantizada porque solo se recortan prefijo y sufijo."],
      ["C6", "Suite de pruebas automatizadas definida (23 casos: consultas, protección, migraciones, moderación)", "El encargo exige verificación con rutas de distintas extensiones y posiciones. La suite queda especificada en la sección 12 como criterio de aceptación de las fases A, D y E, en CI desde la fase D."],
      ["C7", "Guard de migraciones: prisma migrate deploy solo con VERCEL_ENV=production; previews y desarrollo excluidos", "Un despliegue de preview con DATABASE_URL apuntando a producción por error de configuración podría mutar el esquema de producción. El guard lo vuelve imposible; opcionalmente Neon branching da a cada preview una base efímera."],
      ["C8", "Respaldo y runbook: PITR de Neon, pg_dump previo a migraciones estructurales, política aditiva sin DROP, runbook de migración fallida", "Define el comportamiento ante fallos antes de tener contenido publicado: migrate deploy aborta, el build falla y el deploy anterior de Vercel sigue en línea (despliegues atómicos); la corrección es manual y trazada con migrate resolve."],
      ["C9", "Moderación ponderada: umbral de confianza ≥ 2,0, pesos por antigüedad y actividad, decaimiento por denuncias descartadas, lote sospechoso por velocidad, ocultamiento reversible y notificado", "Con el umbral v2 (dos reportantes), dos cuentas coordinadas nuevas podían ocultar una ruta injustificadamente. El umbral ponderado exige confianza real, la señal de velocidad desactiva el ocultamiento automático ante lotes coordinados y toda decisión queda trazada con su peso y es apelable."],
    ],
    [7, 44, 49]
  ),
];

const seccion2 = [
  h1("2. Modelo de datos corregido"),
  p("El modelo conserva la estructura aprobada en v2 (Route, RouteVersion, RoutePoi, RoutePhoto, RouteFavorite, RouteComment, RouteRating, RouteReport, RouteExperience, ExperiencePhoto, ModerationLog, User.role) con tres ajustes v2.1: la columna de celda única pasa al arreglo **cells** (todas las celdas geohash-5 que la geometría toca), RouteReport incorpora el **peso y la clasificación** del reporte al registrarse, y la política de migraciones se expande a la sección 9 con guard de entorno y runbook."),
  tableTitle("Tabla 3: Route — modelo definitivo (v2.1)"),
  dataTable(
    ["Grupo", "Campos", "Notas"],
    [
      ["Identidad", "id, ownerId, nombre, descripcion, modalidad", "Nombre ≤ 80; descripcion ≤ 2000"],
      ["Geometría pública", "polyline (comprimida), coordsPubVer, minLat/maxLat/minLon/maxLon, cells String[], centerLat/centerLon", "cells: celdas geohash-5 tocadas por la geometría (índice GIN); fallback geohash-4 si supera 64 celdas"],
      ["Extremos aproximados", "inicioAproxLat/Lon, finAproxLat/Lon, proteccion: {recorteIniM, recorteFinM, snapInicio?, snapFin?, sinSnapInicio?, sinSnapFin?}", "Redondeo a 3 decimales (~110 m); snap registrado solo si ocurrió (≤ 30 m, cambio C5)"],
      ["Elevación", "gainM?, lossM?, minEle?, maxEle?, eleFuente (gpx | servicio | null)", "Float? — null prohibido como 0; resuelta al publicar (sección 5.1)"],
      ["Dificultad", "dificultadFisica (1-5), dificultadTecnica (1-5), dificultadOrigen (auto | creador)", "Sugerencia orientativa editable siempre (sección 5.2)"],
      ["Recreativa", "attrs String[] (máx 3 del enumerado)", "escénica, familiar, recreativa, desafiante, principiantes, miradores, descanso"],
      ["Vigencia", "ultimaRevisionAt, estadoVigencia (derivado)", "Estados: vigente | avisos | sin-revisar | retirada (sección 7.4)"],
      ["Ciclo de vida", "status (borrador | publicado | oculta | retirada), timestamps, removedAt?", "Oculta = ocultamiento automático reversible; retirada = despublicación"],
      ["Borrado", "soft-delete (removedAt) + purga diferida", "Primera convención de soft-delete general; precede a Incident.active"],
    ],
    [18, 46, 36]
  ),
  h2("2.1 Entidades nuevas o modificadas"),
  tableTitle("Tabla 4: Entidades del módulo (definitivo)"),
  dataTable(
    ["Tabla", "Campos clave / unicidad", "Propósito"],
    [
      ["RouteVersion", "routeId, v, geometrySnapshot (protegida), metaSnapshot, eleSnapshot?, publishedAt", "Historial; los rides y experiencias anclan a la versión"],
      ["RoutePoi", "routeId, orden, lat, lon, tipo, nombre, nota", "Puntos de interés sobre la geometría pública"],
      ["RoutePhoto", "routeId, url, orden, blobPathname, hash", "Fotos de ficha; blobPathname permite borrado físico"],
      ["RouteFavorite", "@@unique([userId, routeId])", "Guardar / favoritos (patrón Achievement)"],
      ["RouteComment", "routeId, userId, body, removedAt?", "Comentarios con borrado propio/moderador"],
      ["RouteRating", "@@unique([userId, routeId]), valor 1-5, updatedAt", "Una valoración editable por usuario"],
      ["RouteReport", "@@unique([routeId, reporterId, motivo]), motivo enum, estado, peso Float, clasificacion (normal | sospechoso), nota", "Denuncias tipificadas con dedup y **peso de confianza registrado al crear** (sección 7)"],
      ["RouteExperience", "routeId, routeVersionId, userId, rideId?, fechaRealizacion, comentario, condiciones String[], observacion, removedAt?", "Experiencias comunitarias (sección 6)"],
      ["ExperiencePhoto", "experienceId, url, blobPathname", "Fotos de experiencia (máx 3)"],
      ["ModerationLog", "actorId, accion, targetType, targetId, motivo, detalle (pesos y umbral), nota, createdAt", "Historial inmutable; el detalle registra la base de cada decisión"],
      ["User.role", "user | moderador | admin (default user)", "Autoriza /api/moderation; transición con adminKey"],
    ],
    [20, 46, 34]
  ),
  h2("2.2 Convenciones de integridad"),
  p("Toda unicidad de participación se resuelve en base de datos con @@unique compuestos, siguiendo el patrón ya usado por Friendship y Achievement (schema.prisma:222 y 232), no con contadores en el cliente. Todo contenido comunitario usa soft-delete con removedAt y borrado físico diferido de blobs asociados. Los rides referencian RouteVersion (id + v): si la geometría cambia, los rides y experiencias antiguos siguen apuntando a su versión y sus datos permanecen idénticos. El autorreparo runtime existente de incidents (ALTER TABLE ADD COLUMN IF NOT EXISTS en api/incidents/route.ts:26-39) queda como está por ser tabla vigente, pero los módulos nuevos no replican ese patrón: usan migraciones formales (sección 9)."),
];

const seccion3 = [
  h1("3. Privacidad geométrica (ajustada en v2.1)"),
  p("Principio intacto: la **geometría original vive solo en el dispositivo del propietario** (store c30.rutas-v2); el servidor recibe, al publicar, exclusivamente la **geometría pública protegida** derivada en el teléfono. La revisión v2.1 ajusta el mecanismo de extremos (cambio C5) para eliminar todo riesgo de discontinuidad o alteración artificial: el snap se restringe a corrección de deriva GPS y **nunca se inventa geometría**."),
  h2("3.1 Protección por niveles de extremo"),
  p("La protección se aplica por extremo (inicio y fin de forma independiente) con tres niveles, evaluados en este orden:"),
  bullet("**Nivel A — snap de deriva (≤ 30 m):** si el vértice del extremo queda a 30 metros o menos de un nodo de vía del grafo, se sustituye el vértice por la coordenada del nodo. Es la corrección de deriva GPS habitual: imperceptible, sin vértices nuevos y sin desvíos — el segmento previo se acorta o alarga como máximo 30 m y la polilínea sigue conexa. Tras el snap se aplica el truncado."),
  bullet("**Nivel B — sin snap (30-80 m o cualquier otra distancia a una vía):** la regla v2 permitía snap hasta 80 m; v2.1 la retira porque mover un extremo 30-80 m ya es una alteración perceptible del recorrido. Si no hay nodo a ≤ 30 m, **no hay snap**: solo truncado."),
  bullet("**Nivel C — zona sin conexión al grafo (sin vía cercana):** en trailheads rurales o trazados fuera de la red cartografiada no se crea ningún tramo de conexión al grafo — inventarlo alteraría artificialmente el recorrido. Se marca sinSnap en el registro de protección, se aplica el truncado sobre la geometría cruda y la zona de imprecisión del extremo conserva su radio de 150 m."),
  p("El **truncado** (común a los tres niveles) recorta desde cada extremo hasta el primer vértice que queda a más de D = 150 metros del extremo original, con tope de 400 m o el 10 % de la distancia, lo que ocurra primero. Como solo elimina prefijo y sufijo de la polilínea, la continuidad queda garantizada por construcción: el resultado es una polilínea conexa, sin saltos, sin vértices añadidos y sin desplazamientos. Si el tope se alcanza (por ejemplo, un inicio a 600 m de la primera vía), la vista previa lo advierte y sugiere mover el extremo manualmente antes de publicar; publicar con tope excedido exige confirmación explícita (prueba CT-P6)."),
  p("Los extremos publicados se representan como **zona aproximada** (círculo de 150 m) con coordenadas redondeadas a 3 decimales (~110 m) en inicioAprox/finAprox — los únicos datos de extremo que consumen búsqueda y ficha; el pin exacto del creador jamás se publica. Los casos del encargo quedan cubiertos: **domicilios urbanos** (el recorte elimina la aproximación privada, prueba CT-P1), **calles sin salida** (son vías del grafo: nivel A si la deriva es ≤ 30 m y el recorte de 150 m elimina el acceso privado, CT-P2), **zonas sin conexión directa al grafo** (nivel C: sin snap, sin tramos inventados, CT-P3). La exportación GPX de una ruta pública entrega la geometría protegida y nada más (CT-P4); solo el propietario puede exportar el original de sus propias rutas desde su dispositivo."),
  h2("3.2 Vista previa de publicación"),
  p("La publicación exige pasar por la vista previa (fase D): mapa con la geometría protegida y capa superpuesta opt-in de la original para comparar; metros recortados por extremo; nivel de protección aplicado por extremo (snap de deriva, solo recorte, sin snap); y la lista exacta de datos que salen del dispositivo (geometría protegida, metadatos, dificultad, atributos, fotos ya sin EXIF, POIs). La confirmación exige marcar «revisé la protección aplicada». Las pruebas CT-P de la sección 12 verifican que el payload del POST y el GPX exportado contienen únicamente información protegida y que la original jamás sale del dispositivo."),
];

const seccion4 = [
  h1("4. Estrategia geográfica (corregida en v2.1)"),
  p("La búsqueda por área nunca decodifica polilíneas: las consultas corren sobre columnas dedicadas calculadas al escribir, y la polilínea comprimida es solo el formato de entrega. La revisión v2.1 corrige el predicado de intersección (error real de la v2, cambio C1), sustituye la celda única por el arreglo de celdas tocadas (C2) y define el manejo de límites geográficos y las pruebas automatizadas (C3, C4, C6)."),
  h2("4.1 Predicado de intersección corregido"),
  p("Sea el viewport definido por norte (n), sur (s), este (e) y oeste (o). La intersección entre el bbox de la ruta [minLat, maxLat] × [minLon, maxLon] y el viewport usa la forma canónica de intervalos superpuestos:"),
  bullet("**Latitud:** minLat <= n AND maxLat >= s. **Longitud:** minLon <= e AND maxLon >= o. El predicado es inclusivo en los bordes: una ruta que toca el límite del viewport por un vértice sí se incluye (prueba CT-G4)."),
  bullet("**Error de la v2 (C1):** publicaba minLat <= s AND maxLat >= n — la contención del viewport dentro del bbox de la ruta — que excluye las rutas parcialmente visibles, el caso de uso principal de la búsqueda por mapa. Corregido, fijado en la especificación y cubierto por pruebas para evitar regresión."),
  bullet("**Antimeridiano (C3):** si o > e (viewport que cruza ±180°, aplicable a Rapa Nui y zonas futuras), la condición longitudinal se ramifica en (minLon <= e OR minLon >= o); el generador de celdas usa la misma ramificación (prueba CT-G6)."),
  bullet("**Falso positivo aceptado (C4):** el bbox sobre-aproxima: una ruta en U cuyo bbox cruza el viewport pero cuya geometría no aparece en resultados. Decisión para el MVP: aceptarlo — el usuario ve la geometría real al renderizar y el costo es un resultado de más; ST_Intersects lo elimina al activar PostGIS sin cambiar la API (prueba CT-G5 documenta el comportamiento)."),
  h2("4.2 Celdas multi-celda: todas las celdas tocadas (C2)"),
  p("La v2 indexaba la celda geohash-5 del centro: una ruta larga cuyo centro cae fuera del viewport era invisible aunque lo atravesara. v2.1 almacena **cells String[]**: el conjunto de celdas geohash-5 (~4,9 × 4,9 km) que la geometría toca, calculado al escribir recorriendo la polilínea y subdividiendo los segmentos más largos que la celda. Con índice **GIN** (@@index([cells], type: Gin)) la consulta usa el solapamiento de arreglos (en Prisma, hasSome) contra las celdas del viewport, y el predicado bbox corregido afina el resultado. Una ruta urbana típica toca 1-6 celdas y una de 150 km unas 30; si una ruta supera 64 celdas, su conjunto se almacena en geohash-4 (~39 km, más grueso) y el generador de celdas del viewport incluye también las celdas madre geohash-4 de sus celdas geohash-5, de modo que la mezcla de granularidades sigue encontrando la ruta. Esto cumple el requisito del encargo: rutas que atraviesan varias celdas se encuentran aunque su centro esté fuera del viewport (pruebas CT-G2 y CT-G6)."),
  h2("4.3 Orden, paginación y PostGIS"),
  p("Se conservan de la v2: centerLat/centerLon para orden por cercanía (haversine en SQL), distKm indexado para los filtros de distancia, @@index([status, createdAt]) y paginación por cursor (LIMIT 20, cursor por id/createdAt) estable ante inserciones entre páginas (CT-G7). PostGIS mantiene su papel de ruta de migración documentada: al superar ~20 mil rutas o requerir vecino más cercano real por geometría, se agrega la columna geometry(LineString, 4326) poblada desde la polyline, índice GIST y ST_Intersects/ST_DWithin por $queryRaw — migración aditiva y sin downtime que elimina además el falso positivo del bbox (C4). La tabla comparativa de la v2 (criterios, dependencias y riesgo operativo de ambas opciones) sigue vigente."),
  h2("4.4 Pruebas automatizadas de consultas"),
  p("La suite (vitest sobre base de datos efímera con las mismas migraciones) se especifica en la sección 12 con ocho casos CT-G: rutas de distintas extensiones (menos de 1 km a más de 150 km), posiciones (contenida, parcial, esquina, adyacente, multi-celda con centro fuera), límites geográficos (borde inclusivo, antimeridiano) y estabilidad de paginación. Son criterio de aceptación de la fase D y quedan en CI para toda modificación futura del motor de búsqueda."),
];

const seccion5 = [
  h1("5. Elevación, dificultad y atributos recreativos"),
  h2("5.1 Elevación: null explícito, jamás cero"),
  p("Los campos gainM, lossM, minEle y maxEle son **Float?** y permanecen null cuando no hay información; el cero ficticio queda prohibido en esquema y en UI (la ficha muestra «—» con la etiqueta «sin datos de elevación»). El origen queda trazado en eleFuente: gpx (calculada al importar con las reglas existentes de parseGpxLine), servicio o null. Para las rutas trazadas con el motor — donde hoy el creador fija gainM = 0 (useCreadorTrazas.ts:96) — la resolución se traslada al **servidor en el momento de publicar**: el endpoint de publicación muestrea la geometría protegida contra un servicio de elevación (Open-Meteo Elevation, sin clave, ~100 puntos por ruta) y guarda los cuatro valores con eleFuente = servicio; si el servicio falla, la ruta se publica igual con null y el creador puede «recalcular elevación» desde la ficha (idempotente por RouteVersion). No se resuelve en el teléfono para no duplicar dependencias ni costos por dispositivo."),
  h2("5.2 Dificultad física y técnica, con revisión del creador"),
  p("Dos escalas independientes de 1 a 5 (muy fácil, fácil, media, difícil, muy difícil). La **clasificación automática es orientativa y editable siempre**: dificultadFisica se sugiere desde datos objetivos (distKm, gainM cuando exista, pendiente media) y dificultadTecnica desde superficie y atributos del entorno; el campo dificultadOrigen registra si el valor vigente es auto o del creador. Cuando gainM es null, la sugerencia física se calcula solo con distancia y la UI la presenta como «sugerencia preliminar — revisa y ajusta». Las sugerencias se recalculan al editar geometría o metadatos, pero **nunca sobrescriben** un valor ajustado por el creador."),
  h2("5.3 Atributos recreativos"),
  p("Enumerado cerrado de siete valores — escénica, familiar, recreativa, desafiante, para principiantes, con miradores, con zonas de descanso — que el creador marca (máximo tres) y la ficha presenta como chips informativos con la leyenda «atributos orientativos definidos por el creador». La plataforma no los verifica automáticamente ni los convierte en ranking: **no existe clasificación competitiva por velocidad en rutas** — el rendimiento por tramos sigue viviendo en los segmentos personales. El catálogo ordena por relevancia, fecha y valoración de experiencia (comodidad), nunca por tiempo; el «tiempo estimado orientativo» se muestra como rango (±25 %) y la etiqueta «completada» es binaria, sin tiempo objetivo ni fantasma de ruta."),
];

// __PART2B__
