// ---------- Contenido: secciones 6 a 14 ----------
const seccion6 = [
  h1("6. Experiencias comunitarias"),
  p("La experiencia comunitaria (RouteExperience, tabla 4) asocia vivencias reales a una ruta sin tocar jamás su geometría oficial: fotografías (hasta 3), comentario, observaciones (≤ 500 caracteres), condiciones del recorrido como etiquetas tipificadas (camino en buen estado, tramo cerrado, barro, mucho tráfico, sombra, agua disponible — hasta 3) y **fecha de realización** (la del ride asociado o la que el usuario elija). Cada experiencia ancla a una RouteVersion concreta: si la ruta se edita después, la experiencia sigue describiendo con fidelidad la versión que se recorrió."),
  p("Reglas de separación y moderación: las experiencias viven en tablas propias, se muestran en la ficha bajo una sección «Experiencias» con etiqueta de contenido comunitario (distinta de los datos oficiales), y ninguna operación de experiencia puede escribir en Route. Un usuario registra una experiencia por ruta y día (unicidad por [userId, routeId, fecha]); puede borrar la suya (soft-delete) y el moderador puede ocultarla. El flujo natural nace en la fase F: al terminar un ride ligado a una ruta, la app ofrece «agregar experiencia», rellenando rideId y fecha automáticamente; también se puede escribir desde la ficha sin ride. **La pista GPS del ride nunca acompaña a la experiencia** — solo salen del dispositivo los textos, fotos y metadatos que el usuario ve en la confirmación."),
];

const seccion7 = [
  h1("7. Moderación, apelaciones y vigencia (ajustada en v2.1)"),
  h2("7.1 Reportes tipificados y controles de abuso"),
  p("Los motivos quedan tipificados como enumerado: **cierre, peligro, error geográfico, spam y contenido inapropiado**. Los controles base se mantienen de la v2: deduplicación por [routeId, reporterId, motivo] (única denuncia por usuario y motivo, resuelta por @@unique), rate limit con el guard() existente (10 reportes/día por usuario, rateLimit.ts:50) y la regla de que el autor no puede denunciar su propia ruta (patrón ya vigente en incidents, api/incidents/route.ts:178-180)."),
  h2("7.2 Umbral ponderado de confianza y defensa contra denuncias coordinadas (C9)"),
  p("El mecanismo v2 ocultaba automáticamente con dos reportantes; dos cuentas coordinadas nuevas podían abusar. v2.1 sustituye el conteo por un **umbral ponderado de confianza**: cada reporte se registra con el peso del reportante en RouteReport (peso, clasificacion), calculado en el servidor al crearlo — veterano 1,5 (cuenta con ≥ 90 días y ≥ 3 contribuciones confirmadas o ≥ 20 rides), usuario regular 1,0, cuenta nueva o de poca actividad 0,5 (menos de 30 días o sin contribuciones confirmadas). El peso **decae 0,25 por cada denuncia descartada** de ese reportante (mínimo 0,25): el denunciante reincidente pierde capacidad de ocultar."),
  p("Reglas de ocultamiento automático — exclusivas de los motivos **cierre y peligro** — quedan así: la suma de pesos de reportantes distintos debe ser ≥ 2,0 **y** al menos 2 reportantes distintos; un **lote sospechoso** (tres o más denuncias del mismo motivo en menos de una hora desde cuentas creadas la misma semana) marca clasificacion = sospechoso y desactiva el ocultamiento automático para ese lote: pasa siempre a cola de moderación. Todo ocultamiento automático es **reversible** por el moderador, **notifica al autor** con el motivo y el enlace de apelación, y queda registrado en ModerationLog con los pesos y el umbral aplicado (detalle de la decisión). El resto de motivos (error geográfico, spam, contenido inapropiado) no ocultan automáticamente en ningún caso: van siempre a cola."),
  h2("7.3 Flujo de revisión, apelaciones y trazabilidad"),
  p("El estado del reporte transita abierta → bajo revisión → confirmada | descartada. Ni el reporte ni el ocultamiento modifican jamás la geometría ni los datos oficiales de la ruta: solo afectan visibilidad y estado informativo. Cada acción queda en ModerationLog (actor, acción, objetivo, motivo, detalle con pesos y umbral, nota, fecha) como historial inmutable; el autor puede presentar **una apelación activa por ruta** (nota ≤ 500 caracteres, estado apelada) y el moderador resuelve restaurar o confirmar la medida — ambos desenlaces quedan trazados. Si se confirma la retirada, la ruta pasa a status retirada con posibilidad de edición y republicación posterior al corregir el motivo; apelaciones rechazadas repetidas activan revisión de cuenta por el propietario del producto. La moderación usa el rol User.role (moderador) autorizando /api/moderation, con la transición inicial protegida por la clave admin timing-safe existente (adminKey.ts:10, hash SHA-256 y timingSafeEqual)."),
  h2("7.4 Control de vigencia"),
  p("Cada ruta pública lleva **ultimaRevisionAt** y un estado informativo derivado que la ficha muestra como banner: vigente (revisada hace menos de 6 meses), avisos activos (reportes de cierre o peligro confirmados o abiertos, con su número), sin revisar (más de 6 meses desde la última revisión o publicación) y retirada. La revisión es una acción del creador («revisé esta ruta hoy», que actualiza ultimaRevisionAt y limpia avisos confirmados resueltos) o del moderador. El patrón reutiliza la vigencia de avisos operativos (desde/hasta en public/avisos.json y avisoVigente en avisos.ts:53) y la caducidad por antigüedad de incidents (30 días), pero **los reportes nunca cambian la geometría**: un cierre confirmado queda como aviso informativo con fecha hasta que el creador o el moderador lo resuelvan."),
];

