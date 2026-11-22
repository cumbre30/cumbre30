// ============================================================
// gen_propuesta_cultura_es.js — Propuesta de revisión del módulo
// Cultura Ciclista: incorporación de recursos en español con
// selector principal de idioma (DOCX, portada R1 + TOC).
// SOLO PROPUESTA: no implementa nada en la app.
// Datos citados: medidos en esta sesión (semilla, API, UI, CI).
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  AlignmentType, NumberFormat, SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const H = require("./cierre-docx-helpers");

const SALIDA = "/home/z/my-project/download/Propuesta_Cultura_Biblioteca_Idiomas_Cumbre30.docx";

// ---------- portada ----------
const portada = H.buildCoverR1({
  title: "Propuesta: Biblioteca de Cultura Ciclista en español",
  subtitle: "Módulo Cultura · campo de idioma, selector principal y lote editorial en español",
  englishLabel: "CUMBRE30 CULTURA CICLISTA",
  metaLines: [
    "Alcance: revisión y diseño — sin implementación",
    "Base analizada: v1.23.0 (commit 1425740) · 65 recursos en catálogo",
    "Fecha: 22 de noviembre de 2026",
  ],
  footerLeft: "Cumbre30 · Cultura Ciclista",
  footerRight: "Propuesta de diseño",
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
      children: [new TextRun({ text: "Propuesta · Cultura Ciclista en español · Cumbre30", size: 18, color: "808080", font: H.FONT })],
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
      size: 16, color: "808080", font: H.FONT,
    })],
  }),
];

// ---------- cuerpo ----------
const c = [];

c.push(H.h1("1. Resumen ejecutivo"));
c.push(H.body("El encargo pide revisar el módulo Cultura Ciclista, cuyo catálogo contiene hoy solo obras en idioma extranjero (predominantemente inglés), y proponer cómo incorporar recursos en español, con un botón principal de idioma que muestre la biblioteca según esa elección. Esta revisión no implementa nada: documenta el estado actual medido en el código, evalúa alternativas y propone un diseño concreto, con plan de implementación, estimación de esfuerzo y criterio de aceptación."));
c.push(H.body("El diagnóstico es claro. La base tiene 65 recursos publicados (34 libros, 21 documentales y 10 películas, según la última corrida de la semilla editorial) y ninguno está en español; las reseñas editoriales, en cambio, ya están escritas en español por decisión del módulo. El modelo de datos no tiene campo de idioma, la API no filtra por idioma y la interfaz no ofrece ningún selector para ello. A favor del diseño, dos condiciones ya existentes abaratan mucho el trabajo: la aplicación entera ya soporta español, inglés y portugués (selector global en Ajustes, claves cu.* traducidas en las tres lenguas), y el módulo carga el catálogo completo una sola vez y filtra en el cliente, de modo que el filtro de idioma puede aplicarse sin peticiones nuevas."));
c.push(H.body("La recomendación es la opción B: añadir un campo idioma al modelo (migración aditiva, compatible con la política CT-M3 del proyecto), un selector principal de idioma en el módulo (Todos · Español · Inglés · Portugués, preajustado al idioma de la interfaz y persistido en el dispositivo), soporte del parámetro en la API y un lote editorial en español curado con el flujo ya previsto para borradores (publicado=false hasta revisión humana). El esfuerzo estimado es de 7 a 9 horas técnicas más la curación editorial del lote; la sección 6 detalla el reparto."));

