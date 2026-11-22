// ============================================================
// gen_propuesta_cultura_es.js — Propuesta de revisión del módulo
// Cultura Ciclista (DOCX, portada R1 + TOC). SOLO PROPUESTA: no
// implementa nada en la app.
// v2 (2026-11-22): opción B ampliada — lote portugués, selector como
// filtro principal y reseñas en el idioma de la ficha.
// v3 (2026-11-22): depuración de los 11 recursos fuera de es/en/pt.
// v4 (2026-11-22): LA DEPURACIÓN SE RETIRA. Verificación con fuentes
// web de que las 11 obras tienen edición o versión en inglés (libro
// traducido, doblaje o subtítulos) → regla nueva: idioma = idioma de
// la EDICIÓN/VERSIÓN DE REFERENCIA; las 11 permanecen clasificadas
// en con su idioma original anotado en el campo extra existente.
// Verificación del 22-11-2026: The Rider (Bloomsbury, trad. Sam
// Garrett + audiolibro), A Sunday in Hell (narración inglesa de
// David Saunders), Unchained (audio inglés, Netflix oficial), Bicycle
// Thieves (Criterion: doblaje opcional + subtítulos), Wonderful
// Losers (subtítulos, NY Baltic Film Festival).
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
  title: "Propuesta: Biblioteca multilingüe de Cultura Ciclista",
  subtitle: "Módulo Cultura · campo de idioma, selector principal y lotes editoriales en español y portugués",
  englishLabel: "CUMBRE30 CULTURA CICLISTA",
  metaLines: [
    "Versión 4 · regla del idioma de la edición de referencia: las 11 obras no anglosajonas permanecen (todas con edición o versión en inglés verificada con fuentes)",
    "Base: 64 recursos (33·10·21) · 10 destacados · sin depuración",
    "Fecha: 22 de noviembre de 2026",
  ],
  footerLeft: "Cumbre30 · Cultura Ciclista",
  footerRight: "Propuesta de diseño v4",
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
      children: [new TextRun({ text: "Propuesta · Cultura Ciclista multilingüe · Cumbre30", size: 18, color: "808080", font: H.FONT })],
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
c.push(H.body("El encargo original pedía revisar el módulo Cultura Ciclista para incorporar recursos en español y un botón principal de idioma que mostrara la biblioteca según esa elección. Sobre la propuesta documentada en la versión 1, la instrucción confirmada el 22 de noviembre de 2026 tomó tres decisiones: adoptar la opción B recomendada, extenderla al portugués (recursos en español y portugués que cambian la biblioteca al seleccionarlos, como filtro principal) y modificar la política editorial de las reseñas, que dejarán de estar todas en español para estar en el idioma del recurso, dejando la traducción dinámica para una evaluación posterior. Durante la revisión se evaluó una cuarta decisión —depurar los 11 recursos cuyo idioma original no es es/en/pt— que esta versión retira después de la verificación planteada en la conversación: las 11 obras tienen edición o versión en inglés (el libro traducido, las películas y documentales con doblaje o subtítulos), de modo que el criterio de clasificación pasa a ser el idioma de la edición de referencia y ninguna obra se pierde. El catálogo se mantiene íntegro en 64 registros y la versión 4 consolida el diseño final."));
c.push(H.body("El diagnóstico queda verificado directamente en PostgreSQL local el mismo día: 64 recursos publicados (33 libros, 10 películas y 21 documentales), 10 destacados, las seis categorías en uso, ninguna obra de origen español o portugués y 64 reseñas editoriales escritas todas en español. De los 64, 53 son de origen inglés y 11 provienen de otras lenguas; la verificación con fuentes web del 22-11-2026 (Tabla 2) confirma que las 11 son accesibles en inglés: The Rider existe en traducción inglesa publicada por Bloomsbury, A Sunday in Hell circula en versión internacional con narración en inglés de David Saunders, Tour de France: Unchained ofrece audio en inglés en Netflix, Ladri di biciclette se distribuye en la edición Criterion con doblaje y subtítulos en inglés, y Wonderful Losers se exhibe con subtítulos en inglés, entre otras confirmaciones. Con la regla de la edición de referencia, el filtro principal cubre el 100 % del catálogo sin borrar nada."));
c.push(H.body("La recomendación consolidada es: clasificar cada recurso por el idioma de su edición o versión de referencia (un único campo aditivo idioma con migración CT-M3; las 11 obras quedan en en con su idioma original anotado en el campo extra ya existente), el selector principal como primera fila de filtros (Todos · Español · Inglés · Portugués, con persistencia en el dispositivo), el parámetro idioma en la API, dos lotes editoriales como borradores (español de 25 a 40 recursos, portugués de 15 a 30), la reescritura de las 64 reseñas vigentes al inglés (borrador asistido por LLM más pasada humana) y la suite de cultura extendida. El esfuerzo estimado queda en 12 a 17,5 horas técnicas y editoriales; la sección 6 detalla el reparto. La única condición editorial que añade esta versión es verificar la fuente de la edición de referencia por recurso antes de publicar: la clasificación en inglés debe apoyarse en una edición o versión concreta y localizable, no en la presunción general de que el inglés es universal."));