const seccion8 = [
  h1("8. Pipeline de fotografías"),
  p("Cumbre30 no sube imágenes hoy (la credencial Parquemet se procesa y queda en localStorage), pero el re-encode en canvas ya existe como precedente directo: processQrImage en Wallet.tsx:55-83 re-encodea a máx 1024 px con JPEG 0,92. El pipeline de fotos del módulo lo generaliza con seguridad completa:"),
  bullet("**Cliente (antes de salir del dispositivo):** acepta JPEG/PNG/WebP verificando magic bytes; rechaza > 8 MB; re-encodea en canvas al lado largo máximo de 1600 px con JPEG calidad 0,85. El re-encode **elimina EXIF por construcción** (coordenadas, fecha y dispositivo no viajan), y el objetivo de peso queda ≤ 1,5 MB por foto."),
  bullet("**Transporte y storage:** POST multipart a /api/upload con sesión; el servidor almacena en **Vercel Blob** (despliegue ya Vercel + Neon, región gru1) mediante token server-side; URL pública no adivinable y blobPathname registrado para borrado físico. Alternativa documentada: cualquier storage S3-compatible sin cambiar el diseño."),
  bullet("**Servidor (validación de entrada):** re-verifica magic bytes y tamaño, genera nombre aleatorio (sin nombre de archivo del usuario), limita 6 fotos por ruta y 3 por experiencia, y deduplica por hash opcional."),
  bullet("**Ciclo de vida y borrado:** al eliminar una foto o el contenido que la contiene (soft-delete y purga), se ejecuta del() del blob correspondiente; job de purga para huérfanos semanal. La eliminación por moderador queda trazada en ModerationLog."),
  bullet("**Moderación:** las fotos son reportables (motivo contenido inapropiado), con ocultamiento automático por umbral ponderado (sección 7.2) y eliminación directa por moderador; el uploader queda identificado por sesión para abuso repetido."),
];