c.push(H.h1("2. Estado actual del módulo"));
c.push(H.h2("2.1 Datos: modelo y contenido actual"));
c.push(H.body("El catálogo vive en la tabla propia cultura_recursos (Prisma, modelo CulturaRecurso), alimentada por una semilla editorial curada a mano (scripts/semilla-cultura.mjs, idempotente por título+tipo) y enriquecida offline por la ingesta de metadatos (scripts/ingesta-cultura.mjs). Cada recurso tiene título, reseña editorial original, tipo (libro | pelicula | documental), categorías (mtb, aventura, historia, ruta, entrenamiento, personas), autor o director, país, año, dato extra, portada opcional, enlace externo legítimo, proveedor del metadato y dos banderas de flujo: publicado (borrador → revisión → publicado) y destacado (fila superior del módulo). No existe ningún campo de idioma; el país sí, pero el idioma de la obra solo se infiere de su título."));
c.push(H.body("El contenido actual, medido en la corrida de la semilla del 22 de noviembre de 2026, es: 34 libros, 21 documentales y 10 películas, 65 registros en total, 10 destacados y las seis categorías en uso. Los títulos provienen de autores y productoras extranjeros: The Rider (Tim Krabbé, 1978), It's Not About the Bike (Lance Armstrong y Sally Jenkins, 2000), The Secret Race (Tyler Hamilton y Daniel Coyle, 2012), Full Tilt: Ireland to India with a Bicycle (Dervla Murphy, 1965), Miles from Nowhere (Barbara Savage, 1983) o Bicycle: The History (David V. Herlihy, 2004), entre otros. La búsqueda por expresión regular de títulos en español sobre el script de la semilla devuelve cero coincidencias: no hay ni un recurso en español."));
c.push(H.body("Hay una decisión editorial previa que conviene destacar: la reseña de cada recurso es texto original de Cumbre30 escrito en español (así lo declara el comentario del propio modelo en el esquema), y la ingesta tiene la regla inquebrantable de no sobreescribir jamás el trabajo editorial. Es decir, el problema no es la lengua de la interfaz ni la de las reseñas: es que las obras mismas (la lengua original del libro, la película o el documental) están todas en inglés u otras lenguas, y el ciclista hispanohablante no tiene biblioteca en su idioma ni forma de preferirla."));
c.push(H.h2("2.2 API y cliente"));
c.push(H.body("La API de catálogo (GET /api/cultura/recursos) exige sesión y acepta cuatro filtros combinables: tipo, cat (categoría), q (búsqueda insensible por título y autor) y destacado=1; la respuesta incluye los recursos ordenados (destacado, año, título), el arreglo de favoritos del usuario y el total. La interfaz (src/components/CulturaView.tsx) llama a la API sin parámetros, guarda la lista completa en el estado y aplica sus filtros en el cliente mediante un memo (matches) que combina búsqueda, tipo, categoría y solo-favoritos. Este patrón significa que agregar un filtro de idioma en la UI no exige ninguna segunda petición: basta incluir el idioma en la respuesta (ya viaja el recurso completo) y añadir una condición al memo."));
c.push(H.h2("2.3 Idiomas de la interfaz y selector global"));
c.push(H.body("La aplicación soporta tres idiomas de interfaz (es | en | pt) con sistema propio de traducción (src/lib/i18n.ts: hook useLang, función setLang, diccionario con las tres variantes por clave). El módulo Cultura ya tiene traducidas todas sus etiquetas (claves cu.*: hero, buscador, chips de tipo, categorías, destacados, ficha, resultados y estados vacíos) y el selector global de idioma vive en la pestaña de configuración (ConfigTab). El usuario puede estar viendo la interfaz en español y aun así encontrarse una biblioteca íntegramente extranjera: esa descoordinación es justamente lo que el encargo quiere resolver."));
c.push(H.h2("2.4 Ingesta de metadatos"));
c.push(H.body("La ingesta enriquece el catálogo con tres proveedores: Open Library (sin clave: año, páginas y portada desde covers.openlibrary.org, el único con uso de imagen permitido), Google Books (opcional, con GOOGLE_BOOKS_API_KEY) y TMDB (requiere TMDB_API_KEY; aporta año, duración y país de películas y documentales, pero sus imágenes no se usan por defecto). La ingesta se ejecuta en seco por defecto y con --aplicar para escribir; en la corrida del 22 de noviembre aplicó 24 enriquecimientos de Open Library sin fallos. Para el lote en español, los tres proveedores admiten restricción por idioma (language:spa en la búsqueda de Open Library, langRestrict=es en Google Books y language=es-CL en TMDB), así que el mecanismo actual se reutiliza casi sin cambios."));