c.push(H.h1("2. Estado actual del módulo"));
c.push(H.h2("2.1 Datos: modelo y contenido actual"));
c.push(H.body("El catálogo vive en la tabla propia cultura_recursos (Prisma, modelo CulturaRecurso), alimentada por una semilla editorial curada a mano (scripts/semilla-cultura.mjs, idempotente por título+tipo) y enriquecida offline por la ingesta de metadatos (scripts/ingesta-cultura.mjs). Cada recurso tiene título, reseña editorial original, tipo (libro | pelicula | documental), categorías (mtb, aventura, historia, ruta, entrenamiento, personas), autor o director, país, año, dato extra, portada opcional, enlace externo legítimo, proveedor del metadato y dos banderas de flujo: publicado (borrador → revisión → publicado) y destacado (fila superior del módulo). No existe ningún campo de idioma; el país sí, pero el idioma de la obra solo se infiere de su título. El campo extra es texto libre ya en uso para datos complementarios, y por eso sirve para anotar el idioma original sin añadir columnas."));
c.push(H.body("El contenido actual, verificado el 22 de noviembre de 2026 contra la base local de PostgreSQL y contra el script de semilla, es: 33 libros, 10 películas y 21 documentales —64 registros publicados—, 10 destacados y las seis categorías en uso. Los títulos provienen de autores y productoras extranjeros: The Rider (Tim Krabbé, 1978), It's Not About the Bike (Lance Armstrong y Sally Jenkins, 2000), The Secret Race (Tyler Hamilton y Daniel Coyle, 2012), Full Tilt: Ireland to India with a Bicycle (Dervla Murphy, 1965) o Bicycle: The History (David V. Herlihy, 2004), entre otros. La búsqueda de títulos en español sobre la semilla devuelve cero coincidencias: no hay ni un recurso en español ni en portugués."));
c.push(H.body("Nota de verificación: la versión 1 de este documento citaba 65 registros (34 libros). El conteo directo del 22-11-2026 en PostgreSQL local arroja 64 publicados coincidentes con la semilla; la cifra de 65 provenía de una corrida anterior. Antes de completar los datos en producción (Neon) se contará el catálogo directamente para resolver cualquier desfase."));
c.push(H.body("Sobre el idioma original de las obras: 53 de los 64 recursos son de origen inglés; los 11 restantes (17,2 %) provienen de otras lenguas —The Rider es neerlandesa, Ladri di biciclette italiana, Les Triplettes de Belleville y Le gamin au vélo francesas, el tríptico de Jørgen Leth (A Sunday in Hell, Stars and Water Carriers, The Impossible Hour) danés, Beijing Bicycle china, Wadjda árabe y Wonderful Losers lituana, además de la serie Tour de France: Unchained (producción francesa)—. La versión 3 de esta propuesta las depuraba; la verificación planteada en la conversación demostró que todas tienen edición o versión en inglés (Tabla 2), y por eso la versión 4 las mantiene: para un lector del filtro en inglés, cada una de las 11 se lee o se ve en inglés, que es lo que el filtro significa. La biblioteca organizada por idiomas no exige que la obra nazca en ese idioma, sino que su edición de referencia esté en él."));
c.push(H.h2("2.2 API y cliente"));
c.push(H.body("La API de catálogo (GET /api/cultura/recursos) exige sesión y acepta cuatro filtros combinables: tipo, cat (categoría), q (búsqueda insensible por título y autor) y destacado=1; la respuesta incluye los recursos ordenados (destacado, año, título), el arreglo de favoritos del usuario y el total. La interfaz (src/components/CulturaView.tsx) llama a la API sin parámetros, guarda la lista completa en el estado y aplica sus filtros en el cliente mediante un memo (matches) que combina búsqueda, tipo, categoría y solo-favoritos. Este patrón significa que agregar el filtro de idioma en la UI no exige ninguna segunda petición: basta incluir el campo nuevo en la respuesta (el recurso viaja completo) y añadir una condición al memo."));
c.push(H.h2("2.3 Idiomas de la interfaz y selector global"));
c.push(H.body("La aplicación soporta tres idiomas de interfaz (es | en | pt) con sistema propio de traducción (src/lib/i18n.ts: hook useLang, función setLang, diccionario con las tres variantes por clave). El módulo Cultura ya tiene traducidas todas sus etiquetas (claves cu.*: hero, buscador, chips de tipo, categorías, destacados, ficha, resultados y estados vacíos) y el selector global de idioma vive en la pestaña de configuración (ConfigTab). El usuario puede estar viendo la interfaz en español y aun así encontrarse una biblioteca íntegramente extranjera: esa descoordinación es justamente lo que el encargo quiere resolver."));
c.push(H.h2("2.4 Ingesta de metadatos"));
c.push(H.body("La ingesta enriquece el catálogo con tres proveedores: Open Library (sin clave: año, páginas y portada desde covers.openlibrary.org, el único con uso de imagen permitido), Google Books (opcional, con GOOGLE_BOOKS_API_KEY) y TMDB (requiere TMDB_API_KEY; aporta año, duración y país de películas y documentales, pero sus imágenes no se usan por defecto). La ingesta se ejecuta en seco por defecto y con --aplicar para escribir; en la corrida del 22 de noviembre aplicó 24 enriquecimientos de Open Library sin fallos. Los tres proveedores admiten restricción por idioma (language:spa / language:por en Open Library, langRestrict=es / pt en Google Books y language=es-CL / pt-BR en TMDB), así que el mecanismo actual sirve igual para el lote en español que para el portugués casi sin cambios."));

