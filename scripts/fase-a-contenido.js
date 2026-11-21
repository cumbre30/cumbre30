// ---------- Contenido ----------
const seccion1 = [
  h1("1. Alcance de la fase A y confirmaciones"),
  p("Con la arquitectura v2.1 aprobada, la **fase A — modelo de datos y migración** quedó implementada y verificada sobre la v1.14.3 publicada. Se implementó la capa de datos completa del módulo Rutas y Comunidad: once tablas nuevas y el rol de usuario en Prisma con **migraciones formales y guard de entorno**, el store del dispositivo **c30.rutas-v2** con migración por lectura desde c30.trazas, la API /api/routes con sesión y rate limit, y el **outbox ampliado** con tres operaciones de ruta. La fase es puramente aditiva: nada del funcionamiento vigente cambió de conducta."),
  bullet("**Confirmación 1 — motor GPS y motor de trazado intactos:** ningún archivo de useRideEngine, routingService ni del motor de navegación fue modificado; la fase A consume sus tipos existentes (LatLng) y no los ejecuta."),
  bullet("**Confirmación 2 — actividades históricas y trazados intactos:** c30.trazas queda byte a byte idéntico (verificado en la prueba 2 de la suite); los rides, segmentos y el creador vigente no cambian de tabla ni de formato. La migración es solo por lectura."),
  bullet("**Confirmación 3 — sin release ni push:** APP_VERSION sigue 1.14.3 / code 74 y version.json no cambió; todo entra al próximo release cuando el cliente apruebe esta entrega. No se modificó el motor GPS ni se publicó nada."),
  p("Dos defectos menores del propio código nuevo fueron **detectados y corregidos por la suite** durante el desarrollo (transparentes, sección 4): el alta en el store no generaba id y el generador de celdas de viewport muestreaba con paso en grados en lugar de kilómetros. Ninguno llegó al entregable: ambos quedan cubiertos por pruebas que fallarían si regresaran."),
];

const seccion2 = [
  h1("2. Modelo de datos implementado"),
  p("El schema de Prisma incorpora las once entidades del modelo definitivo v2.1 (tablas 3-4 de la arquitectura) y el rol de usuario, con las convenciones vigentes del proyecto (ids cuid, relaciones a User con onDelete: Cascade, sin @@map). Los índices de consulta quedaron creados: **GIN sobre cells**, [status, createdAt] y [ownerId, updatedAt] en Route, más los índices compuestos de unicidad (@@unique) de favoritos, valoraciones, reportes y experiencias."),
  tableTitle("Tabla 1: Entidades implementadas en prisma/schema.prisma"),
  dataTable(
    ["Entidad", "Propósito en la fase A", "Detalle clave"],
    [
      ["Route", "Ruta pública con geometría protegida", "polyline, bbox exacto, cells String[] (GIN), extremos aprox., proteccion Json, elevación Float? null explícito, dificultad física/técnica, attrs, vigencia, status, removedAt"],
      ["RouteVersion", "Historial de versiones publicadas", "geometrySnapshot + metaSnapshot + eleSnapshot; @@unique([routeId, v]) — ancla para rides y experiencias"],
      ["RoutePoi", "Puntos de interés de la ficha", "orden, tipo, nombre, nota; @@index([routeId, orden])"],
      ["RoutePhoto", "Fotos de ficha (tabla lista para fase E)", "url, blobPathname para borrado físico, hash"],
      ["RouteFavorite", "Guardar/favoritos", "@@unique([userId, routeId])"],
      ["RouteComment", "Comentarios con soft-delete", "body, removedAt; @@index([routeId, createdAt])"],
      ["RouteRating", "Valoración editable por usuario", "@@unique([userId, routeId]), valor 1-5"],
      ["RouteReport", "Denuncias tipificadas con peso", "@@unique([routeId, reporterId, motivo]); peso Float + clasificacion (normal | sospechoso) registrados al crear"],
      ["RouteExperience", "Experiencias comunitarias", "ancla routeVersionId, fechaRealizacion, condiciones String[]; @@unique([userId, routeId, fechaRealizacion])"],
      ["ExperiencePhoto", "Fotos de experiencia", "relación Cascade con RouteExperience"],
      ["ModerationLog", "Historial inmutable de moderación", "actor sin FK (sobrevive a cuentas), detalle Json con pesos y umbral"],
      ["User.role", "user | moderador | admin", "default user; autoriza /api/moderation en fase E"],
    ],
    [20, 32, 48]
  ),
  p("Las tablas que la fase E consumirá (fotos, comentarios, reportes, experiencias, moderación) quedan creadas y con sus unicidades para que las migraciones futuras de las fases B-F sean aditivas pequeñas — ninguna estructura crítica se dejará para cuando ya exista contenido publicado, que es el objetivo declarado de esta revisión."),
];