c.push(H.h1("3. Opciones evaluadas"));
c.push(H.body("Se evaluaron cuatro caminos, del cambio nulo a la traducción editorial completa. La tabla siguiente los compara; después se argumenta la recomendación."));
c.push(H.tituloTabla("Tabla 1: comparación de opciones"));
c.push(H.tabla(
  ["Opción", "Qué implica", "Ventajas", "Costo / riesgo"],
  [
    ["A · Solo añadir recursos en español al catálogo mixto", "Nueva semilla ES sin cambios de esquema ni UI", "Cero código; visible de inmediato", "El usuario no puede elegir idioma ni preferirlo; el lote se diluye entre 65 extranjeros"],
    ["B · Campo idioma + selector principal + lote ES (recomendada)", "Migración aditiva, filtro en API y UI, semilla ES como borradores", "Resuelve la petición completa: elección clara y biblioteca según idioma; reusa i18n y el filtro en cliente", "Curación editorial del lote (el mayor costo); migración y pruebas"],
    ["C · Biblioteca por idioma de interfaz con reseñas traducidas", "Duplicar reseñas y datos por idioma (contenido localizado)", "Experiencia íntegramente traducida", "Duplica el trabajo editorial permanente; acopla catálogo al idioma de la UI; no es lo pedido"],
    ["D · Ficha multilingüe por recurso (título original + traducción)", "Campos adicionales por recurso y visual comparativa", "Rico para obras traducidas", "Alta complejidad de datos y UI; beneficia a pocas obras; futuro"],
  ],
  [26, 30, 22, 22]
));
c.push(H.body("La opción B es la recomendada porque cubre exactamente lo pedido («dejar un botón principal con el idioma y que muestre la biblioteca según eso») con el menor riesgo: el campo de idioma es una decisión de datos reversible y aditiva, el selector es un componente del patrón de chips que la UI ya usa, y el lote en español entra por el flujo editorial ya diseñado (borrador → revisión → publicado) que la suite de cultura ya verifica. Las opciones C y D no se descartan para el futuro, pero multiplican el esfuerzo editorial sin ser el requisito actual. La opción A sola queda descartada: añadir contenido sin mecanismo de elección deja la petición sin resolver."));

