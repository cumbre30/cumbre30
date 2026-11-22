// ============================================================
// gen_propuesta_cultura_es.js — Propuesta de revisión del módulo
// Cultura Ciclista (DOCX, portada R1 + TOC). SOLO PROPUESTA: no
// implementa nada en la app.
// v2 (2026-11-22): opción B ampliada — lote portugués, selector como
// filtro principal y reseñas en el idioma de la ficha.
// v3 (2026-11-22): decisión confirmada en conversación — depurar los
// 11 recursos cuyo idioma original no es es/en/pt; el catálogo parte
// solo con las tres lenguas, lo que simplifica el diseño a UN campo
// de idioma (sin idiomaResena ni reseñas puente) y deja los 11 como
// catálogo de reserva para re-incorporar con la traducción dinámica.
// Datos citados: verificados en esta sesión (semilla 64, PostgreSQL
// local, API, UI, i18n, FK cultura_favoritos onDelete: Cascade).
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
    "Versión 3 · incorpora la depuración de los 11 recursos fuera de es/en/pt (el catálogo parte solo con inglés, español y portugués)",
    "Base: 64 recursos hoy (33·10·21) → 53 tras depuración (32·5·16) · 7 destacados",
    "Fecha: 22 de noviembre de 2026",
  ],
  footerLeft: "Cumbre30 · Cultura Ciclista",
  footerRight: "Propuesta de diseño v3",
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
c.push(H.body("El encargo original pedía revisar el módulo Cultura Ciclista para incorporar recursos en español y un botón principal de idioma que mostrara la biblioteca según esa elección. Sobre la propuesta documentada en la versión 1, la instrucción confirmada el 22 de noviembre de 2026 tomó tres decisiones: adoptar la opción B recomendada, extenderla al portugués (recursos en español y portugués que cambian la biblioteca al seleccionarlos, como filtro principal) y modificar la política editorial de las reseñas, que dejarán de estar todas en español para estar en el idioma del recurso, dejando la traducción dinámica para una evaluación posterior. En la conversación de este mismo día se añadió una cuarta decisión, evaluada en este documento con resultado favorable: eliminar los recursos cuyo idioma original no es inglés, español o portugués, para partir con una biblioteca organizada íntegramente en torno a las tres lenguas. Esta versión 3 actualiza el diseño con las cuatro; sigue sin implementar nada en la aplicación."));
c.push(H.body("El diagnóstico queda verificado directamente en PostgreSQL local el mismo día: 64 recursos publicados (33 libros, 10 películas y 21 documentales), 10 destacados, las seis categorías en uso, ninguna obra en español o portugués y 64 reseñas editoriales escritas todas en español. De esos 64, exactamente 11 tienen su idioma original fuera del trío es/en/pt (1 libro, 5 películas y 5 documentales; 3 de ellos destacados): la depuración deja el catálogo en 53 recursos (32 libros, 5 películas y 16 documentales, 7 destacados), todos en inglés hasta que entren los lotes nuevos. La depuración tiene además un efecto de diseño que es su mayor virtud: como cada recurso comparte idioma con su reseña, ya no hacen falta dos campos ni reglas puente — un solo campo idioma basta y el filtro principal cubre el 100 % del catálogo."));
c.push(H.body("La recomendación consolidada es: depurar los 11 recursos (borrado explícito en base y semilla, con favoritos en cascada según la FK confirmada del esquema), añadir un único campo aditivo idioma (migración CT-M3), el selector principal como primera fila de filtros (Todos · Español · Inglés · Portugués, con persistencia en el dispositivo), el parámetro idioma en la API, dos lotes editoriales como borradores (español de 25 a 40 recursos, portugués de 15 a 30), la reescritura de las 53 reseñas vigentes al inglés (borrador asistido por LLM más pasada humana) y la suite de cultura extendida. El esfuerzo estimado queda en 12 a 17 horas técnicas y editoriales; la sección 6 detalla el reparto. Los 11 recursos depurados quedan documentados como catálogo de reserva (sección 4.4): obras de referencia cuya re-incorporación conviene evaluar cuando exista la traducción dinámica de reseñas, con la que cualquier lector podría leerlas en su idioma de interfaz."));