const seccion3 = [
  h1("3. Migraciones formales con guard de entorno (C7/C8)"),
  p("El proyecto no tenía carpeta de migraciones (el esquema se aplicaba con db push manual). La fase A la introduce con dos migraciones generadas por diff offline de Prisma:"),
  bullet("**20261121000000_init_baseline:** estado completo del esquema vigente ANTES del módulo (14 tablas). Sirve para construir bases nuevas (CI, pruebas, futuros entornos) y para el baseline de producción con migrate resolve (sección 9)."),
  bullet("**20261121100000_routes_module:** solo el delta del módulo — 11 CREATE TABLE, la columna User.role y los 18 índices. Verificado sobre base nueva: `prisma migrate deploy` la aplica limpia (evidencia en sección 7)."),
  p("El **guard de entorno** (scripts/migrate-deploy.sh, cableado en vercel.json) ejecuta migrate deploy ÚNICAMENTE con VERCEL_ENV=production; en preview y desarrollo corre solo generate. El build de producción toma además un snapshot pg_dump best-effort antes de migrar (C8; PITR de Neon es la red principal). El chequeo aditivo CT-M3 (scripts/check-migrations-additive.js) rechaza cualquier DROP TABLE/COLUMN en las migraciones y quedó cableado en el workflow de GitHub Actions."),
  tableTitle("Tabla 2: Casos CT-M ejecutados en el entorno local"),
  dataTable(
    ["Caso", "Escenario", "Resultado observado"],
    [
      ["CT-M1a", "build de preview (VERCEL_ENV=preview)", "«preview: NO se ejecutan migraciones» — el preview no puede mutar el esquema"],
      ["CT-M1b", "build de producción (VERCEL_ENV=production)", "«No pending migrations to apply» — el guard ejecuta el deploy y el esquema queda al día"],
      ["CT-M2a", "migración con SQL inválido (DROP de tabla inexistente)", "migrate deploy aborta con exit=1; la base queda OPERATIVA (consulta de usuario exitosa tras el fallo)"],
      ["CT-M2b", "runbook: migrate resolve --rolled-back + retirar la migración", "estado vuelve a «Database schema is up to date!» con las 2 migraciones válidas"],
      ["CT-M3", "chequeo aditivo sobre las migraciones reales", "«OK: ninguna migración contiene DROP TABLE/COLUMN»"],
    ],
    [12, 40, 48]
  ),
];