const seccion9 = [
  h1("9. Migraciones y despliegue (ampliada en v2.1)"),
  p("El proyecto actual no mantiene carpeta de migraciones: el esquema se aplica con db push manual (scripts package.json:10-13) y vercel.json:3 ejecuta solo prisma generate. El módulo introduce **prisma migrate** formal (carpeta prisma/migrations versionada en git) y la revisión v2.1 define el entorno de ejecución, el respaldo y el comportamiento ante fallos — los cambios C7 y C8 del registro."),
  h2("9.1 Guard de entorno: migrar solo en producción"),
  bullet("El comando de build de producción ejecuta **prisma generate && prisma migrate deploy && next build únicamente cuando VERCEL_ENV=production**; en preview y desarrollo corre solo prisma generate. Así, un despliegue de preview nunca muta el esquema — ni siquiera si su DATABASE_URL apuntara a producción por error de configuración."),
  bullet("**DATABASE_URL se delimita por entorno** en Vercel (Production / Preview / Development) con DIRECT_URL para migraciones; opción recomendada de endurecimiento: **Neon branching**, que da a cada preview una base efímera derivada de producción — cero riesgo y cero costo de datos."),
  bullet("Se prohíbe db push --accept-data-loss fuera del desarrollo local, y **las migraciones de las fases aditivas no contienen DROP COLUMN ni DROP TABLE** (chequeo en CI sobre los archivos de migración, prueba CT-M3); la limpieza de columnas deprecadas se hace en un release posterior, nunca en el que introduce el cambio."),
  h2("9.2 Respaldo y recuperación"),
  p("Tres capas: **PITR de Neon** (restauración a un punto en el tiempo del historial continuo) como red principal; **pg_dump** de respaldo manual antes de cualquier migración estructural mayor, guardado como snapshot verificable; y la **atomicidad de despliegues de Vercel** — el build fallido nunca reemplaza al deploy vigente, así que producción no queda a medias ni con esquema parcial. El procedimiento de restauración se ensaya una vez (prueba CT-M4) antes del primer despliegue con migraciones."),
  h2("9.3 Comportamiento ante migración fallida (runbook)"),
  bullet("Detección: prisma migrate deploy se detiene en la primera migración fallida y el build falla → el deploy anterior sigue sirviendo producción (CT-M2)."),
  bullet("Diagnóstico: prisma migrate status e inspección del error; decidir si la corrección es del SQL de la migración o requiere intervención puntual en la base."),
  bullet("Resolución: corregir y aplicar manualmente lo necesario, marcar el estado con **prisma migrate resolve --applied** (o --rolled-back si se retiró) y volver a disparar el deploy. Toda intervención queda documentada en la entrada del runbook con fecha y causa."),
  bullet("Prevención: cada migración nueva se prueba en la base efímera de la suite (misma versión de migraciones) y contra una copia de staging antes del deploy de producción."),
];

const seccion10 = [
  h1("10. Seguridad y privacidad consolidada"),
  tableTitle("Tabla 5: Matriz de datos — qué sale del dispositivo y qué nunca sale"),
  dataTable(
    ["Dato", "Sale del dispositivo", "Condición"],
    [
      ["Pista GPS cruda de actividades", "**Nunca** (política vigente)", "Los rides siguen subiendo solo agregados con dedupe por clientId"],
      ["Geometría original de una ruta propia", "**Nunca**", "Solo la geometría protegida al publicar (sección 3, CT-P1/P3/P4)"],
      ["Extremos exactos (puerta de casa)", "**Nunca**", "Publicados como zona aproximada redondeada a ~110 m"],
      ["Geometría protegida + metadatos", "Solo al publicar", "Vista previa con checklist de revisión obligatoria"],
      ["Fotografías", "Solo tras re-encode local", "Sin EXIF, ≤ 1,5 MB, formatos validados en cliente y servidor"],
      ["Experiencias (texto + fotos + fecha)", "Solo con confirmación explícita", "Nunca incluyen pista GPS; anclan a RouteVersion"],
      ["Export GPX de ruta pública", "Geometría protegida", "El original solo lo exporta su propietario (CT-P4)"],
    ],
    [30, 26, 44]
  ),
  p("Los controles transversales se heredan y completan: sesiones Bearer/cookie con CORS de Capacitor (apiCors.ts) y backendOrigin() horneado a cumbregeo.cl (backend.ts:51, fijado en scripts/export-web.sh:21); rate limit en todos los endpoints de escritura del módulo (guard() ya probado en auth); autorización por propiedad en cada PATCH/DELETE y por rol en moderación; atribución OSM/ODbL y nota de carácter orientativo sin valor de autorización legal ya presentes en la app; y versionado RouteVersion como base de auditoría de cualquier cambio publicado. El APK sin /api consume por URL absoluta y encola en el outbox ampliado (rutas, favoritos, comentarios, experiencias), con servidor-autoridad y last-write-wins por updatedAt."),
];