c.push(H.h1("3. Opciones evaluadas"));
c.push(H.body("Se evaluaron cuatro caminos, del cambio nulo a la localización completa. La tabla siguiente los compara en la formulación v4; después se argumenta la recomendación adoptada."));
c.push(H.tituloTabla("Tabla 1: comparación de opciones"));
c.push(H.tabla(
  ["Opción", "Qué implica", "Ventajas", "Costo / riesgo"],
  [
    ["A · Solo añadir recursos en español al catálogo mixto", "Nueva semilla ES sin cambios de esquema ni UI", "Cero código; visible de inmediato", "El usuario no puede elegir idioma ni preferirlo; el lote se diluye entre 64 extranjeros"],
    ["B · Campo idioma por edición de referencia + selector principal + lotes ES y PT (adoptada)", "Un campo aditivo clasificado por la edición/versión de cada obra (traducida o subtitulada), filtro en API y UI, semillas ES/PT como borradores, reseñas en el idioma de la edición", "Biblioteca 100 % filtrable por las tres lenguas sin perder obras; regla de reseñas sin excepciones; esquema mínimo (un campo); reusa i18n y el filtro en cliente", "Exige verificar la edición de referencia por recurso (fuente concreta); curación de dos lotes y reescritura de 64 reseñas"],
    ["C · Biblioteca por idioma de interfaz con reseñas traducidas", "Duplicar reseñas y datos por idioma (contenido localizado)", "Experiencia íntegramente traducida", "Duplica el trabajo editorial permanente; acopla catálogo al idioma de la UI; su parte útil entra como traducción dinámica futura"],
    ["D · Depurar los recursos fuera de es/en/pt (descartada en v4)", "Borrar las 11 obras de origen no anglosajón", "Regla de clasificación pura por idioma original", "Innecesaria: la verificación demostró que las 11 tienen edición/versión en inglés; perdería obras de referencia del ciclismo"],
  ],
  [26, 30, 22, 22]
));
c.push(H.body("El usuario adoptó la opción B y la precisó en tres pasos sucesivos: el portugués como segundo idioma de biblioteca, la política de reseñas en el idioma del recurso (con traducción automática reservada para una evaluación posterior) y, en la conversación, la pregunta que corrigió el rumbo: de los 11 recursos a depurar, ¿están en inglés? Normalmente, e independiente del idioma de origen, el inglés es universal. La verificación por recurso (Tabla 2) confirmó la hipótesis y la depuración dejó de tener objeto: clasificando por edición de referencia, las 11 responden al selector bajo Inglés y ninguna obra se pierde. La opción A sola queda descartada porque deja la petición de elección sin resolver, la C entra en el futuro como traducción dinámica y la D queda descartada con la evidencia de la Tabla 2."));