const seccion4 = [
  h1("4. Store c30.rutas-v2 y migración por lectura"),
  p("El módulo nuevo src/lib/rutasStore.ts crea la clave **c30.rutas-v2** y, en la PRIMERA lectura, copia los trazados existentes de c30.trazas tal cual (id, kind, coords, nombre, distKm, gainM, createdAt, origen — sin transformación ni conversión de segmentos), marcando cada copia con migradaDe. El store original **no se escribe jamás** — el creador y el panel Mis trazados vigentes siguen leyendo c30.trazas sin cambios, y esa clave queda como respaldo de las fases aditivas. La migración no se repite: borrar una ruta migrada en rutas-v2 no la resucita en la siguiente lectura (verificado)."),
  p("La lógica vive en una fábrica con almacenamiento inyectable (rutasStoreFor), lo que permite probarla en node sin navegador; la instancia de navegador usa localStorage con respaldo en memoria para SSR. La suite de la fase A (8 verificaciones) cubre: copia fiel sin transformar, integridad byte a byte de c30.trazas, sin re-migración tras borrar, altas y cambios post-migración, dispositivo sin c30.trazas (vacío sin error) y origen corrupto (vacío sin error)."),
  p("**Defectos detectados y corregidos por la suite (transparencia):** (1) la primera versión de add() no generaba id — el validador del store filtraba la entrada y el conteo de la prueba 3 dio 1 en vez de 2; corregido generando crypto.randomUUID() cuando no viene id, igual que addTraza(); (2) cellsForViewport muestreaba el interior del viewport con paso de 2 grados — los puntos intermedios quedaban fuera y el caso CT-G2 falló; corregido con muestreo g4 (0,35°) y g5 (~0,018° ≈ 2 km) más los cuatro bordes finos. Ambas pruebas ahora son parte del seguro de regresión."),
];

const seccion5 = [
  h1("5. API /api/routes con sesión, validación y derivados"),
  p("Dos endpoints nuevos siguiendo el esqueleto vigente (dynamic force-dynamic, OPTIONS con corsPreflight, corsHeaders, getSessionUser(req) con Bearer para el APK y cookie para la web, guard() de rateLimit): /api/routes (GET propio + POST) y /api/routes/[id] (GET detalle, PATCH dueño, DELETE dueño). El servidor deriva al escribir lo que las consultas del catálogo necesitarán: **bbox exacto, celdas (cellsOfRoute con fallback g4), distancia, polyline codificada y extremos aproximados a 3 decimales** — el cliente envía solo la geometría protegida y el servidor no confía en campos calculados."),
  bullet("**Seguridad probada:** POST/GET sin sesión → 401; edición por no-propietario → 404 (no filtra existencia); guard 20 publicaciones/min y 30 ediciones/min por usuario; atributos validados contra el enumerado cerrado (máx 3), coordenadas acotadas (±90/±180), POIs ≤ 20, descripción ≤ 2000."),
  bullet("**Elevación:** si el payload no trae ele, gainM/lossM/minEle/maxEle/eleFuente quedan **null** — la prueba lo verifica explícitamente contra la base (nunca 0 ficticio, §5.1)."),
  bullet("**Idempotencia por clientId** (patrón de rides): un reintento del outbox tras un corte de red devuelve dedup:true con el mismo id y NO crea versión nueva."),
  bullet("**Versionado:** editar geometría crea RouteVersion v2 (v = máxima + 1) con snapshots de geometría, metadatos y elevación; los rides y experiencias futuros anclan a versionId."),
  bullet("**Borrado:** soft-delete (removedAt + status retirada) — primera convención de soft-delete general del proyecto; la lista y el detalle lo excluyen de inmediato."),
  bullet("**Revisión de vigencia:** PATCH con ultimaRevisionAt:true actualiza la fecha y limpia el estado (§7.4) — probado."),
  p("La suite con base real (11 verificaciones, sección 7) ejecuta los handlers directamente con sesiones Bearer creadas en la base local y verifica en la base misma cada derivado: bbox exacto del payload, polyline que decodifica a los mismos puntos, extremos redondeados, versión v1 con snapshot, POIs guardados y dedup sin duplicar versión."),
];

const seccion6 = [
  h1("6. Outbox ampliado y cliente de rutas"),
  p("El outbox IndexedDB quedó ampliado en sus tres puntos de extensión (tipo en idb.ts, firma de enqueueOp y endpointFor en cloudSync.ts) con las operaciones **route.create → POST /api/routes, route.update → PATCH /api/routes/[id] y route.delete → DELETE /api/routes/[id]** — el id del servidor viaja en el payload. La política de reintentos vigente se conserva intacta: 401 pide re-autenticación, 4xx suelta la op (no envenena la cola), 5xx reintenta con techo de 8 intentos; para rutas se sumó el 404 permanente en update/delete (la ruta ya no existe: la op se confirma). El módulo cliente src/lib/rutasApi.ts (publicarRuta, editarRuta, borrarRuta) resuelve web (cookie) y APK (apiUrl + Bearer con serverToken()) y, ante falta de red con cuenta vinculada, encola la operación y devuelve «encolada» para que la UI (fase B) lo muestre."),
];