const seccion11 = [
  h1("11. Plan A-F ajustado con criterios de aceptación"),
  p("El plan conserva las seis fases aprobadas y las ajusta con las correcciones v2 y v2.1. Cada fase entrega código, compilación verificada (tsc y build web), pruebas funcionales in-vivo, evidencia visual, problemas detectados y documentación técnica; los casos de prueba de la sección 12 se integran como criterios de aceptación de las fases A, D y E."),
  tableTitle("Tabla 6: Alcance ajustado por fase"),
  dataTable(
    ["Fase", "Alcance v2.1 (ajustes en negrita)"],
    [
      ["A. Modelo de datos y migración", "Tablas del modelo definitivo (tablas 3-4); User.role; store c30.rutas-v2; migración por lectura desde c30.trazas; API /api/routes básica; outbox ampliado. **+ prisma migrate con guard de entorno (solo VERCEL_ENV=production), PITR ensayado y runbook (sección 9, CT-M1 a CT-M4)**"],
      ["B. Creación y edición", "Multi-waypoint, POIs, metadatos, borrador; edición post-guardado; export GPX; crear desde actividad. **+ atributos recreativos, dificultad física/técnica con sugerencia editable, elevación null explícita en el editor**"],
      ["C. Biblioteca y fichas", "Cuatro secciones; Mis rutas; ficha completa con acciones. **+ componente de perfil altimétrico nuevo (recharts, ya instalado y sin uso), chips recreativos, banner de vigencia, tiempo estimado en rango**"],
      ["D. Publicación y descubrimiento", "Publicación explícita; RouteVersion; catálogo con búsqueda y filtros; enlaces públicos. **+ protección por niveles con vista previa obligatoria; cells multi-celda con índice GIN y predicado bbox corregido (CT-G1 a CT-G8 en CI); resolución de elevación al publicar (CT-P1 a CT-P6)**"],
      ["E. Comunidad y moderación", "Favoritos, comentarios, valoraciones, reportes; cola con rol; fotos. **+ motivos tipificados con umbral ponderado y lote sospechoso (CT-Mo1 a CT-Mo5), ModerationLog con detalle de pesos, apelaciones, pipeline de fotografías (EXIF/borrado físico), experiencias comunitarias**"],
      ["F. Integración GPS y navegación", "Preset de línea guardada; proyector con estado; eventos persistidos; routeRef + cumplimiento; Mis recorridos. **+ alta de experiencia al terminar ride ligado (con rideId y fecha)**"],
    ],
    [24, 76]
  ),
  h2("11.1 Criterios de aceptación por fase"),
  bullet("**Fase A:** prisma migrate deploy aplicado en producción con guard VERCEL_ENV activo y sin pérdida de datos; migración por lectura reproduce los trazados existentes (id, kind, coords) sin convertir segmentos; compilación tsc 0 y build SUCCESS; smoke test del servidor con la API /api/routes autenticando y rechazando escritura sin sesión; APK export estático compila sin /api; ensayo de restauración PITR (CT-M4) y verificación de que el build de preview no migra (CT-M1)."),
  bullet("**Fase B:** crear ruta con waypoints, atributos y dificultad ajustable desde cero en APK y web; edición post-guardado persiste y se refleja en el mapa; export GPX abre en terceros; elevación queda null visible como «sin datos» cuando no hay fuente — jamás 0."),
  bullet("**Fase C:** las cuatro secciones navegables con identidad verde en tema claro y oscuro; ficha con perfil altimétrico renderizando solo cuando hay elevación; banner de vigencia correcto en sus tres estados básicos; regresión del creador y del panel Mis trazados sin cambios de conducta."),
  bullet("**Fase D:** la publicación nunca envía la geometría original (verificado en payload y en base de datos, CT-P4); extremos publicados en zona aproximada con niveles de protección correctos (CT-P1 a CT-P3, CT-P6); vista previa muestra recortes y exige confirmación; suite CT-G verde en CI con celdas multi-celda, bordes inclusivos y antimeridiano (CT-G2, CT-G4, CT-G6); elevación resuelta al publicar con eleFuente = servicio."),
  bullet("**Fase E:** denuncia única por usuario y motivo (violación de @@unique rechazada); ocultamiento automático solo con umbral ponderado ≥ 2,0 y ≥ 2 reportantes en motivos cierre/peligro (CT-Mo2), y nunca con lotes sospechosos (CT-Mo3); ModerationLog registra cada acción con pesos; apelación restaura o retira con historial (CT-Mo5); foto publicada sin EXIF (verificado extrayendo metadatos del archivo almacenado) y borrada físicamente del blob al eliminar el contenido."),
  bullet("**Fase F:** ride ligado a ruta registra progreso, desvío máximo y reincorporaciones sin tocar useRideEngine; pausas y mala señal no generan desvíos falsos (prueba con simulador); «completada» correcta por geocerca de meta con histéresis; Mis recorridos agrupa por ruta con su versión; experiencia post-ride ancla a la versión recorrida."),
];

