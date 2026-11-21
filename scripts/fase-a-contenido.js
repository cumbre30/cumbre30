// ---------- Contenido ----------
const seccion1 = [
  h1("1. Alcance de la fase A y confirmaciones"),
  p("Con la arquitectura v2.1 aprobada, la **fase A — modelo de datos y migración** quedó implementada y verificada sobre la v1.14.3 publicada. Se implementó la capa de datos completa del módulo Rutas y Comunidad: once tablas nuevas y el rol de usuario en Prisma con **migraciones formales y guard de entorno**, el store del dispositivo **c30.rutas-v2** con migración por lectura desde c30.trazas, la API /api/routes con sesión y rate limit, y el **outbox ampliado** con tres operaciones de ruta. La fase es puramente aditiva: nada del funcionamiento vigente cambió de conducta."),
  bullet("**Confirmación 1 — motor GPS y motor de trazado intactos:** ningún archivo de useRideEngine, routingService ni del motor de navegación fue modificado; la fase A consume sus tipos existentes (LatLng) y no los ejecuta."),
  bullet("**Confirmación 2 — actividades históricas y trazados intactos:** c30.trazas queda byte a byte idéntico (verificado en la prueba 2 de la suite); los rides, segmentos y el creador vigente no cambian de tabla ni de formato. La migración es solo por lectura."),
  bullet("**Confirmación 3 — sin release ni push:** APP_VERSION sigue 1.14.3 / code 74 y version.json no cambió; todo entra al próximo release cuando el cliente apruebe esta entrega. No se modificó el motor GPS ni se publicó nada."),
  p("Adicionalmente, con el acceso que el cliente entregó para cerrar lo pendiente (llaves de API de Neon y Vercel), las **dos operaciones de producción** que restaban quedaron **ejecutadas y verificadas el 2026-11-21**: la migración real de la base de producción (guard con baselining automático: 26 tablas, ambas migraciones registradas, datos intactos y la app vigente respondiendo con normalidad — sección 9.1) y el **ensayo de restauración PITR** con un branch restaurado una hora atrás (sección 9.3). El criterio de producción ya no depende del primer deploy: el próximo release corre el deploy en estado estable (no-op)."),
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
  bullet("**20261121000000_init_baseline:** estado completo del esquema vigente ANTES del módulo (14 tablas), regenerado idempotente (CREATE TABLE/INDEX IF NOT EXISTS, constraints con manejo de duplicado). Sirve para construir bases nuevas (CI, pruebas, futuros entornos) y para el primer deploy sobre la base histórica de producción (sección 9)."),
  bullet("**20261121100000_routes_module:** solo el delta del módulo — 11 CREATE TABLE, la columna User.role y los 18 índices. Verificado sobre base nueva: `prisma migrate deploy` la aplica limpia (evidencia en sección 7)."),
  p("Durante la verificación se detectó que `migrate deploy` **se niega** sobre una base con tablas y sin historial de migraciones (el estado real de producción, creada históricamente con db push): exige baselining. Por eso el baseline se regeneró **idempotente** y el guard quedó reforzado con **baselining automático CON PRUEBA** en dos modos: si el esquema vivo coincide EXACTAMENTE con el baseline canónico (diff de solo lectura vacío), marca el baseline aplicado (`migrate resolve`) y aplica el módulo; si el esquema vivo es un SUBCONJUNTO (solo le faltan objetos que el baseline crea — el caso real de producción), crea `_prisma_migrations` y el deploy EJECUTA el baseline idempotente (no-op en lo existente, crea lo faltante). Cualquier deriva destructiva o no cubierta aborta sin tocar nada. Ambos modos quedaron probados en simulación exacta y el modo subconjunto se ejecutó en producción real el 2026-11-21 (tabla 2)."),
  p("El **guard de entorno** (scripts/migrate-deploy.sh, cableado en vercel.json) ejecuta migrate deploy ÚNICAMENTE con VERCEL_ENV=production; en preview y desarrollo corre solo generate. El build de producción toma además un snapshot pg_dump best-effort antes de migrar (C8; PITR de Neon es la red principal). El chequeo aditivo CT-M3 (scripts/check-migrations-additive.js) rechaza cualquier DROP TABLE/COLUMN en las migraciones y quedó cableado en el workflow de GitHub Actions."),
  tableTitle("Tabla 2: Casos CT-M ejecutados en el entorno local"),
  dataTable(
    ["Caso", "Escenario", "Resultado observado"],
    [
      ["CT-M1a", "build de preview (VERCEL_ENV=preview)", "«preview: NO se ejecutan migraciones» — el preview no puede mutar el esquema"],
      ["CT-M1b", "build de producción (VERCEL_ENV=production)", "«No pending migrations to apply» — el guard ejecuta el deploy y el esquema queda al día"],
      ["CT-M1c", "producción sobre base histórica (14 tablas + fila de usuario, sin historial — simulación EXACTA del estado real)", "guard exit 0: diff EXACTO contra el baseline → baselining automático → 11 tablas nuevas creadas, dato previo al deploy INTACTO"],
      ["CT-M1d", "producción sobre base que DIFIERE del baseline (tabla extra)", "guard exit 1 con mensaje claro; NADA mutado (Route no creada) — revisión manual requerida por diseño"],
      ["CT-M2a", "migración con SQL inválido (DROP de tabla inexistente)", "migrate deploy aborta con exit=1; la base queda OPERATIVA (consulta de usuario exitosa tras el fallo)"],
      ["CT-M2b", "runbook: migrate resolve --rolled-back + retirar la migración", "estado vuelve a «Database schema is up to date!» con las 2 migraciones válidas"],
      ["CT-M3", "chequeo aditivo sobre las migraciones reales", "«OK: ninguna migración contiene DROP TABLE/COLUMN»"],
      ["CT-M4", "drill PITR real vía API de Neon: branch restaurado 1 h atrás + endpoint propio", "conteos del branch IDÉNTICOS a producción (12 tablas, 10 usuarios, 5 rides, 2 perfiles); datos reales legibles; `migrate status` informativo; branch eliminado tras registrar"],
      ["Producción REAL (2026-11-21)", "guard contra producción Neon (sa-east-1): esquema vivo de 12 tablas sin historial, deriva benigna de 2 defaults en updatedAt", "exit 0 en modo-ejecución: baseline ejecutado (recupera PushSub y Constancia) + módulo crea las 11 tablas; 26 tablas en total; ambas migraciones registradas sin rollback; datos intactos (10/5/0/2); role='user' en los 10 usuarios; app vigente responde (401 correcto en login, /api/version 1.14.3); deploy de estado estable exit 0 (no-op)"],
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
      ["CT-M1a/1b/1c/1d, CT-M2/CT-M3/CT-M4 + migración REAL de producción", "guard preview/producción, baselining automático (subconjunto y exacto), aborto ante divergencia, migración fallida + runbook, chequeo aditivo, drill PITR real, producción real 2026-11-21", "todas OK (tabla 2 y sección 9)"],
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
      ["prisma migrate deploy en producción con guard VERCEL_ENV, sin pérdida de datos", "**CUMPLIDO en producción real (2026-11-21)**", "Guard exit 0 en modo-ejecución: baseline idempotente ejecutado + módulo → 26 tablas, ambas migraciones registradas, datos intactos (10 usuarios/5 rides/0 incidentes/2 perfiles), role='user' backfilled, app vigente respondiendo. Scoping Vercel verificado: DATABASE_URL solo en target production. Deploy de estado estable exit 0 (no-op)"],
      ["Ensayo de restauración PITR (CT-M4)", "**CUMPLIDO (drill real vía API Neon)**", "Branch restaurado 1 h atrás: conteos idénticos a producción (12/10/5/0/2/0), datos reales legibles, eliminado tras registrar. Branch de respaldo pre-migraciones conservado (br-frosty-mud-b60uflu1) hasta confirmación del cliente"],
    ],
    [40, 26, 34]
  ),
  p("De los seis criterios de aceptación, **los seis quedan cumplidos** — los dos últimos, sobre producción real el 2026-11-21 (tabla 5): el guard ejecutó el baselining automático en modo subconjunto sobre el estado histórico exacto (12 tablas, sin historial, deriva benigna de dos defaults) y aplicó ambas migraciones sin tocar datos; el ensayo PITR confirmó restauración puntual con conteos idénticos. Guard, deploy, divergencia y comportamiento ante fallo además quedaron verificados en simulaciones locales (tabla 2)."),
];