const seccion7 = [
  h1("7. Compilación y pruebas verificables (evidencias)"),
  p("Todos los comandos se ejecutaron en el entorno de esta entrega contra la base PostgreSQL local (PG 18 embebido del proyecto, puerto 5433, migraciones aplicadas reales). Salidas íntegras conservadas en los registros /tmp/suite-fase-a.log, /tmp/build-web.log y /tmp/build-apk.log de la sesión; resumen:"),
  tableTitle("Tabla 3: Evidencias de compilación"),
  dataTable(
    ["Verificación", "Comando", "Resultado"],
    [
      ["Tipado", "npx tsc --noEmit", "**0 errores en src** (los únicos errores del monorepo son los scripts debug-* preexistentes, fuera del entregable)"],
      ["Lint de lo tocado", "eslint sobre los 6 archivos nuevos/editados", "0 problemas (exit 0)"],
      ["Migraciones en base real", "prisma migrate deploy (PG local)", "«2 migrations … All migrations have been successfully applied» + índice GIN creado"],
      ["Build web", "npm run build", "exit 0 — «✓ Compiled successfully in 21.4s»"],
      ["Export APK", "node scripts/build-apk.mjs", "exit 0 — «✓ export estático sin /api listo (build-static/)»; build-static/api NO existe; version.json 1.14.3 sin cambios"],
    ],
    [22, 34, 44]
  ),
  tableTitle("Tabla 4: Evidencias de la suite (30 verificaciones, exit 0)"),
  dataTable(
    ["Suite", "Cobertura", "Resultado"],
    [
      ["rutas-store.test.ts", "migración por lectura y ciclo de vida del store", "RUTAS-STORE: **8 verificaciones OK**"],
      ["route-geo.test.ts", "bbox/centro, haversine, geohash g5/g4, multi-celda CT-G2, antimeridiano C3, roundtrip polyline, aprox3", "ROUTE-GEO: **11 verificaciones OK**"],
      ["api-routes.test.ts", "401 sin sesión, 400 validaciones, CRUD completo con DB real, derivados en base, dedup, versionado, soft-delete", "API-ROUTES: **11 verificaciones OK**"],
      ["CT-M1/CT-M2/CT-M3", "guard preview/producción, migración fallida + runbook, chequeo aditivo", "todas OK (tabla 2)"],
    ],
    [24, 48, 28]
  ),
  p("La suite quedó cableada en el workflow de GitHub Actions (build-apk.yml): cada build de release levanta el PG embebido, aplica migraciones y corre las tres suites antes de compilar el APK — una migración o store que rompa las pruebas no genera release."),
];

const seccion8 = [
  h1("8. Criterios de aceptación de la fase A — estado"),
  tableTitle("Tabla 5: Checklist v2.1 §11.1 fase A"),
  dataTable(
    ["Criterio", "Estado", "Evidencia"],
    [
      ["Migración por lectura reproduce los trazados (id, kind, coords) sin convertir segmentos", "**CUMPLIDO**", "Suite rutas-store 8/8; c30.trazas idéntico byte a byte; kind y coords sin transformación"],
      ["Compilación tsc 0 y build SUCCESS", "**CUMPLIDO**", "tsc 0 en src; build web exit 0; eslint 0"],
      ["Smoke test: la API autentica y rechaza escritura sin sesión", "**CUMPLIDO**", "Suite api-routes 11/11 con DB real (401, 400, CRUD, propiedad, dedup)"],
      ["APK export estático compila sin /api", "**CUMPLIDO**", "build-apk.mjs exit 0; build-static sin api; version.json sin cambios"],
      ["prisma migrate deploy en producción con guard VERCEL_ENV, sin pérdida de datos", "**PENDIENTE de producción** (guard y deploy probados en PG local; CT-M1 verificado)", "Runbook en sección 9: baseline resolve + scoping de DATABASE_URL + deploy"],
      ["Ensayo de restauración PITR (CT-M4)", "**PENDIENTE de producción** (requiere consola Neon)", "Procedimiento paso a paso en sección 9.3"],
    ],
    [40, 26, 34]
  ),
  p("Los dos criterios pendientes son operaciones de producción que no pueden ejecutarse desde este entorno (no existe acceso a la consola de Vercel/Neon desde el sandbox); el guard, el deploy real de migraciones y el comportamiento ante fallo quedaron verificados en la base PostgreSQL local, y los procedimientos exactos quedan documentados para que se ejecuten en el primer despliegue a producción."),
];