const seccion12 = [
  h1("12. Casos de prueba de la revisión (CT-G, CT-P, CT-M, CT-Mo)"),
  p("La suite queda especificada aquí y se implementa dentro de las fases indicadas (no se implementa en esta revisión). Todos los casos se ejecutan con vitest contra base efímera con las mismas migraciones; los de protección, además, con fixtures GPX reales reproducidos del encargo (domicilios, calles sin salida, zonas sin grafo)."),
  tableTitle("Tabla 7: Consultas geográficas (fase D)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-G1", "Ruta corta (< 1 km) contenida en el viewport", "Aparece en resultados"],
      ["CT-G2", "Ruta larga (~40 km) multi-celda cuyo centro cae fuera del viewport pero que lo atraviesa", "Aparece por solapamiento de cells (hasSome) — requisito del encargo"],
      ["CT-G3", "Ruta adyacente al viewport sin intersección real", "No aparece"],
      ["CT-G4", "Ruta que toca el viewport solo por un vértice del bbox (borde)", "Aparece — predicado inclusivo en bordes"],
      ["CT-G5", "Ruta en U cuyo bbox cruza el viewport pero cuya geometría no", "Aparece — falso positivo aceptado del bbox (C4), documentado en la respuesta de la API"],
      ["CT-G6", "Viewport que cruza el antimeridiano (o > e) con ruta en la zona", "Aparece — ramificación longitudinal (minLon <= este OR minLon >= oeste)"],
      ["CT-G7", "Inserción de una ruta nueva entre dos páginas ya paginadas", "Sin duplicados ni saltos con paginación por cursor"],
      ["CT-G8", "10 mil rutas sintéticas, consulta de viewport con take 20", "p95 < 150 ms con índices cells (GIN), bbox y status"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 8: Protección geométrica (fase D)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-P1", "GPX que inicia a 12 m de un domicilio urbano", "Extremo recortado ≥ 150 m; polilínea conexa única; el original no sale del dispositivo"],
      ["CT-P2", "Inicio en calle sin salida, a 8 m de un nodo del grafo", "Snap de deriva ≤ 30 m; sin vértices nuevos ni desvíos; recorte posterior aplicado"],
      ["CT-P3", "Inicio a 500 m de la vía más cercana (zona sin conexión al grafo)", "sinSnap = true; solo recorte; zona de imprecisión 150 m; ningún tramo de conexión inventado"],
      ["CT-P4", "GPX exportado de una ruta pública", "Trackpoints idénticos a la geometría protegida y distintos del original en los extremos; sin metadatos privados"],
      ["CT-P5", "Ruta trazada con el motor (ya en el grafo)", "Cuerpo interior sin cambios tras la protección (diff de vértices interiores = 0)"],
      ["CT-P6", "Inicio a 600 m de la primera vía (tope de recorte excedido)", "Vista previa advierte; la publicación exige confirmación explícita del tope excedido"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 9: Migraciones y despliegue (fase A)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-M1", "Deploy de preview con VERCEL_ENV=preview", "No ejecuta prisma migrate deploy (verificable en logs de build)"],
      ["CT-M2", "Migración fallida forzada en entorno de ensayo", "Build falla; el deploy anterior sigue en línea; runbook resuelve con migrate resolve"],
      ["CT-M3", "Migración con DROP COLUMN/TABLE durante las fases aditivas", "Chequeo en CI la rechaza"],
      ["CT-M4", "Ensayo de restauración PITR de Neon sobre base efímera", "Esquema y datos reproducidos al punto elegido"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 10: Moderación (fase E)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-Mo1", "Dos cuentas nuevas (< 30 días, peso 0,5) denuncian cierre", "Suma 1,0 < 2,0 → sin ocultamiento automático; pasa a cola"],
      ["CT-Mo2", "Veterano (1,5) y regular (1,0) denuncian peligro", "Suma 2,5 ≥ 2,0 con 2 reportantes → ocultamiento reversible + notificación al autor con apelación"],
      ["CT-Mo3", "Tres denuncias del mismo motivo en < 1 h desde cuentas creadas la misma semana", "clasificacion = sospechoso → cola de moderación, sin auto-hide"],
      ["CT-Mo4", "Denunciante con tres denuncias descartadas (peso decae a 0,25)", "Su denuncia sola ya no alcanza el umbral ponderado"],
      ["CT-Mo5", "Apelación resuelta a favor del autor", "Ruta restaurada; ModerationLog con actor, pesos, umbral y decisión"],
    ],
    [10, 45, 45]
  ),
];

const seccion13 = [
  h1("13. Dependencias y riesgos"),
  tableTitle("Tabla 11: Dependencias externas e internas"),
  dataTable(
    ["Dependencia", "Uso", "Estado"],
    [
      ["Vercel Blob", "Fotos de rutas y experiencias (fase E)", "Nueva; activar storage y token BLOB en Vercel"],
      ["Open-Meteo Elevation", "Elevación al publicar (fase D)", "Nueva; API pública sin clave, con degradación a null y reintento"],
      ["recharts (instalada)", "Perfil altimétrico de la ficha (fase C)", "Ya en package.json sin uso; no añade dependencias"],
      ["prisma migrate", "Esquema versionado con guard de entorno (fase A)", "Nueva; sustituye el db push manual"],
      ["geohash (implementación propia ≤ 60 líneas)", "Celdas de búsqueda y fallback geohash-4 (fase D)", "Nueva, sin paquete externo"],
      ["Neon branching (opcional)", "Base efímera por deploy de preview (fase A)", "Opcional; sin él, el guard VERCEL_ENV ya previene migraciones desde preview"],
    ],
    [30, 40, 30]
  ),
  tableTitle("Tabla 12: Riesgos nuevos o ajustados"),
  dataTable(
    ["Riesgo", "Impacto", "Mitigación"],
    [
      ["Truncado insuficiente para privacidad de extremos", "Exposición parcial de domicilios en rutas importadas", "Vista previa obligatoria con comparación, tope de recorte con aviso (CT-P6) y niveles de protección con casos de prueba (CT-P1 a CT-P3)"],
      ["Denuncias coordinadas", "Ocultamientos injustos de rutas legítimas", "Umbral ponderado ≥ 2,0 con pesos por confianza, lote sospechoso por velocidad, ocultamiento reversible y apelable (CT-Mo1 a CT-Mo5)"],
      ["Servicio de elevación caído o lento", "Publicación degradada", "Publicación no bloqueante con null + recalcular desde la ficha; timeout y caché por RouteVersion"],
      ["Fotos indebidas (UGC)", "Cumplimiento Play Store / privacidad", "Pipeline con EXIF eliminado, validación doble, moderación ponderada y borrado físico"],
      ["Migración fallida en producción", "Esquema o deploy inconsistente", "Deploy atómico de Vercel + runbook con migrate resolve + PITR ensayado (CT-M2, CT-M4)"],
      ["Crecimiento del catálogo", "Consultas lentas", "Paginación por cursor + celdas con GIN; PostGIS como ruta documentada si se supera ~20 mil rutas (CT-G8 valida el rendimiento)"],
      ["Doble geometría (privada/pública) confunde al creador", "Publicaciones con datos no deseados", "Vista previa comparativa; etiquetas «tu copia» vs «copia pública» en Mis rutas"],
      ["Regresión del funcionamiento vigente", "Rides o trazados dañados", "Fases aditivas con release separado; c30.trazas intocado como respaldo; criterios de aceptación con regresión por fase"],
    ],
    [28, 26, 46]
  ),
];

const seccion14 = [
  h1("14. Confirmaciones"),
  p("Las cuatro confirmaciones que solicita la revisión, con su base verificable:"),
  bullet("**No se requiere modificar el motor GPS ni el motor de trazado.** La revisión v2.1 afecta únicamente modelo de datos, endpoints nuevos, protección aplicada al publicar y consultas del catálogo: el motor GPS (useRideEngine y su cadena) y el motor de trazado (routingService/computeRoute) son consumidores de las rutas publicadas, no objetos de cambio. La fase F solo lee su estado existente (routeRef, eventos) sin tocarlos."),
  bullet("**Las actividades históricas y los trazados actuales permanecen intactos.** El store vigente c30.trazas no se toca: la migración de la fase A es por lectura y crea c30.rutas-v2 sin convertir ni renombrar nada; los segmentos personales y los rides existentes no cambian de tabla ni de formato; las fases son aditivas y cada release es verificable de forma independiente."),
  bullet("**La geometría original permanece exclusivamente en el dispositivo.** El servidor recibe solo la geometría protegida al publicar (verificado en payload y en base de datos con CT-P1, CT-P3 y CT-P4); el original no existe en producción y la exportación GPX de una ruta pública regenera la geometría protegida, nunca la original."),
  bullet("**La geometría pública y su exportación GPX contienen únicamente información protegida.** Los extremos se publican como zona aproximada redondeada (~110 m), sin pin exacto ni metadatos privados; la prueba CT-P4 compara los trackpoints del GPX exportado contra la geometría protegida (idénticos) y contra el original (distintos en los extremos)."),
  p("Con la aprobación de esta revisión v2.1, la **fase A** se inicia sobre la v1.14.3 publicada con compilación y pruebas funcionales verificables antes de continuar a la fase B. Los cambios estructurales de consultas, protección, migraciones y moderación quedan especificados y con casos de prueba definidos antes de que exista contenido publicado — que es exactamente el objetivo declarado de esta revisión."),
];

// ---------- Ensamblaje ----------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };
function pageFooter(marker) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: marker ? "\u200B" : "", size: 18, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY }),
      ],
    })],
  });
}
const bodyHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Cumbre30 · Rutas y Comunidad Ciclista — Arquitectura corregida v2.1", size: 18, color: GRAY, font: FONT })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: { ascii: "Times New Roman" }, size: 24, color: BODY }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
      heading2: { run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 240, after: 120, line: 312 } } },
    },
  },
  sections: [
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Arquitectura Corregida",
        subtitle: "Rutas y Comunidad Ciclista · Revisión técnica final sobre la arquitectura v2 (v2.1)",
        englishLabel: "CUMBRE30",
        metaLines: [
          "Producto: Cumbre30 · web cumbregeo.cl + APK Android (Vercel + Neon)",
          "Base auditada: v1.14.3 · code 74 — revisión final sobre la arquitectura v2 del 21-11-2026",
          "Documento: Fase 0 · v2.1 — cambios C1-C9, casos de prueba y confirmaciones",
          "Estado: pendiente de aprobación — al aprobarse inicia la fase A",
        ],
        footerLeft: "Cumbre30",
        footerRight: "Uso interno del proyecto",
        palette: COVER,
      }),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter(true) },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, color: PRIMARY, font: FONT })],
        }),
        new TableOfContents("Tabla de contenidos", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Nota: este índice se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos» para refrescar la numeración de páginas.",
            italics: true, size: 18, color: "888888", font: FONT,
          })],
        }),
      ],
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter(false) },
      children: [
        ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
        ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10,
        ...seccion11, ...seccion12, ...seccion13, ...seccion14,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/Arquitectura_corregida_v2_1_Cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("OK", out, buf.length, "bytes");
});