c.push(H.h1("4. Diseño propuesto (opción B con edición de referencia)"));
c.push(H.h2("4.1 Esquema: un campo idioma clasificado por la edición de referencia"));
c.push(H.body("Se añade al modelo CulturaRecurso un único campo de texto, idioma, con el idioma de la edición o versión de referencia del recurso en código ISO 639-1 (en | es | pt; ampliable si la política cambia) y valor por defecto en en la migración, que clasifica correctamente los 64 registros vigentes sin backfill. La regla de clasificación es explícita y verificable: para libros, la edición que Cumbre30 enlaza (si la obra tiene edición traducida al inglés, se clasifica en aunque el original sea danés o neerlandés); para películas y documentales, la versión de distribución que se enlaza (audio o subtítulos en inglés la clasifican en). La versión 2 contemplaba un segundo campo (idiomaResena) para distinguir el idioma de la obra del idioma de su reseña; con la regla de la edición de referencia la reseña siempre comparte idioma con su ficha, y por eso se elimina del diseño: menos columnas, menos reglas, menos casos de prueba. El idioma original de las obras traducidas se anota en el campo extra ya existente (por ejemplo: Original en danés; narración en inglés de David Saunders) — sin columnas nuevas ni cambios de contrato."));
c.push(H.body("La semilla pasa a llevar idioma por entrada (la re-corre idempotente por título+tipo lo llena en los 64 vigentes) y el comentario del esquema que hoy dice «Reseña editorial propia (original de Cumbre30, es)» se actualiza a la nueva política (original de Cumbre30 en el idioma de la edición). La migración es aditiva pura (ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT), por lo que pasa el chequeo CT-M3 que el workflow de GitHub ejecuta en cada build (scripts/check-migrations-additive.js). Al ser una tabla pequeña, no se crea índice por idioma; el orden por destacado/año/título se mantiene. La aplicación se hace en tres pasos ya documentados en el proyecto: prisma db push contra el Postgres local de desarrollo, npx prisma migrate deploy contra la base de producción de Neon antes del despliegue (el buildCommand de Vercel solo ejecuta prisma generate, no migraciones) y el despliegue normal por push a main. La columna nueva con default no rompe la API ni el APK vigentes: sin downtime."));
c.push(H.h2("4.2 API: parámetro idioma"));
c.push(H.body("GET /api/cultura/recursos incorpora el parámetro opcional idioma con los tres valores (es | en | pt), combinable con los filtros existentes (tipo, cat, q, destacado). La validación replica el patrón actual: si el valor no está en la lista permitida se ignora (no error). Con la regla de la edición de referencia, el parámetro cubre el 100 % del catálogo desde el día uno: los 64 recursos vigentes responden al filtro (53 de origen inglés más las 11 con edición o versión en inglés), y lo mismo valdrá para los lotes ES y PT. La búsqueda q sigue operando sobre título y autor originales. El recurso de la respuesta ya incluye todos los campos, así que idioma viaja sin cambios adicionales en el contrato; el total refleja el filtro. Los favoritos no cambian: un favorito en inglés sigue accesible aunque el selector esté en español, porque la vista de favoritos es un filtro transversal independiente."));
c.push(H.h2("4.3 Interfaz: el selector como filtro principal"));
c.push(H.body("Conforme a la instrucción («al seleccionar cada uno cambia los recursos de la biblioteca, como un filtro principal»), el selector de idioma no es un ajuste escondido: es la primera fila de filtros del módulo, encima de las filas de tipo y categoría. Se propone un control segmentado con el patrón de chips existente: Biblioteca en: Todos · Español · Inglés · Portugués. Su comportamiento propuesto:"));
c.push(H.bullet("Valor inicial: el idioma de la interfaz (useLang), pero solo si ese idioma tiene recursos publicados; mientras el lote correspondiente no exista, el selector cae a Todos. Así se evita la biblioteca vacía en el día del lanzamiento: cuando los lotes ES y PT entren publicados, el preajuste automático empieza a operar sin cambios de código."));
c.push(H.bullet("Persistencia: la elección explícita del usuario se guarda en el dispositivo (clave propia de localStorage del módulo, mismo patrón que el resto de preferencias de la app) y no requiere cuenta; si inicia sesión en otro dispositivo, la elección vuelve al valor inicial."));
c.push(H.bullet("Alcance del filtro: afecta a destacados («Para empezar»), carruseles por categoría, resultados del buscador y la sección «Para tu perfil», que se recomputa con el subconjunto filtrado; si una sección queda vacía por el idioma, se muestra el estado vacío existente con un llamado «Ver todo el catálogo» que vuelve a Todos."));
c.push(H.bullet("Ficha del recurso: un único chip de idioma junto al tipo y al país (campo pais ya existente), con el idioma de la edición como valor del chip (En inglés) y, cuando la obra es traducida o subtitulada, el idioma original visible en la línea de datos de la ficha usando el campo extra (por ejemplo: Original en francés; versión internacional con subtítulos en inglés). No hacen falta chips de reseña ni de lenguas menores: el chip siempre es uno de los tres del selector."));
c.push(H.bullet("Mis favoritos: se mantiene como vista transversal con todos los idiomas (muestra el chip de idioma en cada tarjeta); filtrar favoritos por idioma también se respetaría si el selector está activo, decisión a validar en la implementación."));
c.push(H.body("El componente reutiliza el patrón de chips existente (mismas clases, accesibilidad aria según los atributos filtroTipoAria/filtroCatAria, nueva clave filtroIdiomaAria), de modo que el cambio visual es mínimo y coherente con el resto del módulo. Al estar en la primera fila, el selector cumple el rol de filtro principal sin desplazar los filtros de tipo y categoría, que quedan como segunda y tercera dimensión combinable."));
c.push(H.h2("4.4 La verificación de las 11 obras y la regla de reseñas"));
c.push(H.body("La versión 3 proponía depurar las 11 obras de origen no anglosajón; la pregunta de la conversación («de esos 11, ¿están en inglés?») obligó a verificarlo recurso por recurso con fuentes abiertas, y el resultado cambió el diseño: las 11 tienen edición o versión en inglés. La tabla siguiente documenta la verificación del 22-11-2026, con el nivel de evidencia alcanzado por obra: cinco confirmadas con fuente concreta (traducción publicada, narración inglesa, audio en Netflix, doblaje y subtítulos en Criterion, subtítulos en festival) y seis cubiertas por la distribución internacional estándar, cuya fuente concreta (URL de la edición que se enlazará) se confirma al implementar."));
c.push(H.tituloTabla("Tabla 2: verificación de la edición o versión en inglés de las 11 obras"));
c.push(H.tabla(
  ["Recurso", "Tipo", "Idioma original", "Edición o versión en inglés", "Verificación"],
  [
    ["The Rider (Tim Krabbé, 1978)", "libro", "Neerlandés", "Traducción al inglés de Sam Garrett publicada por Bloomsbury (2002; reedición 2018) y audiolibro en inglés", "Verificada (Bloomsbury y Audible)"],
    ["Ladri di biciclette (Ladrón de bicicletas)", "pelicula", "Italiano", "Edición Criterion («Bicycle Thieves»): doblaje opcional en inglés y subtítulos en inglés", "Verificada (Criterion)"],
    ["Tour de France: Unchained", "documental", "Francés", "Netflix ofrece audio en inglés (doblaje) además del original", "Verificada (sitio oficial Netflix)"],
    ["A Sunday in Hell", "documental", "Danés", "Versión internacional con narración en inglés de David Saunders", "Verificada (prensa ciclista)"],
    ["Wonderful Losers: A Different World", "documental", "Lituano (audio multilingüe)", "Exhibiciones internacionales con subtítulos en inglés", "Verificada (NY Baltic Film Festival)"],
    ["Les Triplettes de Belleville", "pelicula", "Francés", "Versión internacional de distribución con subtítulos en inglés (película de diálogos mínimos)", "Estándar; URL por confirmar al implementar"],
    ["Le gamin au vélo (El niño con la bici)", "pelicula", "Francés", "Distribución internacional con subtítulos en inglés", "Estándar; URL por confirmar al implementar"],
    ["Beijing Bicycle", "pelicula", "Chino (mandarín)", "Distribución internacional de festivales con subtítulos en inglés", "Estándar; URL por confirmar al implementar"],
    ["Wadjda", "pelicula", "Árabe", "Distribución internacional amplia (EE. UU. 2013) con subtítulos en inglés", "Estándar; URL por confirmar al implementar"],
    ["Stars and Water Carriers", "documental", "Danés", "Circula internacionalmente en versión inglesa (DVD y repositorios ciclistas)", "Estándar; URL por confirmar al implementar"],
    ["The Impossible Hour", "documental", "Danés", "Circula internacionalmente en versión inglesa (DVD y repositorios ciclistas)", "Estándar; URL por confirmar al implementar"],
  ],
  [22, 15, 15, 28, 20]
));
c.push(H.body("El criterio editorial que sale de esta verificación: cada recurso clasificado en inglés por edición de referencia debe tener en su ficha (campo enlace y campo extra) la edición o versión concreta que lo respalda — la URL de la editorial o plataforma que ofrece la traducción, el doblaje o los subtítulos. Para las cinco ya verificadas, la fuente queda citada en esta tabla; para las seis restantes, la confirmación de la URL es una tarea de implementación de media hora, no una suposición. Si alguna de las seis no tuviera finalmente una versión en inglés localizable, ese recurso se re-evaluaría caso a caso (edición alternativa u eliminación puntual), pero la evidencia actual indica que la regla del inglés universal se sostiene para las once."));
c.push(H.body("La regla editorial nueva queda simple y sin excepciones: la reseña de cada recurso se escribe en el idioma de su edición de referencia —inglés en el catálogo vigente (incluidas las 11), español en el lote ES, portugués en el lote PT—, en lugar de la regla anterior de reseñas siempre en español. La consecuencia inmediata es una migración editorial: las 64 reseñas vigentes están en español y se reescriben a inglés. El mecanismo no requiere scripts nuevos: la reseña vive en la semilla, que es la fuente única del texto, así que la reescritura se hace editando scripts/semilla-cultura.mjs y re-corriendo el script idempotente, que actualiza reseña e idioma en los 64 registros. Para la reescritura se propone borrador asistido por LLM de cada reseña (traducción del texto propio de Cumbre30, no de proveedores) más una pasada humana de estilo: reseñas cortas de 2 a 4 frases, tono editorial existente, sin calcos, con un glosario de términos ciclistas para consistencia (gregario, contrarreloj, pavé). Traducir contenido propio no viola la regla inquebrantable de la ingesta (nunca texto copiado de proveedores), que sigue intacta."));
c.push(H.h2("4.5 Lotes editoriales en español y portugués"));
c.push(H.body("El contenido sigue siendo la parte crítica y por eso no se inventa: se cura con el flujo ya previsto del módulo. Las reglas editoriales de la semilla se mantienen íntegras: solo obras reales y verificables, año solo cuando es seguro (null en caso contrario), enlaces externos de búsqueda o acceso legítimos (nunca simulación de reproducción o compra), reseña original propia en el idioma del lote, y una entrada solo si el ciclismo es protagonista o marco central de la obra. Dos semillas nuevas (scripts/semilla-cultura-es.mjs y scripts/semilla-cultura-pt.mjs, idempotentes por título+tipo+idioma) crean las entradas como borradores (publicado=false): la suite de cultura ya verifica que los borradores no se publican, de modo que los lotes entran a revisión sin tocar la biblioteca pública hasta que el equipo marque publicado=true por oleadas."));
c.push(H.body("La distribución sugerida es de 25 a 40 recursos para el lote en español (biografías de ciclistas iberoamericanos, crónicas de viaje, ensayo histórico, películas y documentales iberoamericanos y guías locales relevantes para Chile y América Latina) y de 15 a 30 para el lote en portugués, más acotado por el tamaño de la audiencia pt de la app (ciclismo brasileño de MTB y cicloturismo, historia del ciclismo portugués). En cada lote la reseña se escribe directamente en el idioma del lote — así la regla del idioma se cumple desde el origen y ningún recurso nace con reseña discontinuada. Las seis categorías y el sistema de destacados se usan igual que en el catálogo vigente; las vías de verificación por recurso quedan descritas en la sección 5."));
c.push(H.h2("4.6 Ingesta multilingüe"));
c.push(H.body("El script de ingesta se extiende con la restricción de idioma según el campo idioma del recurso: en Open Library la búsqueda añade language:spa para es y language:por para pt; en Google Books langRestrict=es o langRestrict=pt; en TMDB language=es-CL o language=pt-BR (la variante brasileña es la de mayor audiencia ciclista del portugués y TMDB la soporta directamente). Las reglas del módulo no cambian: la ingesta solo completa campos vacíos (año, país, extra, portadaUrl), jamás toca reseña, autor, categorías o enlace de la semilla, y las portadas se siguen aceptando solo de Open Library. Los documentales en español y portugués suelen carecer de ficha en Open Library: es esperable que queden sin portada y con el estilo procedural del módulo (paleta determinista por recurso), que ya se ve bien en el catálogo actual."));
c.push(H.h2("4.7 Textos e i18n"));
c.push(H.body("Se añaden las claves de traducción en las tres lenguas: título y etiquetas del selector (cu.idiomaTitulo, cu.idiomaTodos, cu.idiomaEs, cu.idiomaEn, cu.idiomaPt), atributo de accesibilidad (cu.filtroIdiomaAria), chip de ficha (cu.fichaIdioma) y los estados vacíos por idioma con su llamado a ver todo el catálogo (cu.vacioIdioma y cu.vacioIdiomaCta). Las etiquetas de idioma se muestran con su nombre propio (Español, English, Português) en las tres interfaces, convención común para lenguas. La versión 2 contemplaba además un chip de idioma de reseña (cu.fichaResenaIdioma): con la regla sin excepciones de la v4 ya no aporta información, así que se elimina del diseño."));
c.push(H.h2("4.8 Traducción dinámica de reseñas (futura, fuera de alcance de esta fase)"));
c.push(H.body("La instrucción deja la traducción dinámica para una evaluación posterior; este diseño se limita a no cerrarle la puerta. Los tres enfoques posibles son: (a) pre-traducir todas las reseñas por lote y guardarlas en una columna JSONB traducciones con claves es/en/pt; (b) traducción bajo demanda con caché persistida: la ficha pide la reseña al backend, que si no tiene la variante en el idioma de la interfaz la genera con un modelo de lenguaje, la guarda y sirve siempre la misma traducción; y (c) traducción solo al pulsar («Traducir reseña»), sin caché. La recomendación preliminar es (b): el volumen total previsto es de unas 104 a 134 reseñas (64 vigentes + 25-40 ES + 15-30 PT), costo de traducción trivial, la caché hace la experiencia consistente y la etiqueta «traducción automática» con revisión humana opcional por oleadas cubre el riesgo de calidad. Dos condiciones de esta fase dejan el camino limpio: el campo idioma identifica el idioma fuente de cada reseña (dato imprescindible para traducir bien) y la política aditiva CT-M3 permite añadir la columna de traducciones más adelante sin migración disruptiva. Nada de esto se implementa en la fase actual."));
c.push(H.h2("4.9 Pruebas"));
c.push(H.body("La suite de cultura (tests/cultura.test.ts, 35 verificaciones actualmente) se extiende para que el criterio quede automatizado (se estiman 8 a 10 aserciones nuevas): filtro idioma=es e idioma=pt devuelven solo recursos de ese idioma y son combinables con tipo, categoría y búsqueda; el filtro idioma=en incluye las 11 obras de edición de referencia inglesa (ninguna obra queda fuera de los tres botones); la ficha de una obra traducida muestra el idioma original en el campo extra; tras la reescritura, la reseña servida del catálogo vigente está en inglés y el campo idioma lo refleja; un borrador ES o PT no aparece público; la ficha muestra el chip de idioma; y el selector persiste su elección y cae a Todos cuando el idioma elegido no tiene recursos. Las aserciones existentes siguen siendo verdaderas sin tocarlas (el catálogo no cambia de tamaño: sigue en 64, margen holgado sobre la aserción de «al menos 50»)."));
c.push(H.h2("4.10 Despliegue y verificación"));
c.push(H.body("El orden propuesto: (1) conteo del catálogo de producción y confirmación de las URLs de edición de referencia para las seis obras pendientes de la Tabla 2; (2) migración aditiva (campo idioma) y db push local; (3) semilla re-corrida con idiomas y reseñas reescritas, y semillas ES y PT como borradores; (4) código de API y UI con pruebas en verde; (5) revisión editorial de los lotes y paso a publicado por oleadas; (6) migrate deploy contra Neon y actualización de datos en producción con las mismas semillas; (7) push a main (despliegue Vercel automático); (8) verificación en producción: catálogo filtrado por idioma desde la web y desde el APK, conteo final (64 + lote publicado) y suite de cultura 7/7 verde en el entorno de base de datos real. Las descargas del APK vigente no se afectan: la columna nueva no cambia el contrato de la API para el cliente actual, que ignora campos desconocidos."));