c.push(H.h1("2. Estado actual del módulo"));
c.push(H.h2("2.1 Datos: modelo y contenido actual"));
c.push(H.body("El catálogo vive en la tabla propia cultura_recursos (Prisma, modelo CulturaRecurso), alimentada por una semilla editorial curada a mano (scripts/semilla-cultura.mjs, idempotente por título+tipo) y enriquecida offline por la ingesta de metadatos (scripts/ingesta-cultura.mjs). Cada recurso tiene título, reseña editorial original, tipo (libro | pelicula | documental), categorías (mtb, aventura, historia, ruta, entrenamiento, personas), autor o director, país, año, dato extra, portada opcional, enlace externo legítimo, proveedor del metadato y dos banderas de flujo: publicado (borrador → revisión → publicado) y destacado (fila superior del módulo). No existe ningún campo de idioma; el país sí, pero el idioma de la obra solo se infiere de su título. Los favoritos (cultura_favoritos) referencian el recurso con borrado en cascada (onDelete: Cascade confirmado en el esquema), lo que hace la depuración mecánicamente segura: al borrar un recurso desaparecen con él sus favoritos, sin bloqueos de integridad."));
c.push(H.body("El contenido actual, verificado el 22 de noviembre de 2026 contra la base local de PostgreSQL y contra el script de semilla, es: 33 libros, 10 películas y 21 documentales —64 registros publicados—, 10 destacados y las seis categorías en uso. Los títulos provienen de autores y productoras extranjeros: The Rider (Tim Krabbé, 1978), It's Not About the Bike (Lance Armstrong y Sally Jenkins, 2000), The Secret Race (Tyler Hamilton y Daniel Coyle, 2012), Full Tilt: Ireland to India with a Bicycle (Dervla Murphy, 1965) o Bicycle: The History (David V. Herlihy, 2004), entre otros. La búsqueda de títulos en español sobre la semilla devuelve cero coincidencias: no hay ni un recurso en español ni en portugués."));
c.push(H.body("Nota de verificación: la versión 1 de este documento citaba 65 registros (34 libros). El conteo directo del 22-11-2026 en PostgreSQL local arroja 64 publicados coincidentes con la semilla; la cifra de 65 provenía de una corrida anterior. Antes de ejecutar la depuración en producción (Neon) se contará el catálogo directamente para resolver cualquier desfase y respaldar el borrado con la lista cerrada de títulos de la sección 4.4."));
c.push(H.body("Sobre el idioma original de las obras: 53 de los 64 recursos son de origen inglés; los 11 restantes (17,2 %) provienen de otras lenguas —The Rider es neerlandesa, Ladri di biciclette italiana, Les Triplettes de Belleville y Le gamin au vélo francesas, el tríptico de Jørgen Leth (A Sunday in Hell, Stars and Water Carriers, The Impossible Hour) danés, Beijing Bicycle china, Wadjda árabe y Wonderful Losers lituana, además de la serie Tour de France: Unchained (producción francesa)—. La decisión de la versión 3 es partir sin ellos: con la biblioteca limitada a las tres lenguas de la app, la regla «la reseña va en el idioma del recurso» se cumple sin excepciones y ningún recurso queda fuera del alcance del selector principal. El costo es real pero acotado, y se documenta en la sección 4.4 junto con su mitigación (catálogo de reserva)."));
c.push(H.h2("2.2 API y cliente"));
c.push(H.body("La API de catálogo (GET /api/cultura/recursos) exige sesión y acepta cuatro filtros combinables: tipo, cat (categoría), q (búsqueda insensible por título y autor) y destacado=1; la respuesta incluye los recursos ordenados (destacado, año, título), el arreglo de favoritos del usuario y el total. La interfaz (src/components/CulturaView.tsx) llama a la API sin parámetros, guarda la lista completa en el estado y aplica sus filtros en el cliente mediante un memo (matches) que combina búsqueda, tipo, categoría y solo-favoritos. Este patrón significa que agregar el filtro de idioma en la UI no exige ninguna segunda petición: basta incluir el campo nuevo en la respuesta (el recurso viaja completo) y añadir una condición al memo."));
c.push(H.h2("2.3 Idiomas de la interfaz y selector global"));
c.push(H.body("La aplicación soporta tres idiomas de interfaz (es | en | pt) con sistema propio de traducción (src/lib/i18n.ts: hook useLang, función setLang, diccionario con las tres variantes por clave). El módulo Cultura ya tiene traducidas todas sus etiquetas (claves cu.*: hero, buscador, chips de tipo, categorías, destacados, ficha, resultados y estados vacíos) y el selector global de idioma vive en la pestaña de configuración (ConfigTab). El usuario puede estar viendo la interfaz en español y aun así encontrarse una biblioteca íntegramente extranjera: esa descoordinación es justamente lo que el encargo quiere resolver."));
c.push(H.h2("2.4 Ingesta de metadatos"));
c.push(H.body("La ingesta enriquece el catálogo con tres proveedores: Open Library (sin clave: año, páginas y portada desde covers.openlibrary.org, el único con uso de imagen permitido), Google Books (opcional, con GOOGLE_BOOKS_API_KEY) y TMDB (requiere TMDB_API_KEY; aporta año, duración y país de películas y documentales, pero sus imágenes no se usan por defecto). La ingesta se ejecuta en seco por defecto y con --aplicar para escribir; en la corrida del 22 de noviembre aplicó 24 enriquecimientos de Open Library sin fallos. Los tres proveedores admiten restricción por idioma (language:spa / language:por en Open Library, langRestrict=es / pt en Google Books y language=es-CL / pt-BR en TMDB), así que el mecanismo actual sirve igual para el lote en español que para el portugués casi sin cambios."));

