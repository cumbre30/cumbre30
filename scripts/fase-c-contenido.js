// ---------- Contenido: informe de Fase C ----------
const seccion1 = [
  h1("1. Alcance de la fase C y confirmaciones"),
  p("Con la fase B aprobada y su release preparado (v1.16.0 · code 76, commit y tag locales listos para el push), quedó implementada la **fase C — biblioteca y fichas**: una **biblioteca de rutas** a pantalla completa con **cuatro secciones navegables** e identidad verde, la **ficha completa** de cada ruta con **banner de vigencia**, **perfil altimétrico nuevo** (recharts, la librería ya instalada y sin uso), **chips recreativos** con su leyenda orientativa, **tiempo estimado en rango ±25 %** y acciones. Todo sobre la arquitectura v2.1 (tabla 6 «C», §7.4 y §5.3)."),
  bullet("**Confirmación 1 — creador y Mis trazados intactos:** el acceso a la biblioteca es un botón verde nuevo en la cabecera de la sección de borradores del panel de capas; la bottom-nav (Ride · Explorar · Acceso · Perfil), el creador de trazados y el panel Mis trazados no cambian de conducta (regresión §11.1 fase C)."),
  bullet("**Confirmación 2 — datos locales, nada nuevo al servidor:** la biblioteca trabaja sobre c30.rutas-v2 (fase A/B) y una clave nueva c30.rutas-recientes; el catálogo y los favoritos muestran estados vacíos honestos que anuncian su llegada en las fases D y E."),
  bullet("**Confirmación 3 — release:** el bump 1.16.0 quedó commiteado y tagueado ANTES del código de fase C (la fase C entra al siguiente release 1.17.0 tras su aprobación). El push sigue pendiente de credenciales GitHub en el entorno: el repo es público para lectura pero el push requiere autenticación."),
];

const seccion2 = [
  h1("2. La biblioteca: cuatro secciones navegables"),
  p("El botón verde abre un overlay a pantalla completa con las cuatro secciones: **Mis rutas** (borradores del editor con su badge y las trazadas migradas de fase A), **Catálogo** («El catálogo público llega con la publicación»), **Favoritas** (llega con la comunidad, fase E) y **Recientes** (fichas abiertas en el dispositivo, sin duplicados, máximo 20, con «quitar de recientes»). Cada fila muestra distancia, desnivel o «sin elevación», POIs y badge; el tap abre la ficha."),
  p("Detalle técnico importante: el overlay se renderiza con **createPortal a document.body** — el contenedor del área del mapa es un stacking context (absolute con z-0) y sin el portal el header y la bottom-nav de la app pintaban SIEMPRE por encima del overlay por más z-index que usara. El ensayo in-vivo lo detectó, lo midió (getComputedStyle sobre la cadena de ancestros) y lo corrigió; el overlay quedó verificado cubriendo header, centro y nav."),
];

const seccion3 = [
  h1("3. La ficha completa con sus estados"),
  p("La ficha reúne: **banner de vigencia** (§7.4) en sus tres estados básicos — vigente (revisada hace menos de 6 meses), avisos activos (informativos, con el número de reportes de cierre o peligro abiertos; los reportes nunca cambian la geometría) y sin revisar (nunca revisada o hace más de 6 meses) — más el estado retirada reservado para la publicación; **stats** (distancia, desnivel con «—» y «sin elevación» cuando no hay fuente, tiempo estimado); **chips recreativos** con la leyenda «atributos orientativos definidos por el creador» (§5.3); **dificultad** física y técnica con sus etiquetas y el sello «ajustada por el creador»; **POIs** listados; descripción; y **acciones**: Ver en el mapa (encuadra y cierra), Editar (abre el editor de fase B), **«Revisé hoy»** (actualiza ultimaRevisionAt y el banner pasa a vigente — la acción del creador del §7.4), GPX y Eliminar."),
  p("El **tiempo estimado orientativo** se muestra como **rango ±25 %** (§5.3): modelo de velocidad por pendiente inspirado en el motor de métricas vigente (rideMetrics) — llano 18 km/h, la pendiente media penaliza un 5 % por punto con tope del 12 % y piso de 6 km/h — y sin datos de desnivel la estimación es preliminar (solo distancia). Es orientativo por diseño: no es tiempo objetivo, no genera ranking ni fantasma de ruta, y la leyenda lo dice en la ficha."),
];

const seccion4 = [
  h1("4. Perfil altimétrico nuevo y elevación por punto"),
  p("El **perfil altimétrico** es trabajo nuevo (la auditoría v1 lo asumía existente y no lo había): un AreaChart de recharts (km en X, metros en Y, tooltip) que se renderiza **SOLO cuando la ruta tiene elevación por punto con al menos dos valores** — jamás con ceros inventados (§5.1). Para que existan esos datos, la fase C completa la cadena: **parseGpxLine ahora devuelve la elevación por punto** (eles alineada 1:1 con los pts, undefined cuando el archivo no trae <ele>), el editor la captura al importar y el borrador la guarda en **RutaV2.eleM**; al editar la geometría, si eleM queda desalineada se descarta (perfil honesto) y puede re-establecerse; y el **export GPX del borrador ahora lleva <ele> cuando la fuente la tiene** (antes llevaba la geometría sin elevación por punto)."),
];

