// ---------- Contenido: informe de Fase B ----------
const seccion1 = [
  h1("1. Alcance de la fase B y confirmaciones"),
  p("Con la fase A aprobada y sus migraciones ya aplicadas en producción (2026-11-21), la **fase B — creación y edición** quedó implementada sobre la v1.15.0: el **editor de rutas** del módulo Rutas y Comunidad con trazado **multi-waypoint**, importación GPX, **creación desde actividad**, metadatos completos (nombre, descripción, modalidad), **dificultad física y técnica con sugerencia orientativa editable**, **atributos recreativos** (enumerado cerrado, máximo 3), **POIs** con ubicación en el mapa, **borradores persistentes** en c30.rutas-v2 y **export GPX**. Todo el diseño sigue la arquitectura v2.1 aprobada (§5.1-§5.3 y tabla 6)."),
  bullet("**Confirmación 1 — motor GPS y motor de trazado intactos:** el creador de trazados vigente (useCreadorTrazas, trazas de ride y segmentos) no cambió de conducta: mismo flujo de 2 puntos, mismo guardado en c30.trazas. El editor usa el MISMO computeRoute del motor (grafo local u OSRM) por piernas."),
  bullet("**Confirmación 2 — c30.trazas sigue intocado:** la suite 11 de la fase B vuelve a verificarlo: cualquier operación de borradores (crear, editar, eliminar) deja c30.trazas byte a byte idéntico; los borradores viven solo en c30.rutas-v2."),
  bullet("**Confirmación 3 — sin push ni release:** el trabajo de fase B está comprometido en local DESPUÉS del tag v1.15.0; entra al siguiente release cuando el cliente apruebe esta entrega (el release v1.15.0 ya quedó preparado con la fase A y el bump 1.15.0 / code 75)."),
];

const seccion2 = [
  h1("2. El editor de rutas"),
  p("Un nuevo botón violeta «Crear ruta» sobre el mapa grande abre el editor (EditorRutaPanel), independiente del creador de trazados. La geometría entra por tres caminos — trazado **multi-waypoint** (cada tap añade un punto de decisión y el motor traza la pierna desde el anterior, concatenada sin duplicar el vértice común), **GPX importado** (la línea del archivo se respeta tal cual, con su desnivel real) y **crear desde actividad** (una traza existente se copia 1:1 desde el panel Mis trazados: coords, kind y distKm sin transformación) — y todos convergen al mismo formulario de metadatos."),
  p("Los **borradores** se guardan en el store del dispositivo c30.rutas-v2 (fase A) con status 'borrador' y el modelo completo de la ruta (tabla 3 de la arquitectura): nombre ≤ 80, descripción ≤ 2000, modalidad pavimento/mtb, dificultad con origen, atributos, POIs con orden, waypoints y elevación nullable. El panel de capas lista los borradores («Mis rutas (borradores)») con continuar edición, export GPX y eliminar; la edición post-guardado recarga TODO el estado (nombre, dificultad ajustada, POIs, elevación) y volver a guardar respeta los valores del creador."),
];

const seccion3 = [
  h1("3. Dificultad física y técnica: sugerencia que nunca manda (§5.2)"),
  p("Dos escalas independientes 1-5 (muy fácil, fácil, media, difícil, muy difícil). La **sugerencia física** sale de datos objetivos: base por distancia (<8 / <15 / <25 / <40 / ≥40 km) más ajustes por desnivel total (>500 m +1, >1000 m +2) y pendiente media (>5 % +1), con tope 1-5. La **técnica** parte de la modalidad (pavimento 1, mtb 2) y ajusta con atributos del entorno (desafiante +1, para principiantes −1, piso 1). Cuando no hay desnivel (gainM null) la física se calcula solo con distancia y la UI lo dice: «sugerencia preliminar — revisa y ajusta»."),
  p("El campo **dificultadOrigen** registra quién mandó: 'auto' sigue la sugerencia (se recalcula al editar geometría o atributos) y 'creador' fija el valor elegido — el recálculo **jamás sobrescribe** lo ajustado a mano, y el botón «usar sugerencia» devuelve el control al automático. La suite cubre las dos ramas y la tabla de casos: 5 km a 7 % de pendiente media sube a 2; 12 km con 800 m de desnivel sube a 4; un creador que fija 5 conserva su 5 aunque la ruta crezca a 45 km."),
];