c.push(H.h1("3. Opciones evaluadas"));
c.push(H.body("Se evaluaron cuatro caminos, del cambio nulo a la localización completa. La tabla siguiente los compara en la formulación v3; después se argumenta la recomendación adoptada."));
c.push(H.tituloTabla("Tabla 1: comparación de opciones"));
c.push(H.tabla(
  ["Opción", "Qué implica", "Ventajas", "Costo / riesgo"],
  [
    ["A · Solo añadir recursos en español al catálogo mixto", "Nueva semilla ES sin cambios de esquema ni UI", "Cero código; visible de inmediato", "El usuario no puede elegir idioma ni preferirlo; el lote se diluye entre 64 extranjeros"],
    ["B · Depuración + campo idioma + selector principal + lotes ES y PT (adoptada)", "Borrado de los 11 fuera de es/en/pt, un campo aditivo, filtro en API y UI, semillas ES/PT como borradores, reseñas en el idioma del recurso", "Biblioteca 100 % filtrable por las tres lenguas, regla de reseñas sin excepciones, esquema mínimo (un campo); reusa i18n y el filtro en cliente", "Pierde obras de referencia (mitigado con catálogo de reserva); curación de dos lotes y reescritura de 53 reseñas"],
    ["C · Biblioteca por idioma de interfaz con reseñas traducidas", "Duplicar reseñas y datos por idioma (contenido localizado)", "Experiencia íntegramente traducida", "Duplica el trabajo editorial permanente; acopla catálogo al idioma de la UI; su parte útil entra como traducción dinámica futura"],
    ["D · Ficha multilingüe por recurso (título original + traducción)", "Campos adicionales por recurso y visual comparativa", "Rico para obras traducidas", "Alta complejidad de datos y UI; beneficia a pocas obras; futuro"],
  ],
  [26, 30, 22, 22]
));
c.push(H.body("El usuario adoptó la opción B y la precisó en tres pasos sucesivos: el portugués como segundo idioma de biblioteca, la política de reseñas en el idioma del recurso (con traducción automática reservada para una evaluación posterior) y la depuración de los recursos cuyo idioma original cae fuera del trío, dado que se parte de cero en español y portugués. Con la depuración, el diseño pierde su única pieza forzada —la reseña puente en inglés para obras en otras lenguas— y gana simplicidad en esquema, API y ficha. La opción A sola queda descartada porque deja la petición de elección sin resolver, la C entra en el futuro como traducción dinámica y la D sigue siendo un posible desarrollo posterior."));