c.push(H.h1("4. Diseño propuesto (opción B)"));
c.push(H.h2("4.1 Esquema: campo idioma y migración aditiva"));
c.push(H.body("Se añade al modelo CulturaRecurso el campo idioma (texto, código ISO: es | en | pt, ampliable) con valor por defecto en en la migración, de modo que los 65 registros existentes queden correctamente clasificados sin backfill manual: ALTER TABLE cultura_recursos ADD COLUMN idioma TEXT NOT NULL DEFAULT 'en'. La migración es aditiva pura (sin DROP), por lo que pasa el chequeo CT-M3 que el workflow de GitHub ejecuta en cada build (scripts/check-migrations-additive.js). La nueva semilla en español marca sus entradas con idioma: \"es\" (y cuando exista lote portugués, pt). Al ser una tabla pequeña, no se crea índice por idioma; el orden por destacado/año/título se mantiene."));
c.push(H.body("El cambio en el esquema se aplica en tres pasos ya documentados en el proyecto: prisma db push contra el Postgres local de desarrollo (127.0.0.1:5433), npx prisma migrate deploy contra la base de producción de Neon antes del despliegue (el buildCommand de Vercel solo ejecuta prisma generate, no migraciones), y el despliegue normal por push a main. La columna nueva con default no rompe la API ni el APK vigentes durante el despliegue: sin downtime."));
c.push(H.h2("4.2 API: parámetro idioma"));
c.push(H.body("GET /api/cultura/recursos incorpora el parámetro opcional idioma (es | en | pt), combinable con los filtros existentes (tipo, cat, q, destacado). La validación replica el patrón actual: si el valor no está en la lista permitida se ignora (no error). La búsqueda q sigue operando sobre título y autor originales. Los recursos en la respuesta ya incluyen todos los campos, así que el idioma viaja sin cambios adicionales en el contrato de respuesta; el total de la respuesta refleja el filtro. Los favoritos no cambian: un favorito en inglés sigue accesible aunque el selector esté en español, porque la vista de favoritos es un filtro transversal independiente."));
c.push(H.h2("4.3 Interfaz: selector principal de idioma"));
c.push(H.body("Bajo el hero del módulo, junto a la fila de chips de tipo, se añade un control segmentado principal: Biblioteca en: Todos · Español · Inglés · Portugués. Su comportamiento propuesto:"));
c.push(H.bullet("Valor inicial: el idioma de la interfaz (useLang); quien usa Cumbre30 en español abre el módulo viendo primero la biblioteca en español, que es exactamente lo que pide el encargo. Se muestra con el chip Todos destacado cuando el catálogo de ese idioma todavía está en crecimiento."));
c.push(H.bullet("Persistencia: la elección se guarda en el dispositivo (clave propia de localStorage del módulo, mismo patrón que el resto de preferencias de la app) y no requiere cuenta: si el usuario inicia sesión en otro dispositivo, la elección vuelve al valor inicial."));
c.push(H.bullet("Alcance del filtro: afecta a destacados («Para empezar»), carruseles por categoría, resultados del buscador y la sección «Para tu perfil», que se recomputa con el subconjunto filtrado; si una sección queda vacía por el idioma, se muestra el estado vacío existente con un llamado «Ver todo el catálogo» que vuelve a Todos."));
c.push(H.bullet("Ficha del recurso: se añade un chip de idioma junto al tipo y al país (campo pais ya existente), para que siempre quede claro en qué lengua está la obra aunque el selector esté en Todos."));
c.push(H.bullet("Mis favoritos: se mantiene como vista transversal con todos los idiomas (muestra el chip de idioma en cada tarjeta); filtrar favoritos por idioma también se respetaría si el selector está activo, decisión a validar en la implementación."));
c.push(H.body("El componente reutiliza el patrón de chips existente (mismas clases, misma accesibilidad aria según los atributos filtroTipoAria/filtroCatAria, nuevas claves filtroIdiomaAria), así que el cambio visual es mínimo y coherente con el resto del módulo."));
c.push(H.h2("4.4 Lote editorial en español: curación con el flujo de borradores"));
c.push(H.body("El contenido es la parte crítica de la propuesta y por eso no se inventa: se cura con el flujo ya previsto en el módulo. Las reglas editoriales que la semilla actual ya impone se mantienen íntegras: solo obras reales y verificables, año solo cuando es seguro (null en caso contrario), enlaces externos de búsqueda o acceso legítimos (nunca simulación de reproducción o compra), reseña original propia en español, y una entrada solo si el ciclismo es protagonista o marco central de la obra. El nuevo script de semilla en español (scripts/semilla-cultura-es.mjs, idempotente por título+tipo+idioma) crea las entradas como borradores (publicado=false): la suite de cultura ya verifica que los borradores no se publican, de modo que el lote entra a revisión sin tocar la biblioteca pública hasta que el equipo marque publicado=true."));
c.push(H.body("La distribución sugerida para el lote inicial es de 25 a 40 recursos: libros en español o traducidos al español (biografías de ciclistas iberoamericanos, crónicas de viaje, ensayo histórico), películas y documentales en español (producciones iberoamericanas y documentales de ciclismo español y latinoamericano), y guías o referencias locales relevantes para la audiencia de la app (Chile y América Latina), donde el módulo puede aportar contenido que no existe en catálogos extranjeros. Las seis categorías y el sistema de destacados se usan igual que en el lote en inglés."));
c.push(H.body("Vías de verificación para la curación: Open Library con restricción language:spa y términos ciclismo / bicicleta / bikepacking; TMDB e IMDb en español para películas y documentales (verificar existencia, año y país antes de crear la ficha); y catálogos editoriales o bibliotecas nacionales para libros locales. Cada ficha se crea con su URL de búsqueda verificada y el campo proveedor en editorial. La tabla de la sección 5 muestra la forma de las entradas con candidatos de partida, sin publicarlos hasta verificar."));
c.push(H.h2("4.5 Ingesta en español"));
c.push(H.body("El script de ingesta se extiende con la restricción de idioma en los tres proveedores: en Open Library la búsqueda añade language:spa para los recursos marcados es (y language:por para pt si hay lote); en Google Books el parámetro langRestrict=es; en TMDB language=es-CL para los metadatos. Las reglas del módulo no cambian: la ingesta solo completa campos vacíos (año, país, extra, portadaUrl), jamás toca reseña, autor, categorías o enlace de la semilla, y las portadas se siguen aceptando solo de Open Library. Los documentales en español suelen carecer de ficha en Open Library: es esperable que queden sin portada y con el estilo procedural del módulo (paleta determinista por recurso), que ya se ve bien en el catálogo actual."));
c.push(H.h2("4.6 Textos e i18n"));
c.push(H.body("Se añaden las claves de traducción en las tres lenguas: título del selector y etiquetas de idioma (cu.idiomaTitulo, cu.idiomaTodos, cu.idiomaEs, cu.idiomaEn, cu.idiomaPt), atributo de accesibilidad (cu.filtroIdiomaAria), chip de ficha (cu.fichaIdioma) y el estado vacío por idioma con su llamado a ver todo el catálogo (cu.vacioIdioma y cu.vacioIdiomaCta). Las etiquetas de idioma se muestran con su nombre propio (Español, English, Português) en las tres interfaces, convención común para lenguas."));
c.push(H.h2("4.7 Pruebas"));
c.push(H.body("La suite de cultura (tests/cultura.test.ts, 35 verificaciones actualmente) se extiende para que el criterio quede automatizado: filtro idioma=es devuelve solo recursos en español; el filtro es combinable con tipo y categoría; un borrador en español no aparece público; la búsqueda q opera igual dentro de un idioma; y la vista contiene el selector con sus cuatro opciones y persiste la elección. Las aserciones existentes siguen siendo verdaderas sin tocarlas: la de «al menos 50 recursos publicados» gana margen con el lote en español publicado tras revisión, y la de destacados continúa sobre el catálogo completo si el selector está en Todos."));
c.push(H.h2("4.8 Despliegue y verificación"));
c.push(H.body("El orden propuesto: (1) migración aditiva y db push local; (2) semilla ES como borradores + ingesta ES; (3) código de API y UI con pruebas en verde; (4) revisión editorial del lote y paso a publicado; (5) migrate deploy contra Neon; (6) push a main (despliegue Vercel automático); (7) verificación en producción: catálogo filtrado por idioma desde la web y desde el APK, y suite de cultura 7/7 verde en el entorno de base de datos real. Las descargas del APK vigente no se afectan: la columna nueva no cambia el contrato de la API para el cliente actual."));