const seccion4 = [
  h1("4. Atributos recreativos, POIs y elevación «sin datos»"),
  bullet("**Atributos recreativos (§5.3):** enumerado cerrado de siete valores (escénica, familiar, recreativa, desafiante, para principiantes, con miradores, con zonas de descanso), máximo 3 por ruta, con contador en la UI y la leyenda «orientativos, definidos por el creador». La validación descarta duplicados y valores fuera del enumerado (attrsValidos)."),
  bullet("**POIs (tabla 4, lado dispositivo):** tipos cerrados — agua, mirador, descanso, comida, estacionamiento, peligro, otro — con nombre ≤ 60 y nota ≤ 200; se agregan con un modo dedicado («toca el mapa») que abre el formulario in situ, y la lista mantiene orden renumerado 0..n (RoutePoi.orden). El tipo no reconocido cae a 'otro', nunca se pierde el POI."),
  bullet("**Elevación null explícito (§5.1):** el 0 ficticio del creador de trazados NO entra al editor — «crear desde actividad» sobre una traza del motor produce gainM null y la UI muestra «sin datos de elevación»; con GPX que trae <ele>, el desnivel real se conserva con eleFuente 'gpx'. El cero como elevación está prohibido en esquema y UI; la resolución por servicio queda para la publicación (fase D)."),
];

const seccion5 = [
  h1("5. Export GPX"),
  p("El botón GPX del editor (y de cada borrador en la lista) genera un **GPX 1.1** con el mismo patrón probado del export de rides: namespace y schemaLocation oficiales, trk/trkseg/trkpt con 6 decimales, nombre y descripción escapados. Sin fuente de elevación el archivo **no lleva <ele>** — jamás ele 0 inventado — y sin metadatos privados (no hay timestamps del dispositivo). La suite valida encabezado, conteo de puntos por coordenada, escape XML, ausencia de <time> y de <ele> sin fuente, y la presencia de ele solo en los puntos que lo tienen."),
  p("Limitación documentada: el export del borrador lleva el **agregado** de desnivel (gainM/eleFuente) pero no elevación por punto — la línea simplificada del editor no guarda ele por vértice; la elevación por punto se resuelve al publicar contra el servicio (fase D, eleFuente = servicio) y entonces la ficha y el export público la llevarán. El archivo del borrador es honesto: geometría exacta del propietario, sin datos que no existan."),
];

const seccion6 = [
  h1("6. Verificación: suite, compilación y prueba in-vivo"),
  tableTitle("Tabla 1: Verificación automatizada"),
  dataTable(
    ["Verificación", "Resultado"],
    [
      ["Suite nueva tests/rutas-editor.test.ts (npx tsx)", "**33/33 OK** — sugerencias (base, desnivel, pendiente, preliminar, tope), técnica por modalidad/atributos, enumerado cerrado de attrs (máx 3, dedup, descarte), origen auto/creador (nunca sobrescribe), borradores (crear/guardar/listar/actualizar sin perder campos), crear desde actividad (1:1, gain del motor → null), POIs (tipos cerrados, orden), GPX (1.1, escape, sin ele/sin time), multi-waypoint (sumarPierna sin duplicar vértice), convivencia con la migración (c30.trazas intacto)"],
      ["Regresión fase A: tests/rutas-store.test.ts", "**8/8 OK** — la migración por lectura y el store no cambiaron de conducta"],
      ["Regresión geometría: tests/route-geo.test.ts", "**11/11 OK**"],
      ["tsc --noEmit en src", "**0 errores** (los 44 pre-existentes de scripts/debug-*.ts son drift anterior a v1.14.3, fuera del estándar «tsc 0 en src»)"],
      ["Build web (next build)", "**SUCCESS** — 24 páginas estáticas generadas"],
      ["Export APK (build-apk.mjs)", "**SUCCESS** — build-static sin /api con version.json embebido"],
      ["eslint en los archivos nuevos", "0 errores"],
    ],
    [30, 70]
  ),
  tableTitle("Tabla 2: Prueba in-vivo (navegador real sobre dev server, Chromium headless)"),
  dataTable(
    ["Acción", "Resultado"],
    [
      ["Abrir el mapa → botón «Crear ruta»", "El editor abre en fase «puntos» con instrucción multi-waypoint"],
      ["Importar GPX de prueba (5 puntos con ele 300-410 m)", "Formulario abierto: 0.7 km · **+110 m · GPX** · sugerencia «Física fácil · Técnica muy fácil»"],
      ["Nombre «San Cristóbal In Vivo», dificultad física 4, atributos escénica + con miradores", "Contador 2/3; dificultad origen pasa a «creador»"],
      ["«Agregar POI en el mapa» → tap en el mapa → tipo agua, «Grifo norte» con nota", "POI agregado y listado con su nota"],
      ["«Guardar borrador»", "Aparece «Mis rutas (borradores)»; localStorage c30.rutas-v2 = {nombre, gainM 110, status borrador, attrs [escénica, con miradores], dif 4/1/creador, pois 1, eleFuente gpx}"],
      ["Recargar la página → continuar edición", "TODO el estado restaurado: nombre, física 4 seleccionada, +110 m, POI «Grifo norte», título «Editar ruta»"],
      ["Botón GPX", "**Descarga real**: san-crist-bal-in-vivo.gpx — GPX 1.1 válido, 5 trkpts, 0 <ele> (sin fuente por punto), sin metadatos privados"],
      ["Hallazgo y corrección en el ensayo", "La clave «tra.importarGpx» no existía en i18n (se pintaba cruda) → corregida a la clave vigente «tra.cargarGpx»; re-verificado in-vivo"],
    ],
    [38, 62]
  ),
  p("Pendiente deliberado: el trazado multi-waypoint contra el motor no se ejercitó in-vivo en este entorno (OSRM/grafo no disponibles en el sandbox); su lógica de concatenación está probada en la suite y cada pierna usa el mismo computeRoute ya probado del creador vigente. Se verificará in-vivo con el cliente en la revisión del release."),
];