const seccion9 = [
  h1("9. Runbook de puesta en producción (una sola vez)"),
  h2("9.1 Baseline de la base de producción"),
  p("La base de producción ya existe (creada con db push), por lo que la migración baseline NO debe ejecutarse allí: se marca como ya aplicada. Orden exacto en el primer deploy a producción:"),
  bullet("1. Confirmar en Vercel que DATABASE_URL (Production) apunta a la base de producción y DIRECT_URL está definida para migraciones; Preview/Development con sus propias bases o sin migración (el guard ya lo previene)."),
  bullet("2. Ejecutar una vez, contra producción: `DATABASE_URL=<producción> npx prisma migrate resolve --applied 20261121000000_init_baseline`."),
  bullet("3. Desplegar (push del tag o re-deploy): el guard ejecutará `prisma migrate deploy`, que aplicará SOLO 20261121100000_routes_module (11 tablas nuevas, sin tocar nada existente)."),
  bullet("4. Verificación post-deploy: `prisma migrate status` debe listar ambas migraciones aplicadas; la app vigente debe funcionar sin cambios (rides, login, incidentes)."),
  h2("9.2 Comportamiento ante fallo"),
  p("Si migrate deploy falla en producción: el build falla y Vercel mantiene el deploy anterior en línea (despliegues atómicos) — producción nunca queda a medias. Diagnóstico con prisma migrate status, corrección manual si procede, `prisma migrate resolve --applied|--rolled-back <nombre>` y nuevo deploy. Probado en el entorno local (CT-M2, tabla 2). El respaldo previo es PITR de Neon más el pg_dump best-effort del guard."),
  h2("9.3 Ensayo de restauración PITR (CT-M4)"),
  bullet("1. En la consola de Neon, elegir la base de producción y crear un branch/restore a un punto anterior (p. ej. una hora atrás)."),
  bullet("2. Con la cadena de conexión del branch: `prisma migrate status` (debe mostrar las migraciones aplicadas) y una consulta de conteo por tabla (User, Ride, Route)."),
  bullet("3. Comparar los conteos contra producción; registrar el resultado en la entrada del runbook y eliminar el branch de ensayo. Un solo ensayo basta para cerrar CT-M4."),
];

const seccion10 = [
  h1("10. Próximos pasos"),
  p("Entregado lo anterior, la fase A queda **implementada, compilada y probada** a la espera de la verificación del cliente y del primer despliegue con migraciones (sección 9). Sin push y sin release: todo entrará al próximo release cuando el cliente lo apruebe. Con la aprobación de esta entrega, la **fase B (creación y edición)** se inicia sobre esta base: integración del creador con c30.rutas-v2, atributos recreativos y dificultad con sugerencia editable en el editor, POIs desde la UI y export GPX — con las fases C-F siguiendo el plan v2.1 (tabla 6 §11) y sus criterios de aceptación."),
  p("Los archivos de la implementación quedan en el proyecto para revisión directa: prisma/schema.prisma (modelo), prisma/migrations/ (dos migraciones), scripts/migrate-deploy.sh y scripts/check-migrations-additive.js (operación), src/lib/rutasStore.ts, src/lib/routeGeo.ts y src/lib/rutasApi.ts (cliente), src/app/api/routes/ (API), y la suite tests/ con el workflow actualizado."),
];

const bodyChildren = [
  ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
  ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10,
];