c.push(H.h1("5. Lote inicial en español: candidatos de partida"));
c.push(H.body("La tabla siguiente ilustra la forma de las entradas del lote con candidatos de partida REALES pero SIN VERIFICAR: ninguna se publica sin confirmar primero su existencia, año, autor y enlace mediante las vías de la sección 4.4. Son puntos de búsqueda, no fichas aprobadas."));
c.push(H.tituloTabla("Tabla 2: candidatos de partida (pendientes de verificación editorial)"));
c.push(H.tabla(
  ["Candidato", "Tipo", "Categorías", "Por qué encaja", "Verificación"],
  [
    ["«El ciclista» de Tim Krabbé en su edición en español", "libro", "ruta, historia, personas", "La novela ciclística más citada del catálogo actual (The Rider, 1978); si existe edición traducida, es el puente perfecto entre ambas bibliotecas", "Open Library language:spa; catálogos editoriales"],
    ["Biografía o documental de Federico Martín Bahamontes", "documental / libro", "historia, personas", "Primer español ganador del Tour (1959): figura central del ciclismo en español", "TMDB/IMDb en es-CL; Open Library es"],
    ["Documentales de Miguel Indurain (5 Tours, 1991-1995)", "documental", "historia, ruta", "Referencia iberoamericana de máxima relevancia para la audiencia", "TMDB/IMDb búsqueda es-CL"],
    ["Literatura y crónica ciclista latinoamericana contemporánea", "libro", "aventura, personas", "Autores en español con viajes o relatos sobre dos ruedas; contenido ausente en catálogos extranjeros", "Open Library language:spa «bicicleta viaje»"],
    ["Guías y referencias de MTB y rutas de Chile", "libro / documental", "mtb, ruta, aventura", "La audiencia de la app es chilena (cumbregeo.cl): guías locales aportan lo que ningún catálogo extranjero tiene", "Editoriales y bibliotecas nacionales; turismo local"],
  ],
  [30, 14, 18, 22, 16]
));
c.push(H.body("El criterio de aprobación por recurso queda así: obra confirmada por al menos una fuente con URL verificada; año y autor completados solo con evidencia; enlace externo de búsqueda legítimo; reseña original en español de 2 a 4 frases; categorías dentro de las seis del spec; y marcado destacado solo para la selección de entrada. El flujo borrador → publicado permite crear las fichas sin prisa y publicar el lote por oleadas."));