c.push(H.h1("4. Diseño propuesto (opción B ampliada y depurada)"));
c.push(H.h2("4.1 Esquema: un campo idioma y migración aditiva única"));
c.push(H.body("Se añade al modelo CulturaRecurso un único campo de texto, idioma, con el idioma original de la obra en código ISO 639-1 (en | es | pt en el catálogo vigente y previsto; ampliable si la política cambia), y valor por defecto en en la migración, que clasifica correctamente los 53 registros resultantes sin backfill. La versión 2 de este diseño contemplaba un segundo campo (idiomaResena) para distinguir el idioma de la obra del idioma de su reseña; la depuración lo vuelve innecesario —con el catálogo limitado a es/en/pt, la reseña siempre comparte idioma con su recurso— y por eso se elimina del diseño: menos columnas, menos reglas, menos casos de prueba. Si el futuro re-abre la puerta a obras de otras lenguas (catálogo de reserva), esa decisión se re-evaluará junto con la traducción dinámica, no antes."));
c.push(H.body("La semilla pasa a llevar idioma por entrada (la re-corre idempotente por título+tipo lo llena en los 53 vigentes) y el comentario del esquema que hoy dice «Reseña editorial propia (original de Cumbre30, es)» se actualiza a la nueva política (original de Cumbre30 en el idioma del recurso). La migración es aditiva pura (ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT), por lo que pasa el chequeo CT-M3 que el workflow de GitHub ejecuta en cada build (scripts/check-migrations-additive.js). Al ser una tabla pequeña, no se crea índice por idioma; el orden por destacado/año/título se mantiene. La aplicación se hace en tres pasos ya documentados en el proyecto: prisma db push contra el Postgres local de desarrollo, npx prisma migrate deploy contra la base de producción de Neon antes del despliegue (el buildCommand de Vercel solo ejecuta prisma generate, no migraciones) y el despliegue normal por push a main. La columna nueva con default no rompe la API ni el APK vigentes: sin downtime."));
c.push(H.h2("4.2 API: parámetro idioma"));
c.push(H.body("GET /api/cultura/recursos incorpora el parámetro opcional idioma con los tres valores (es | en | pt), combinable con los filtros existentes (tipo, cat, q, destacado). La validación replica el patrón actual: si el valor no está en la lista permitida se ignora (no error). Tras la depuración, el parámetro cubre el 100 % del catálogo: no queda ningún recurso visible solo bajo Todos, lo que elimina la ambigüedad de la versión 2 (los 11 recursos de lenguas menores). La búsqueda q sigue operando sobre título y autor originales. El recurso de la respuesta ya incluye todos los campos, así que idioma viaja sin cambios adicionales en el contrato; el total refleja el filtro. Los favoritos no cambian: un favorito en inglés sigue accesible aunque el selector esté en español, porque la vista de favoritos es un filtro transversal independiente."));
c.push(H.h2("4.3 Interfaz: el selector como filtro principal"));
c.push(H.body("Conforme a la instrucción («al seleccionar cada uno cambia los recursos de la biblioteca, como un filtro principal»), el selector de idioma no es un ajuste escondido: es la primera fila de filtros del módulo, encima de las filas de tipo y categoría. Se propone un control segmentado con el patrón de chips existente: Biblioteca en: Todos · Español · Inglés · Portugués. Su comportamiento propuesto:"));
c.push(H.bullet("Valor inicial: el idioma de la interfaz (useLang), pero solo si ese idioma tiene recursos publicados; mientras el lote correspondiente no exista, el selector cae a Todos. Así se evita la biblioteca vacía en el día del lanzamiento: cuando los lotes ES y PT entren publicados, el preajuste automático empieza a operar sin cambios de código."));
c.push(H.bullet("Persistencia: la elección explícita del usuario se guarda en el dispositivo (clave propia de localStorage del módulo, mismo patrón que el resto de preferencias de la app) y no requiere cuenta; si inicia sesión en otro dispositivo, la elección vuelve al valor inicial."));
c.push(H.bullet("Alcance del filtro: afecta a destacados («Para empezar»), carruseles por categoría, resultados del buscador y la sección «Para tu perfil», que se recomputa con el subconjunto filtrado; si una sección queda vacía por el idioma, se muestra el estado vacío existente con un llamado «Ver todo el catálogo» que vuelve a Todos."));
c.push(H.bullet("Ficha del recurso: un único chip de idioma junto al tipo y al país (campo pais ya existente). Con la depuración, el idioma del chip es siempre uno de los tres del selector —no hacen falta los chips de lenguas menores ni el chip de idioma de reseña que contemplaba la versión 2—."));
c.push(H.bullet("Mis favoritos: se mantiene como vista transversal con todos los idiomas (muestra el chip de idioma en cada tarjeta); filtrar favoritos por idioma también se respetaría si el selector está activo, decisión a validar en la implementación."));
c.push(H.body("El componente reutiliza el patrón de chips existente (mismas clases, accesibilidad aria según los atributos filtroTipoAria/filtroCatAria, nueva clave filtroIdiomaAria), de modo que el cambio visual es mínimo y coherente con el resto del módulo. Al estar en la primera fila, el selector cumple el rol de filtro principal sin desplazar los filtros de tipo y categoría, que quedan como segunda y tercera dimensión combinable."));
c.push(H.h2("4.4 Depuración de los 11 recursos y reseñas en el idioma del recurso"));
c.push(H.body("La depuración propuesta elimina del catálogo los 11 recursos cuyo idioma original no es es/en/pt. La mecánica tiene dos partes. En la semilla: se retiran las 11 entradas de scripts/semilla-cultura.mjs (la semilla idempotente no borra lo ausente, solo crea o actualiza, así que el borrado en base debe ser explícito: un DELETE por la lista cerrada de títulos, ejecutado una sola vez). En la base: antes del DELETE se cuenta el catálogo de producción para resolver el posible desfase 64/65 documentado en la sección 2.1 y para cuantificar los favoritos afectados; la FK onDelete: Cascade confirma que no hay bloqueo de integridad —los favoritos sobre los 11 desaparecen con ellos—, un efecto menor que conviene saber de antemano. Ningún recurso se borra sin respaldo: la tabla siguiente documenta la lista completa y sirve como lista de verificación del borrado."));
c.push(H.tituloTabla("Tabla 2: los 11 recursos a depurar (catálogo de reserva)"));
c.push(H.tabla(
  ["Recurso", "Tipo", "Idioma original", "Destacado hoy"],
  [
    ["The Rider (Tim Krabbé, 1978)", "libro", "Neerlandés", "Sí"],
    ["Ladri di biciclette (Ladrón de bicicletas)", "pelicula", "Italiano", "No"],
    ["Les Triplettes de Belleville", "pelicula", "Francés", "No"],
    ["Le gamin au vélo (El niño con la bici)", "pelicula", "Francés", "No"],
    ["Beijing Bicycle", "pelicula", "Chino (mandarín)", "No"],
    ["Wadjda", "pelicula", "Árabe", "No"],
    ["A Sunday in Hell", "documental", "Danés", "Sí"],
    ["Stars and Water Carriers", "documental", "Danés", "No"],
    ["The Impossible Hour", "documental", "Danés", "No"],
    ["Wonderful Losers: A Different World", "documental", "Lituano", "No"],
    ["Tour de France: Unchained", "documental", "Francés", "Sí"],
  ],
  [40, 18, 24, 18]
));
c.push(H.body("El costo de la depuración es la pérdida de obras de referencia del ciclismo —la novela ciclística más citada, la película italiana que llevó la bici al centro del cine universal, el tríptico documental de Jørgen Leth y la serie actual del Tour, tres de ellas destacadas— y deja la fila de películas en 5 fichas (de 10). Se acepta por dos razones: es coherente con la premisa de partir (una biblioteca organizada por idiomas no debe tener obras fuera de sus idiomas) y es reversible en el tiempo. Propuesta de mitigación: documentar la lista como catálogo de reserva y evaluar su re-incorporación cuando exista la traducción dinámica de reseñas —entonces el lector podría leer la reseña de The Rider en español aunque la obra esté en neerlandés—, junto con la decisión de tratamiento en el filtro (por ejemplo, un cuarto chip «Otros idiomas» o la clasificación por edición de referencia). Esta re-incorporación no forma parte del alcance actual."));
c.push(H.body("La regla editorial nueva queda simple y sin excepciones: la reseña de cada recurso se escribe en el idioma de su recurso —inglés en el catálogo vigente, español en el lote ES, portugués en el lote PT—, en lugar de la regla anterior de reseñas siempre en español. La consecuencia inmediata es una migración editorial: las 53 reseñas vigentes (tras la depuración) están en español y se reescriben a inglés. El mecanismo no requiere scripts nuevos: la reseña vive en la semilla, que es la fuente única del texto, así que la reescritura se hace editando scripts/semilla-cultura.mjs y re-corriendo el script idempotente, que actualiza reseña e idioma en los 53 registros. Para la reescritura se propone borrador asistido por LLM de cada reseña (traducción del texto propio de Cumbre30, no de proveedores) más una pasada humana de estilo: reseñas cortas de 2 a 4 frases, tono editorial existente, sin calcos, con un glosario de términos ciclistas para consistencia (gregario, contrarreloj, pavé). Traducir contenido propio no viola la regla inquebrantable de la ingesta (nunca texto copiado de proveedores), que sigue intacta."));
c.push(H.h2("4.5 Lotes editoriales en español y portugués"));
c.push(H.body("El contenido sigue siendo la parte crítica y por eso no se inventa: se cura con el flujo ya previsto del módulo. Las reglas editoriales de la semilla se mantienen íntegras: solo obras reales y verificables, año solo cuando es seguro (null en caso contrario), enlaces externos de búsqueda o acceso legítimos (nunca simulación de reproducción o compra), reseña original propia en el idioma del lote, y una entrada solo si el ciclismo es protagonista o marco central de la obra. Dos semillas nuevas (scripts/semilla-cultura-es.mjs y scripts/semilla-cultura-pt.mjs, idempotentes por título+tipo+idioma) crean las entradas como borradores (publicado=false): la suite de cultura ya verifica que los borradores no se publican, de modo que los lotes entran a revisión sin tocar la biblioteca pública hasta que el equipo marque publicado=true por oleadas."));
c.push(H.body("La distribución sugerida es de 25 a 40 recursos para el lote en español (biografías de ciclistas iberoamericanos, crónicas de viaje, ensayo histórico, películas y documentales iberoamericanos y guías locales relevantes para Chile y América Latina) y de 15 a 30 para el lote en portugués, más acotado por el tamaño de la audiencia pt de la app (ciclismo brasileño de MTB y cicloturismo, historia del ciclismo portugués). En cada lote la reseña se escribe directamente en el idioma del lote — así la regla del idioma se cumple desde el origen y ningún recurso nace con reseña discontinuada. Los lotes además reponen la fila de películas, que tras la depuración queda en 5 fichas. Las seis categorías y el sistema de destacados se usan igual que en el catálogo vigente; las vías de verificación por recurso quedan descritas en la sección 5."));
c.push(H.h2("4.6 Ingesta multilingüe"));
c.push(H.body("El script de ingesta se extiende con la restricción de idioma según el campo idioma del recurso: en Open Library la búsqueda añade language:spa para es y language:por para pt; en Google Books langRestrict=es o langRestrict=pt; en TMDB language=es-CL o language=pt-BR (la variante brasileña es la de mayor audiencia ciclista del portugués y TMDB la soporta directamente). Las reglas del módulo no cambian: la ingesta solo completa campos vacíos (año, país, extra, portadaUrl), jamás toca reseña, autor, categorías o enlace de la semilla, y las portadas se siguen aceptando solo de Open Library. Los documentales en español y portugués suelen carecer de ficha en Open Library: es esperable que queden sin portada y con el estilo procedural del módulo (paleta determinista por recurso), que ya se ve bien en el catálogo actual."));
c.push(H.h2("4.7 Textos e i18n"));
c.push(H.body("Se añaden las claves de traducción en las tres lenguas: título y etiquetas del selector (cu.idiomaTitulo, cu.idiomaTodos, cu.idiomaEs, cu.idiomaEn, cu.idiomaPt), atributo de accesibilidad (cu.filtroIdiomaAria), chip de ficha (cu.fichaIdioma) y los estados vacíos por idioma con su llamado a ver todo el catálogo (cu.vacioIdioma y cu.vacioIdiomaCta). Las etiquetas de idioma se muestran con su nombre propio (Español, English, Português) en las tres interfaces, convención común para lenguas. La versión 2 contemplaba además un chip de idioma de reseña (cu.fichaResenaIdioma): con la regla sin excepciones de la v3 ya no aporta información, así que se elimina del diseño."));
c.push(H.h2("4.8 Traducción dinámica de reseñas (futura, fuera de alcance de esta fase)"));
c.push(H.body("La instrucción deja la traducción dinámica para una evaluación posterior; este diseño se limita a no cerrarle la puerta. Los tres enfoques posibles son: (a) pre-traducir todas las reseñas por lote y guardarlas en una columna JSONB traducciones con claves es/en/pt; (b) traducción bajo demanda con caché persistida: la ficha pide la reseña al backend, que si no tiene la variante en el idioma de la interfaz la genera con un modelo de lenguaje, la guarda y sirve siempre la misma traducción; y (c) traducción solo al pulsar («Traducir reseña»), sin caché. La recomendación preliminar es (b): el volumen total previsto es de unas 93 a 123 reseñas (53 vigentes + 25-40 ES + 15-30 PT), costo de traducción trivial, la caché hace la experiencia consistente y la etiqueta «traducción automática» con revisión humana opcional por oleadas cubre el riesgo de calidad. Dos condiciones de esta fase dejan el camino limpio: el campo idioma identifica el idioma fuente de cada reseña (dato imprescindible para traducir bien) y la política aditiva CT-M3 permite añadir la columna de traducciones más adelante sin migración disruptiva. La traducción dinámica es además la puerta natural de re-incorporación del catálogo de reserva de la sección 4.4. Nada de esto se implementa en la fase actual."));
c.push(H.h2("4.9 Pruebas"));
c.push(H.body("La suite de cultura (tests/cultura.test.ts, 35 verificaciones actualmente) se extiende para que el criterio quede automatizado (se estiman 8 a 10 aserciones nuevas): filtro idioma=es e idioma=pt devuelven solo recursos de ese idioma y son combinables con tipo, categoría y búsqueda; los 11 recursos depurados no aparecen en ningún filtro ni bajo Todos; al depurar, los favoritos asociados desaparecen en cascada (verificación de integridad); tras la reescritura, la reseña servida del catálogo vigente está en inglés y el campo idioma lo refleja; un borrador ES o PT no aparece público; la ficha muestra el chip de idioma; y el selector persiste su elección y cae a Todos cuando el idioma elegido no tiene recursos. Las aserciones existentes siguen siendo verdaderas sin tocarlas, con un ajuste documentado: la de «al menos 50 recursos publicados» sigue en verde con 53 (el margen se recupera con los lotes publicados tras revisión)."));
c.push(H.h2("4.10 Despliegue y verificación"));
c.push(H.body("El orden propuesto: (1) conteo del catálogo de producción y respaldo de la lista de depuración; (2) migración aditiva (campo idioma) y db push local; (3) depuración en local (DELETE de los 11 + semilla re-corrida con idiomas y reseñas reescritas) y semillas ES y PT como borradores; (4) código de API y UI con pruebas en verde; (5) revisión editorial de los lotes y paso a publicado por oleadas; (6) migrate deploy contra Neon y ejecución de la depuración en producción con la misma lista cerrada; (7) push a main (despliegue Vercel automático); (8) verificación en producción: catálogo filtrado por idioma desde la web y desde el APK, conteo final (53 + lote publicado), favoritos intactos salvo los de los 11 depurados, y suite de cultura 7/7 verde en el entorno de base de datos real. Las descargas del APK vigente no se afectan: la columna nueva no cambia el contrato de la API para el cliente actual, que ignora campos desconocidos."));

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
    ["F5 · Depuración y reseñas", "Retirada de las 11 entradas de la semilla + DELETE en base con lista cerrada y conteo previo + reescritura de las 53 reseñas es→en con borrador LLM + pasada humana", "scripts/semilla-cultura.mjs, SQL de depuración", "3-4,5 h"],
    ["F6 · Semilla ES", "Lote de 25-40 recursos como borradores + revisión editorial + publicado", "scripts/semilla-cultura-es.mjs", "2-4 h (curación)"],
    ["F7 · Semilla PT", "Lote de 15-30 recursos como borradores + revisión editorial + publicado", "scripts/semilla-cultura-pt.mjs", "1,5-3 h (curación)"],
    ["F8 · Ingesta", "Restricción es/pt en Open Library, Google Books y TMDB", "scripts/ingesta-cultura.mjs", "0,5 h"],
    ["F9 · Pruebas", "Extensión de la suite de cultura (+8-10 verificaciones)", "tests/cultura.test.ts", "1 h"],
    ["F10 · Despliegue", "migrate deploy Neon + depuración en producción + push + verificación", "—", "0,5 h"],
  ],
  [16, 36, 30, 18]
));
c.push(H.body("Total estimado: 12 a 17 horas técnicas y editoriales (5,5 horas fijas más 6,5 a 11,5 horas de contenido y depuración). El efecto neto de la depuración es casi neutro en esfuerzo —las 53 reescrituras (3-4,5 h) compensan parcialmente las 64 de la versión 2 (3-5 h), a la vez que elimina del diseño el segundo campo, los chips de reseña y los casos puente—, y claramente positivo en simplicidad y coherencia del producto. El orden interno importa: depuración y semillas van primero (el código de API y UI es más simple de verificar con datos ya depurados), la reescritura de reseñas puede avanzar en paralelo con F2-F4 porque es contenido, no código, y la revisión editorial de los lotes puede prolongarse en el tiempo sin bloquear el despliegue porque los borradores no se publican."));
c.push(H.h2("6.1 Riesgos y mitigaciones"));
c.push(H.bullet("Pérdida de obras de referencia: la depuración retira la novela ciclística más citada, el tríptico documental de Leth y la serie actual del Tour (3 destacados), y deja la fila de películas en 5 fichas. Mitigación: catálogo de reserva documentado en la Tabla 2, re-incorporación evaluable con la traducción dinámica, y los lotes ES/PT reponen películas y documentales desde su primera oleada."));
c.push(H.bullet("Favoritos de usuarios en producción: si algún usuario guardó alguno de los 11, el favorito desaparece con el recurso (cascada confirmada). Mitigación: contar los favoritos afectados antes del DELETE en Neon y comunicar el efecto si fuera significativo."));
c.push(H.bullet("Calidad de las reseñas reescritas: el riesgo principal editorial es que el inglés traducido suene artificial. Mitigación: borrador LLM del texto propio más pasada humana obligatoria, reseñas cortas (2-4 frases) y glosario de términos ciclistas para consistencia (gregario, contrarreloj, pavé)."));
c.push(H.bullet("Desfase 64/65 del catálogo: la v1 citó 65 registros; la verificación local arroja 64. Antes del DELETE en producción se cuenta el catálogo y se aplica la lista cerrada de títulos; cualquier registro fuera de lista se revisa a mano."));
c.push(H.bullet("Biblioteca vacía al lanzamiento: el preajuste al idioma de interfaz solo opera cuando ese idioma tiene recursos publicados; mientras tanto el selector cae a Todos y el estado vacío ofrece «Ver todo el catálogo»."));
c.push(H.bullet("Cobertura de metadatos ES/PT: los documentales iberoamericanos y brasileños casi no tienen ficha en Open Library (portada y año vacíos); el módulo ya compensa con la portada procedural y el campo extra de la semilla, y TMDB requiere clave propia (sin clave, se dejan esos campos vacíos)."));
c.push(H.bullet("Migración: aditiva pura (CT-M3) con default, sin downtime; se aplica a Neon antes del despliegue porque el build de Vercel no ejecuta migraciones. El borrado de recursos es una operación de datos puntual, con lista cerrada y conteo previo."));
c.push(H.bullet("Compatibilidad del APK vigente: el contrato de respuesta no cambia (campo nuevo incluido en el recurso); el APK actual ignora los campos desconocidos y sigue funcionando."));