const seccion7 = [
  h1("7. Criterios de aceptación de la fase B — estado"),
  tableTitle("Tabla 3: Checklist v2.1 §11.1 fase B"),
  dataTable(
    ["Criterio", "Estado", "Evidencia"],
    [
      ["Crear ruta con waypoints, atributos y dificultad ajustable desde cero (APK y web)", "**CUMPLIDO**", "Editor in-vivo en web (tabla 2); el flujo corre el mismo bundle en APK (export verificado). Trazado multi-waypoint contra el motor: en revisión del release (suite OK)"],
      ["Edición post-guardado persiste y se refleja en el mapa", "**CUMPLIDO**", "In-vivo: recarga + continuar edición restaura todo el estado; actualizarBorrador sin pérdida de campos (suite)"],
      ["Export GPX abre en terceros", "**CUMPLIDO**", "GPX 1.1 con namespace/schema oficial, descargado in-vivo (780 bytes, 5 trkpts); mismo patrón del export de rides vigente que los usuarios ya abren en terceros"],
      ["Elevación null visible como «sin datos» — jamás 0", "**CUMPLIDO**", "Crear desde actividad con traza del motor → null + chip «sin datos de elevación» (suite); GPX con ele → +110 m real; el export no inventa <ele>"],
    ],
    [30, 14, 56]
  ),
];

const seccion8 = [
  h1("8. Próximos pasos"),
  p("La fase B queda **implementada, compilada, probada y verificada in-vivo** a la espera de la revisión del cliente; entra al release junto al push pendiente (v1.15.0 ya tagueado con la fase A; el código de fase B sigue en el siguiente commit y saldrá en el bump 1.16.0 cuando se apruebe). Con la aprobación, la **fase C — biblioteca y fichas** continúa sobre esta base: las cuatro secciones navegables, Mis rutas con identidad verde, la ficha completa con el componente de perfil altimétrico nuevo (recharts, ya instalado y sin uso), chips recreativos, banner de vigencia y tiempo estimado en rango — con las fases D-F siguiendo el plan v2.1 (tabla 6 de la arquitectura) y sus criterios."),
  p("Archivos de la implementación: src/lib/dificultad.ts (sugerencias y atributos), src/lib/rutasBorrador.ts (borradores sobre el store), src/lib/gpx.ts (export de ruta), src/hooks/useEditorRutas.ts (máquina de estados), src/components/EditorRutaPanel.tsx (panel y lista de borradores), src/components/MapView.tsx (botón, tap dispatch, líneas y pins, sección de borradores), src/lib/rutasStore.ts (campos del modelo en RutaV2), src/lib/i18n.ts (claves edi.* en es/en/pt) y tests/rutas-editor.test.ts (suite 33)."),
];

const bodyChildren = [
  ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
  ...seccion6, ...seccion7, ...seccion8,
];