const seccion5 = [
  h1("5. Verificación: suite, compilación y prueba in-vivo"),
  tableTitle("Tabla 1: Verificación automatizada"),
  dataTable(
    ["Verificación", "Resultado"],
    [
      ["Suite nueva tests/rutas-ficha.test.ts", "**22/22 OK** — vigencia (3 meses → vigente, 7 meses → sin revisar, null/fecha inválida, avisos con reportes, retirada), tiempo estimado (±25 % exacto, preliminar sin gain, penalización 6 % → 12,6 km/h, tope 12 %, extremos), formateo, recientes (cap 20, dedupe, quitar, limpiar, JSON corrupto), eleM (alineada se guarda, desalineada se descarta, sin gain no se guarda, re-establecible) y «Revisé hoy»"],
      ["Regresiones: rutas-editor / rutas-store / route-geo / api-routes", "**33/33 · 8/8 · 11/11 · OK** — las fases A y B no cambiaron de conducta"],
      ["tsc --noEmit en src", "**0 errores**"],
      ["Build web + export APK", "**SUCCESS** ambos (build-static sin /api)"],
      ["eslint en archivos nuevos", "0 errores"],
    ],
    [30, 70]
  ),
  tableTitle("Tabla 2: Prueba in-vivo (navegador real, Chromium headless)"),
  dataTable(
    ["Acción", "Resultado"],
    [
      ["Crear borrador con GPX de 4 puntos con elevación", "Guardado con **eleM de 4 puntos** — la elevación por punto entra a la ficha"],
      ["Biblioteca → 4 secciones", "Abre con Mis rutas (1) · Catálogo · Favoritas · Recientes (1); identidad verde"],
      ["Ficha de «Cerro Manquehue»", "Banner **SIN REVISAR** · 1.1 km · +720 m · **tiempo 7–12 min** (rango ±25 % con penalización por pendiente) · **perfil altimétrico con la curva real** · chips de dificultad · acciones completas"],
      ["«Revisé hoy» → recarga", "Banner pasa a **VIGENTE** y **persiste** en el store tras recargar la página"],
      ["Ver en el mapa", "Cierra la biblioteca y encuadra la geometría en el mapa"],
      ["Catálogo / Favoritas", "Estados vacíos con sus textos de llegada (fases D/E)"],
      ["Recientes", "La ficha abierta queda listada y se puede quitar"],
      ["Consola del navegador", "**0 errores** en sesión limpia"],
      ["Hallazgos del ensayo corregidos", "1) **Bucle useSyncExternalStore**: get() del store devolvía una referencia nueva por llamada → «Maximum update depth exceeded» in-vivo → arreglado en la RAÍZ (caché por cadena cruda en rutasStoreFor) + getServerSnapshot con constante única. 2) **Stacking context**: el chrome del mapa pintaba sobre el overlay → medido con getComputedStyle (ancestro absolute z-0) → corregido con createPortal a body"],
    ],
    [38, 62]
  ),
];

const seccion6 = [
  h1("6. Criterios de aceptación de la fase C — estado"),
  tableTitle("Tabla 3: Checklist v2.1 §11.1 fase C"),
  dataTable(
    ["Criterio", "Estado", "Evidencia"],
    [
      ["Cuatro secciones navegables con identidad verde (claro y oscuro)", "**CUMPLIDO**", "Mis rutas · Catálogo · Favoritas · Recientes con tokens del tema (verificado in-vivo en tema oscuro; los tokens bg-card/border-border/verde aplican a ambos temas)"],
      ["Ficha con perfil altimétrico solo cuando hay elevación", "**CUMPLIDO**", "Con eleM (GPX con <ele>) el perfil renderiza la curva real; sin eleM el componente no se monta (suite + in-vivo)"],
      ["Banner de vigencia correcto en sus tres estados", "**CUMPLIDO**", "sin-revisar → vigente con «Revisé hoy» (in-vivo, persistido); avisos verificado en suite (reportes → aviso informativo con número); retirada reservada para fase D"],
      ["Regresión del creador y Mis trazados sin cambios", "**CUMPLIDO**", "Creador intacto (suite 33/33 fase B) y Mis trazados sin modificaciones; el acceso a la biblioteca es aditivo (botón nuevo)"],
    ],
    [30, 14, 56]
  ),
];

const seccion7 = [
  h1("7. Próximos pasos"),
  p("La fase C queda implementada, compilada, probada y verificada in-vivo a la espera de la revisión del cliente; entrará al release 1.17.0 junto con el push pendiente (v1.15.0 y v1.16.0 ya tagueados en local). Con la aprobación, la **fase D — publicación y descubrimiento** continúa sobre esta base: publicación explícita con vista previa obligatoria de la protección, RouteVersion, catálogo con búsqueda y filtros sobre las cells y el predicado bbox corregido (CT-G1 a CT-G8 en CI), protección por niveles con extremos aproximados y resolución de elevación al publicar (CT-P1 a CT-P6) — el catálogo de la biblioteca deja su estado vacío y pasa a listar las rutas publicadas por la comunidad."),
  p("Archivos de la implementación: src/lib/rutasFicha.ts (vigencia, tiempo estimado, recientes), src/lib/rutasStore.ts (eleM, ultimaRevisionAt y snapshot estable), src/lib/gpx.ts (elevación por punto al importar), src/lib/rutasBorrador.ts (passthrough eleM), src/hooks/useEditorRutas.ts (captura eles), src/components/BibliotecaRutas.tsx (biblioteca, ficha, banner, perfil), src/components/EditorRutaPanel.tsx (botón biblioteca), src/components/MapView.tsx (integración y portal) y tests/rutas-ficha.test.ts (suite 22)."),
];

const bodyChildren = [
  ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
  ...seccion6, ...seccion7,
];