c.push(H.h1("7. Criterio de aceptación y conclusión"));
c.push(H.tituloTabla("Tabla 5: checklist de aceptación de la propuesta v3"));
c.push(H.tabla(
  ["#", "Condición", "Verificación"],
  [
    ["1", "El catálogo distingue el idioma de la obra", "Campo idioma en esquema y migración aditiva aplicada; los 53 vigentes clasificados en en"],
    ["2", "La depuración está ejecutada y documentada", "Los 11 recursos de la Tabla 2 ausentes del catálogo y de la semilla; favoritos borrados en cascada; lista cerrada usada como verificación del borrado"],
    ["3", "Las reseñas están en el idioma del recurso", "Las 53 reseñas vigentes servidas en inglés tras la reescritura; lotes ES/PT nacen en su idioma"],
    ["4", "El selector principal de idioma existe y manda", "Segmentado Todos · Español · Inglés · Portugués como primera fila de filtros; persiste en el dispositivo; preajuste al idioma de interfaz con caída a Todos"],
    ["5", "La biblioteca responde al selector", "Destacados, carruseles, buscador y «Para tu perfil» muestran solo el idioma elegido; estado vacío con llamado a Todos; el 100 % del catálogo es alcanzable desde el selector"],
    ["6", "La API filtra por idioma", "idioma=es e idioma=pt combinables con tipo/cat/q/destacado; verificadas en la suite con DB real"],
    ["7", "Existen los lotes editoriales ES y PT", "25-40 fichas en español y 15-30 en portugués creadas como borradores y publicadas por oleadas tras revisión con URL verificada"],
    ["8", "Sin regresiones", "Suite de cultura extendida en verde (35 + 8-10 verificaciones) y resto de suites sin cambios"],
  ],
  [8, 34, 58]
));
c.push(H.body("Conclusión: la instrucción v3 —partir solo con recursos de origen inglés, español o portugués— es no solo viable sino recomendable: hace el filtro principal exhaustivo (el 100 % del catálogo responde al selector), reduce el diseño a un único campo de idioma sin reseñas puente y alinea la regla editorial (reseña en el idioma del recurso) con la realidad de los datos, sin costo de esfuerzo apreciable (12 a 17 horas técnicas y editoriales). El único precio es perder 11 obras de referencia, y ese precio se paga con transparencia: quedan documentadas como catálogo de reserva con la puerta abierta a re-incorporarlas cuando la traducción dinámica de reseñas exista. El ciclista en español o en portugués abre el módulo y encuentra primero la biblioteca en su idioma, cada reseña en la lengua de su ficha y ninguna obra fuera de lugar. Ninguna de las decisiones propuestas es irreversible: la depuración es una lista cerrada de títulos, el campo es aditivo y los lotes entran por el flujo editorial de borradores ya probado."));

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