c.push(H.h1("5. Lotes iniciales: candidatos de partida"));
c.push(H.body("La tabla siguiente ilustra la forma de las entradas de ambos lotes con candidatos de partida REALES pero SIN VERIFICAR: ninguna se publica sin confirmar primero su existencia, año, autor y enlace mediante las vías descritas. Son puntos de búsqueda, no fichas aprobadas; las filas en portugués incorporan la ampliación de la instrucción v2."));
c.push(H.tituloTabla("Tabla 3: candidatos de partida (pendientes de verificación editorial)"));
c.push(H.tabla(
  ["Candidato", "Lote", "Tipo", "Por qué encaja", "Verificación"],
  [
    ["«El ciclista» de Tim Krabbé en su edición en español", "ES", "libro", "La novela ciclística más citada del catálogo actual (The Rider, 1978); si existe edición traducida, es el puente perfecto entre ambas bibliotecas", "Open Library language:spa; catálogos editoriales"],
    ["Biografía o documental de Federico Martín Bahamontes", "ES", "documental / libro", "Primer español ganador del Tour (1959): figura central del ciclismo en español", "TMDB/IMDb en es-CL; Open Library es"],
    ["Documentales de Miguel Indurain (5 Tours, 1991-1995)", "ES", "documental", "Referencia iberoamericana de máxima relevancia para la audiencia", "TMDB/IMDb búsqueda es-CL"],
    ["Literatura y crónica ciclista latinoamericana contemporánea", "ES", "libro", "Autores en español con viajes o relatos sobre dos ruedas; contenido ausente en catálogos extranjeros", "Open Library language:spa «bicicleta viaje»"],
    ["Guías y referencias de MTB y rutas de Chile", "ES", "libro / documental", "La audiencia de la app es chilena (cumbregeo.cl): guías locales aportan lo que ningún catálogo extranjero tiene", "Editoriales y bibliotecas nacionales; turismo local"],
    ["Documental o biografía de Joaquim Agostinho", "PT", "documental / libro", "Histórico ciclista portugués del Tour de los años 1970: figura central del ciclismo portugués", "TMDB/IMDb pt-BR; archivos RTP"],
    ["Literatura y guías ciclistas de Brasil (MTB y cicloturismo)", "PT", "libro", "Brasil es la mayor audiencia ciclista del portugués; contenido ausente en catálogos anglosajones", "Open Library language:por «bicicleta»"],
  ],
  [26, 8, 14, 30, 22]
));
c.push(H.body("El criterio de aprobación por recurso queda así: obra confirmada por al menos una fuente con URL verificada; año y autor completados solo con evidencia; enlace externo de búsqueda legítimo; reseña original en el idioma del lote de 2 a 4 frases; categorías dentro de las seis del spec; y marcado destacado solo para la selección de entrada. El flujo borrador → publicado permite crear las fichas sin prisa y publicar cada lote por oleadas, idioma por idioma."));