const seccion9 = [
  h1("9. Operaciones de producción — ejecutadas y verificadas (2026-11-21)"),
  h2("9.1 Migración real de producción (criterio 5) — EJECUTADA"),
  p("Con la llave de API de Neon entregada por el cliente, el guard se ejecutó directamente contra la base de producción (proyecto long-cake-58507028, branch production, región sa-east-1, conexión directa para migraciones). El estado real encontrado fue el previsto por la simulación, con dos matices documentados: el esquema vivo tenía **12 de las 14 tablas del baseline** (PushSub y Constancia jamás se crearon porque nadie usó esas funciones desde el db push histórico) y una **deriva benigna** de dos defaults de BD extra en CyclistProfile.updatedAt y ProfileConfig.updatedAt (legado del self-repair; sin efecto funcional — Prisma escribe @updatedAt desde el cliente). El guard verificó por diff de solo lectura que la diferencia era exactamente ese subconjunto, clasificó los dos ALTER como benignos sin ejecutarlos, creó `_prisma_migrations` y corrió el deploy: **el baseline idempotente se ejecutó de verdad** (no-op en las 12 tablas existentes, creó las 2 faltantes — producción converge al esquema declarado) y el módulo creó las 11 tablas nuevas."),
  bullet("Resultado: 26 tablas en el esquema public; ambas migraciones registradas en _prisma_migrations (terminadas, sin rollback); `prisma migrate status` = «Database schema is up to date!»; User.role = 'user' en los 10 usuarios existentes (default aplicado); PushSub y Constancia recuperadas vacías como corresponde."),
  bullet("Datos intactos y comprobados antes/después: 10 usuarios, 5 rides, 0 incidentes, 2 perfiles ciclistas, 0 métricas — idénticos."),
  bullet("App vigente tras la migración: POST /api/auth/token responde 401 correcto (el handler consultó User contra la base migrada) y /api/version entrega 1.14.3 code 74 — el release publicado sigue en línea sin cambios (el código de la fase A no se ha desplegado; sus tablas ya esperan)."),
  bullet("Deploy de estado estable verificado: re-ejecutar el guard contra producción sale exit 0 en «migraciones aplicadas» (no-op). El build del próximo release correrá exactamente ese camino."),
  bullet("Seguridad del cambio: antes de migrar se creó el branch Neon **respaldo-pre-migraciones** (br-frosty-mud-b60uflu1, con endpoint propio) que conserva el estado pre-migración íntegro; se conserva hasta la confirmación del cliente (después puede eliminarse desde la consola de Neon; PITR de 6 h cubre además los últimos puntos de restauración)."),
  bullet("Scoping de Vercel verificado vía API: la variable DATABASE_URL del proyecto cumbre30 tiene target **[production] únicamente** — previews y desarrollo no tienen cadena de producción (y el guard además impide que migren). No hubo nada que corregir."),
  h2("9.2 Comportamiento ante fallo"),
  p("Si migrate deploy falla en producción: el build falla y Vercel mantiene el deploy anterior en línea (despliegues atómicos) — producción nunca queda a medias. Diagnóstico con prisma migrate status, corrección manual si procede, `prisma migrate resolve --applied|--rolled-back <nombre>` y nuevo deploy. Probado en el entorno local (CT-M2, tabla 2). El respaldo previo es PITR de Neon más el pg_dump best-effort del guard. Desde esta ejecución, además, el propio guard demostró su comportamiento conservador en producción real: su primera pasada abortó (exit 1) ante la deriva de defaults porque la política todavía la clasificaba como no cubierta — se revisó la deriva (benigna), se amplió la política documentándola y se re-testeo en simulación réplica antes de ejecutar."),
  h2("9.3 Ensayo de restauración PITR (CT-M4) — EJECUTADO"),
  bullet("1. Se creó por API un branch restaurado a 1 hora atrás del branch de producción (drill-pitr-1h) con su propio endpoint."),
  bullet("2. Con la cadena del branch se verificó: conteos idénticos a producción (12 tablas, 10 usuarios, 5 rides, 0 incidentes, 2 perfiles, 0 métricas) y lectura de datos reales (usuarios con sus fechas de creación)."),
  bullet("3. El branch de ensayo se eliminó tras registrar el resultado. CT-M4 queda cerrado con evidencia real: la restauración puntual de Neon reproduce el estado histórico exacto."),
];