c.push(H.h1("6. Plan de implementación y esfuerzo"));
c.push(H.tituloTabla("Tabla 3: fases, entregables y esfuerzo estimado"));
c.push(H.tabla(
  ["Fase", "Trabajo", "Archivos", "Esfuerzo"],
  [
    ["F1 · Esquema", "Campo idioma + migración aditiva + db push local", "prisma/schema.prisma, prisma/migrations/*", "0,5 h"],
    ["F2 · API", "Parámetro idioma con validación y filtro combinable", "src/app/api/cultura/recursos/route.ts", "0,5 h"],
    ["F3 · UI", "Selector principal, memoria en dispositivo, chips de ficha, estados vacíos", "src/components/CulturaView.tsx", "1,5 h"],
    ["F4 · i18n", "Claves cu.idioma* en es/en/pt", "src/lib/i18n.ts", "0,5 h"],
    ["F5 · Semilla ES", "Lote 25-40 recursos como borradores + revisión editorial + publicado", "scripts/semilla-cultura-es.mjs", "2-4 h (curación)"],
    ["F6 · Ingesta", "Restricción de idioma en Open Library/Google Books/TMDB", "scripts/ingesta-cultura.mjs", "0,5 h"],
    ["F7 · Pruebas", "Extensión de la suite de cultura (+6-8 verificaciones)", "tests/cultura.test.ts", "1 h"],
    ["F8 · Despliegue", "migrate deploy Neon + push + verificación producción", "—", "0,5 h"],
  ],
  [16, 36, 30, 18]
));
c.push(H.body("Total estimado: 7 a 9 horas técnicas más la revisión editorial. El orden interno importa: la migración y la semilla van primero (el código de API y UI es más simple de verificar con datos), y la revisión editorial puede avanzar en paralelo con F2-F4 porque los borradores no se publican."));
c.push(H.h2("6.1 Riesgos y mitigaciones"));
c.push(H.bullet("Calidad del lote en español: mitigada por el flujo de borradores y el criterio de verificación con URL; ningún recurso se publica sin evidencia."));
c.push(H.bullet("Cobertura de metadatos: los documentales en español casi no tienen ficha en Open Library (portada y año vacíos); el módulo ya tiene el estilo de portada procedural y el campo extra de la semilla para compensar, y TMDB requiere clave propia (sin clave, se dejan esos campos vacíos)."));
c.push(H.bullet("Expectativa del usuario con catálogo mixto en crecimiento: el chip Todos y el contador de resultados dejan claro el tamaño de cada biblioteca; el estado vacío con llamado «Ver todo el catálogo» evita pantallas muertas."));
c.push(H.bullet("Migración: es aditiva pura (CT-M3) y con default, sin downtime; se aplica a Neon antes del despliegue porque el build de Vercel no ejecuta migraciones."));
c.push(H.bullet("Compatibilidad del APK vigente: el contrato de respuesta no cambia (campo nuevo incluido en el recurso); el APK actual ignora el campo desconocido y sigue funcionando."));

c.push(H.h1("7. Criterio de aceptación y conclusión"));
c.push(H.tituloTabla("Tabla 4: checklist de aceptación de la propuesta"));
c.push(H.tabla(
  ["#", "Condición", "Verificación"],
  [
    ["1", "El catálogo distingue el idioma de cada recurso", "Campo idioma en esquema y migración aditiva aplicada; los 65 registros vigentes quedan en en"],
    ["2", "El módulo tiene un selector principal de idioma", "Segmentado Todos · Español · Inglés · Portugués bajo el hero; persiste en el dispositivo; preajustado al idioma de la interfaz"],
    ["3", "La biblioteca responde al selector", "Destacados, carruseles, buscador y «Para tu perfil» muestran solo el idioma elegido; estado vacío con llamado a Todos"],
    ["4", "La API filtra por idioma", "idioma=es combinable con tipo/cat/q/destacado; verificada en la suite con DB real"],
    ["5", "Existe un lote editorial en español", "25-40 fichas creadas como borradores y publicadas por oleadas tras revisión con URL verificada"],
    ["6", "Sin regresiones", "Suite de cultura extendida en verde (35 + 6-8 verificaciones) y resto de suites sin cambios"],
  ],
  [8, 36, 56]
));
c.push(H.body("Conclusión: el módulo Cultura ya está arquitectónicamente preparado para la biblioteca en español —reseñas en español, i18n triple, filtro en cliente, flujo editorial de borradores e ingesta con restricción de idioma— y solo le faltan tres piezas: el dato (campo idioma), la elección (selector principal) y el contenido (lote curado en español con verificación obligatoria). Con la opción B, el ciclista hispanohablante abre el módulo y encuentra primero la biblioteca en su idioma, con la puerta abierta a portugués y a toda la biblioteca cuando quiera explorarla. Estimado total: 7 a 9 horas técnicas más la curación editorial; ninguna de las decisiones propuestas es irreversible."));

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