c.push(H.h1("6. Plan de implementación y esfuerzo"));
c.push(H.tituloTabla("Tabla 4: fases, entregables y esfuerzo estimado"));
c.push(H.tabla(
  ["Fase", "Trabajo", "Archivos", "Esfuerzo"],
  [
    ["F1 · Esquema", "Campo idioma + migración aditiva única + db push local", "prisma/schema.prisma, prisma/migrations/*", "0,5 h"],
    ["F2 · API", "Parámetro idioma (es|en|pt) con validación y filtro combinable", "src/app/api/cultura/recursos/route.ts", "0,5 h"],
    ["F3 · UI", "Selector principal (primera fila), chip de idioma en ficha, estados vacíos, memoria en dispositivo", "src/components/CulturaView.tsx", "2 h"],
    ["F4 · i18n", "Claves cu.idioma* en es/en/pt", "src/lib/i18n.ts", "0,5 h"],
    ["F5 · Verificación y reseñas", "Confirmación de la URL de edición de referencia para las 6 obras pendientes de la Tabla 2 + reescritura de las 64 reseñas es→en con borrador LLM + pasada humana", "scripts/semilla-cultura.mjs", "3,5-5,5 h"],
    ["F6 · Semilla ES", "Lote de 25-40 recursos como borradores + revisión editorial + publicado", "scripts/semilla-cultura-es.mjs", "2-4 h (curación)"],
    ["F7 · Semilla PT", "Lote de 15-30 recursos como borradores + revisión editorial + publicado", "scripts/semilla-cultura-pt.mjs", "1,5-3 h (curación)"],
    ["F8 · Ingesta", "Restricción es/pt en Open Library, Google Books y TMDB", "scripts/ingesta-cultura.mjs", "0,5 h"],
    ["F9 · Pruebas", "Extensión de la suite de cultura (+8-10 verificaciones)", "tests/cultura.test.ts", "1 h"],
    ["F10 · Despliegue", "migrate deploy Neon + actualización de datos + push + verificación", "—", "0,5 h"],
  ],
  [16, 36, 30, 18]
));
c.push(H.body("Total estimado: 12 a 17,5 horas técnicas y editoriales (5,5 horas fijas más 6,5 a 12 horas de contenido y verificación). La regla de la edición de referencia deja el esfuerzo casi idéntico al de la versión 2 pero con un diseño mejor: no hay borrado ni operaciones de datos riesgosas (la F5 de la v3 desaparece y se sustituye por la verificación de URLs), el catálogo conserva su tamaño y sus destacados, y la reescritura de reseñas vuelve a las 64 previstas. El orden interno importa: la verificación de las URLs y las semillas van primero (el código de API y UI es más simple de verificar con datos ya clasificados), la reescritura de reseñas puede avanzar en paralelo con F2-F4 porque es contenido, no código, y la revisión editorial de los lotes puede prolongarse en el tiempo sin bloquear el despliegue porque los borradores no se publican."));
c.push(H.h2("6.1 Riesgos y mitigaciones"));
c.push(H.bullet("Clasificación por edición de referencia mal documentada: clasificar una obra danesa como en sin citar la versión concreta convertía la regla en una suposición. Mitigación: la ficha debe citar la edición o versión (URL verificable en el campo enlace, nota de idioma original en extra); cinco obras ya verificadas con fuente y seis con URL por confirmar como tarea de F5; si una no se confirma, se re-evalúa ese recurso puntualmente."));
c.push(H.bullet("Ambigüedad semántica del campo idioma: significa «idioma de la edición de referencia», no «idioma original». Mitigación: el comentario del esquema y la documentación del módulo lo definen explícitamente, y el campo extra muestra el idioma original en la ficha para que el lector no se sienta engañado."));
c.push(H.bullet("Calidad de las reseñas reescritas: el riesgo principal editorial es que el inglés traducido suene artificial. Mitigación: borrador LLM del texto propio más pasada humana obligatoria, reseñas cortas (2-4 frases) y glosario de términos ciclistas para consistencia (gregario, contrarreloj, pavé)."));
c.push(H.bullet("Desfase 64/65 del catálogo: la v1 citó 65 registros; la verificación local arroja 64. Antes de actualizar producción se cuenta el catálogo y se aplican las semillas idempotentes; cualquier registro fuera de la semilla se revisa a mano."));
c.push(H.bullet("Biblioteca vacía al lanzamiento: el preajuste al idioma de interfaz solo opera cuando ese idioma tiene recursos publicados; mientras tanto el selector cae a Todos y el estado vacío ofrece «Ver todo el catálogo»."));
c.push(H.bullet("Cobertura de metadatos ES/PT: los documentales iberoamericanos y brasileños casi no tienen ficha en Open Library (portada y año vacíos); el módulo ya compensa con la portada procedural y el campo extra de la semilla, y TMDB requiere clave propia (sin clave, se dejan esos campos vacíos)."));
c.push(H.bullet("Migración: aditiva pura (CT-M3) con default, sin downtime; se aplica a Neon antes del despliegue porque el build de Vercel no ejecuta migraciones."));
c.push(H.bullet("Compatibilidad del APK vigente: el contrato de respuesta no cambia (campo nuevo incluido en el recurso); el APK actual ignora los campos desconocidos y sigue funcionando."));