const seccion10 = [
  h1("10. Próximos pasos"),
  p("Con las migraciones ya aplicadas en producción y los seis criterios cumplidos, la fase A queda **implementada, compilada, probada y desplegada en su capa de datos** — a la espera solo de la verificación del cliente y del release que publique el código (el deploy del build correrá el guard en estado estable, no-op). Sin push y sin release: el código entrará al próximo release cuando el cliente lo apruebe. Con esa aprobación, la **fase B (creación y edición)** se inicia sobre esta base: integración del creador con c30.rutas-v2, atributos recreativos y dificultad con sugerencia editable en el editor, POIs desde la UI y export GPX — con las fases C-F siguiendo el plan v2.1 (tabla 6 §11) y sus criterios de aceptación."),
  p("Pendientes de operación del cliente: (1) rotar la llave de API de Neon y el token de Vercel entregados para esta sesión (mejor práctica tras cualquier uso; la cadena del rol neondb_owner también circuló por este entorno), y (2) tras confirmar esta entrega, eliminar el branch de respaldo respaldo-pre-migraciones en la consola de Neon. Los archivos de la implementación quedan en el proyecto para revisión directa: prisma/schema.prisma (modelo), prisma/migrations/ (dos migraciones), scripts/migrate-deploy.sh y scripts/check-migrations-additive.js (operación), src/lib/rutasStore.ts, src/lib/routeGeo.ts y src/lib/rutasApi.ts (cliente), src/app/api/routes/ (API), y la suite tests/ con el workflow actualizado."),
];

const bodyChildren = [
  ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
  ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10,
];