c.push(H.h1("7. Criterio de aceptación y conclusión"));
c.push(H.tituloTabla("Tabla 5: checklist de aceptación de la propuesta v4"));
c.push(H.tabla(
  ["#", "Condición", "Verificación"],
  [
    ["1", "El catálogo distingue el idioma de la edición de referencia", "Campo idioma en esquema y migración aditiva aplicada; los 64 vigentes clasificados en en"],
    ["2", "Las 11 obras responden al selector con respaldo verificable", "Las 11 de la Tabla 2 con idioma=en y su idioma original anotado en extra; las 5 fuentes citadas y las 6 URLs restantes confirmadas en F5"],
    ["3", "Las reseñas están en el idioma de la edición", "Las 64 reseñas vigentes servidas en inglés tras la reescritura; lotes ES/PT nacen en su idioma"],
    ["4", "El selector principal de idioma existe y manda", "Segmentado Todos · Español · Inglés · Portugués como primera fila de filtros; persiste en el dispositivo; preajuste al idioma de interfaz con caída a Todos"],
    ["5", "La biblioteca responde al selector", "Destacados, carruseles, buscador y «Para tu perfil» muestran solo el idioma elegido; estado vacío con llamado a Todos; el 100 % del catálogo es alcanzable desde el selector"],
    ["6", "La API filtra por idioma", "idioma=es e idioma=pt combinables con tipo/cat/q/destacado; verificadas en la suite con DB real"],
    ["7", "Existen los lotes editoriales ES y PT", "25-40 fichas en español y 15-30 en portugués creadas como borradores y publicadas por oleadas tras revisión con URL verificada"],
    ["8", "Sin regresiones", "Suite de cultura extendida en verde (35 + 8-10 verificaciones) y resto de suites sin cambios"],
  ],
  [8, 34, 58]
));
c.push(H.body("Conclusión: la pregunta de la conversación —de esos 11, ¿están en inglés?— resultó decisiva y mejoró la propuesta. La verificación por recurso demostró que el inglés universal se sostiene en los hechos: la obra clave del catálogo tiene traducción publicada en inglés (Bloomsbury), el documental clave tiene narración inglesa, la serie actual ofrece audio en inglés en Netflix y las películas se distribuyen con doblaje o subtítulos (la edición Criterion de Bicycle Thieves incluye hasta subtítulos en portugués). Con la regla del idioma de la edición de referencia, la biblioteca queda íntegramente clasificada en las tres lenguas sin borrar nada: el 100 % del catálogo responde al selector principal, la reseña va en el idioma de la ficha sin excepciones y el diseño se reduce a un único campo aditivo con migración CT-M3 (12 a 17,5 horas técnicas y editoriales). La única disciplina nueva es editorial, y conviene mantenerla: cada clasificación debe citar la edición que la respalda, porque «el inglés es universal» es una buena regla de partida, pero la URL concreta es la que la convierte en dato verificable. El ciclista en español o en portugués abre el módulo y encuentra primero la biblioteca en su idioma, cada reseña en la lengua de su ficha y ninguna obra perdida en el camino."));

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
