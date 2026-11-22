// ============================================================
// Semilla editorial de Cultura Ciclista (2026-11-22): catálogo
// curado a mano — SOLO recursos reales y verificables (título,
// autor/director y año incluidos solo cuando son seguros; año
// null cuando no lo es). Reseñas ORIGINALES de Cumbre30 (es).
// Enlaces externos de búsqueda legítima (Open Library / IMDb /
// TMDB / sitios oficiales): la app nunca simula reproducción.
// Idempotente: re-corre no duplica (match por titulo+tipo).
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//   bun scripts/semilla-cultura.mjs
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const enc = (s) => encodeURIComponent(s);
const ol = (t, a) => `https://openlibrary.org/search?q=${enc(`${t} ${a}`)}`;
const imdb = (t) => `https://www.imdb.com/find/?q=${enc(t)}&s=tt`;
const tmdbTv = (t) => `https://www.themoviedb.org/search/tv?query=${enc(t)}`;

const CATALOGO = [
  // ---------------- LIBROS ----------------
  { titulo: "The Rider", tipo: "libro", categorias: ["ruta", "historia", "personas"], anio: "1978", autor: "Tim Krabbé", pais: "Países Bajos", extra: "Novela · Literatura deportiva", destacado: true,
    resena: "La gran novela del ciclismo: 150 kilómetros de una carrera amateur contados desde dentro, donde cada puerto es un estado mental. Intensa, precisa y absorbente; se lee de un tirón y se repiensa durante años." },
  { titulo: "It's Not About the Bike", tipo: "libro", categorias: ["personas", "historia"], anio: "2000", autor: "Lance Armstrong y Sally Jenkins", pais: "EE. UU.", extra: "Memorias",
    resena: "Las memorias del ascenso milagroso tras el cáncer que marcaron una era. Leerlas hoy exige verlas también como documento de una época contradictoria del deporte." },
  { titulo: "The Secret Race", tipo: "libro", categorias: ["historia", "personas"], anio: "2012", autor: "Tyler Hamilton y Daniel Coyle", pais: "EE. UU.", extra: "Memorias · Periodismo deportivo",
    resena: "La confesión que destapó el doping estructurado del pelotón de los 2000. Imprescindible para entender la caza que rodeó a Armstrong, contada desde adentro y sin excusas." },
  { titulo: "French Revolutions", tipo: "libro", categorias: ["aventura", "historia"], anio: "2001", autor: "Tim Moore", pais: "Reino Unido", extra: "Crónica de viaje",
    resena: "Un escritor sin talento físico para el Tour recorre sus etapas con una bicicleta de acero y un humor demoledor. La crónica de viaje ciclista más divertida que se ha escrito." },
  { titulo: "Full Tilt: Ireland to India with a Bicycle", tipo: "libro", categorias: ["aventura", "personas"], anio: "1965", autor: "Dervla Murphy", pais: "Irlanda", extra: "Crónica de viaje", destacado: true,
    resena: "Con una pistola, una bicicleta y pocas más, Dervla Murphy pedalea de Irlanda a la India en 1963. Un clásico absoluto del viaje en bicicleta, escrito con una franqueza que no envejece." },
  { titulo: "Miles from Nowhere", tipo: "libro", categorias: ["aventura", "personas"], anio: "1983", autor: "Barbara Savage", pais: "EE. UU.", extra: "Crónica de viaje",
    resena: "Dos años pedaleando por el mundo en pareja, con todo lo bueno y lo duro que eso implica. Un relato honesto de la aventura larga que sigue inspirando viajeros." },
  { titulo: "Bicycle: The History", tipo: "libro", categorias: ["historia"], anio: "2004", autor: "David V. Herlihy", pais: "EE. UU.", extra: "Ensayo histórico",
    resena: "La historia completa de la bicicleta, del velocípedo al plegable, por el historiador que ayudó a rescatar el expediente del primer pedaleo. Referencia seria y muy legible." },
  { titulo: "The Lost Cyclist", tipo: "libro", categorias: ["historia", "aventura"], anio: "2010", autor: "David V. Herlihy", pais: "EE. UU.", extra: "Narrativa histórica",
    resena: "Frank Lenz pedaleó alrededor del mundo en 1892 y desapareció en Turquía. Reconstrucción de época que mezcla aventura, periodismo y misterio." },
  { titulo: "Around the World on a Bicycle", tipo: "libro", categorias: ["aventura", "historia"], anio: "1887", autor: "Thomas Stevens", pais: "Reino Unido", extra: "Clásico de viajes", destacado: true,
    resena: "El primer hombre en dar la vuelta al mundo en bicicleta lo contó con encanto victoriano y detalles infinitos. La bitácora fundacional del ciclo-turismo." },
  { titulo: "Major Taylor", tipo: "libro", categorias: ["historia", "personas"], anio: "1988", autor: "Andrew Ritchie", pais: "EE. UU.", extra: "Biografía",
    resena: "La vida del campeón del mundo de velocidad de 1899: negro, orgullosísimo y genial en plena segregación. La biografía de referencia de un pionero olvidado demasiado tiempo." },
  { titulo: "Slaying the Badger", tipo: "libro", categorias: ["historia", "ruta"], anio: "2011", autor: "Richard Moore", pais: "Reino Unido", extra: "Periodismo deportivo",
    resena: "LeMond contra Hinault en el Tour de 1986: lealtad, traición y montaña. Moore reconstruye la rivalidad que definió una década del ciclismo de carretera." },
  { titulo: "Put Me Back on My Bike", tipo: "libro", categorias: ["historia", "personas"], anio: "2002", autor: "William Fotheringham", pais: "Reino Unido", extra: "Biografía",
    resena: "La búsqueda del Tom Simpson real: genio del pedal, figura trágica del Tour de 1967. La mejor radiografía de la era en la que el ciclismo empezó a pagarse en wellness." },
  { titulo: "Merckx: Half Man, Half Bike", tipo: "libro", categorias: ["historia", "personas"], anio: "2012", autor: "William Fotheringham", pais: "Reino Unido", extra: "Biografía",
    resena: "El Caníbal ganó 525 carreras y aun así se le preguntaba por qué no ganó más. Retrato completo del mejor ciclista de la historia y de la presión que le rompió." },
  { titulo: "Sex, Lies and Handlebar Tape", tipo: "libro", categorias: ["historia", "personas"], anio: "2008", autor: "Paul Howard", pais: "Irlanda", extra: "Biografía",
    resena: "Jacques Anquetil, el primero en ganar cinco Tours, vivía tan arriba como pedaleaba. Biografía socarrona de un ídolo imposible de aburdir." },
  { titulo: "Marco Pantani: The Death of a Pirate", tipo: "libro", categorias: ["historia", "personas"], anio: "2006", autor: "Matt Rendell", pais: "Reino Unido", extra: "Biografía",
    resena: "El ascenso vertiginoso y la caída del Pirata: Mont Ventoux, Alpe d'Huez y el vacío después. Rendell narra sin morbosidad la tragedia más dolorosa del ciclismo moderno." },
  { titulo: "The Yellow Jersey Club", tipo: "libro", categorias: ["historia", "ruta"], anio: "2016", autor: "Edward Pickering", pais: "Reino Unido", extra: "Periodismo deportivo",
    resena: "Uno por uno, los ganadores del Tour de Francia: qué corrieron dentro y fuera de la camiseta. Historia del Tour contada a través de sus reyes." },
  { titulo: "Boy Racer", tipo: "libro", categorias: ["ruta", "personas"], anio: "2009", autor: "Mark Cavendish", pais: "Reino Unido", extra: "Memorias",
    resena: "El primer libro de Cavendish: velocidad pura, mal genio y la mecánica real de ser el mejor embalador del mundo. Directo, arrogante y honesto a la vez." },
  { titulo: "Shut Up Legs!", tipo: "libro", categorias: ["ruta", "personas"], anio: "2016", autor: "Jens Voigt", pais: "Alemania", extra: "Memorias",
    resena: "El grito de guerra de Jens Voigt como filosofía de vida: atacar, sufrir y volver a atacar. Memorias del gregario que se volvió ídolo por pura actitud." },
  { titulo: "Domestique", tipo: "libro", categorias: ["ruta", "personas"], anio: null, autor: "Charly Wegelius y Tom Fordyce", pais: "Reino Unido", extra: "Memorias",
    resena: "Once años trabajando para otros en el pelotón profesional, contados por quien nunca fue protagonista ni quiso serlo. El mejor retrato del trabajo invisible en el ciclismo." },
  { titulo: "The Hour", tipo: "libro", categorias: ["ruta", "entrenamiento"], anio: "2011", autor: "Michael Hutchinson", pais: "Reino Unido", extra: "Narrativa deportiva",
    resena: "Un profesor de doctorado en prólogo se propone el récord de la hora amateur. La preparación, la ciencia y la obsesión de un solo intento, contadas con ironía británica." },
  { titulo: "Just Ride", tipo: "libro", categorias: ["entrenamiento", "historia"], anio: "2012", autor: "Grant Petersen", pais: "EE. UU.", extra: "Ensayo · Filosofía ciclista",
    resena: "Contra el hafetismo del ciclista de datos: menos watts, más gusto. Un manifiesto para disfrutar la bici sin vestir de profesional el fin de semana." },
  { titulo: "Bike Snob", tipo: "libro", categorias: ["historia", "personas"], anio: "2010", autor: "Eben Weiss (BikeSnobNYC)", pais: "EE. UU.", extra: "Ensayo con humor",
    resena: "Taxonomía hilarante de las tribus urbanas del ciclismo y sus rituales. Se ríe de todos, incluido el lector, y enseña algo en cada página." },
  { titulo: "It's All About the Bike", tipo: "libro", categorias: ["historia", "personas"], anio: "2011", autor: "Rob Penn", pais: "Reino Unido", extra: "Ensayo",
    resena: "Rob Penn se monta la bici de sus sueños pieza por pieza y visita a los artesanos que las hacen. Un recorrido entrañable por la cultura material de la bicicleta." },
  { titulo: "The Cyclist's Training Bible", tipo: "libro", categorias: ["entrenamiento"], anio: null, autor: "Joe Friel", pais: "EE. UU.", extra: "Guía de entrenamiento",
    resena: "La biblia de la planificación ciclista: periodización, intensidades y transiciones explicadas para autodidactas. La referencia con la que varias generaciones ordenaron su entrenamiento." },
  { titulo: "The Time-Crunched Cyclist", tipo: "libro", categorias: ["entrenamiento"], anio: null, autor: "Chris Carmichael", pais: "EE. UU.", extra: "Guía de entrenamiento",
    resena: "Entrenar con pocas horas reales: intensidad inteligente para quien trabaja. El plan más citado por ciclistas de escritorio con ambiciones de montaña." },
  { titulo: "Zinn & the Art of Road Bike Maintenance", tipo: "libro", categorias: ["entrenamiento"], anio: null, autor: "Lennard Zinn", pais: "EE. UU.", extra: "Manual de taller",
    resena: "El manual de mantenimiento de carretera más completo: del ajuste del cambio al servicio de rodamientos, con ilustraciones claras. Ojalá nunca lo necesites; lo tendrás igual." },
  { titulo: "The Bicycling Guide to Complete Bicycle Maintenance & Repair", tipo: "libro", categorias: ["entrenamiento"], anio: null, autor: "Todd Downs", pais: "EE. UU.", extra: "Manual de taller",
    resena: "Guía de taller completa para bicis de ruta y montaña, con pasos y fotos por sistema. Segunda copia recomendada: la del sotobanco." },
  { titulo: "Epic Bike Rides of the World", tipo: "libro", categorias: ["aventura"], anio: "2016", autor: "Lonely Planet", pais: "Australia", extra: "Guía de viajes",
    resena: "200 rutas legendarias en 50 países, con perfiles y consejos prácticos. El mapa de sueños que cualquier ciclista debería tener bajo la almohada." },
  { titulo: "Lands of Lost Borders", tipo: "libro", categorias: ["aventura", "personas"], anio: "2018", autor: "Kate Harris", pais: "Canadá", extra: "Memorias de viaje", destacado: true,
    resena: "Dos científicas pedalean el Ruta de la Seda cruzando fronteras cerradas. Prosa luminosa sobre la exploración, la burocracia y el asombro; poco es tan bello en literatura de viajes." },
  { titulo: "Cycling Home from Siberia", tipo: "libro", categorias: ["aventura", "personas"], anio: "2009", autor: "Rob Lilwall", pais: "Reino Unido", extra: "Memorias de viaje",
    resena: "Un banquero en crisis pedalea desde el noreste de Siberia hasta Hong Kong e Irlanda. Invierno, papel mojado y fe; crónica sobria y a la vez épica." },
  { titulo: "The Man Who Cycled the World", tipo: "libro", categorias: ["aventura", "personas"], anio: "2009", autor: "Mark Beaumont", pais: "Reino Unido", extra: "Memorias de viaje",
    resena: "La vuelta al mundo en 194 días que marcó un récord y una forma de viajar. Beaumont comparte el método y el sacrificio detrás del número." },
  { titulo: "A Bike Ride", tipo: "libro", categorias: ["aventura", "personas"], anio: "1987", autor: "Anne Mustoe", pais: "Reino Unido", extra: "Crónica de viaje",
    resena: "Directora de colegio jubilada da la vuelta al mundo a los 54 años sin ser ciclista. Prueba de que la aventura larga no tiene edad ni receta." },
  { titulo: "This Road I Ride", tipo: "libro", categorias: ["aventura", "personas"], anio: null, autor: "Juliana Buhring", pais: null, extra: "Memorias de viaje",
    resena: "La primera mujer en dar la vuelta al mundo en bici pedalea por su vida y por un récord. Crónica cruda del récord femenino que abrió la puerta a muchas más." },

  // ---------------- PELÍCULAS ----------------
  { titulo: "Breaking Away", tipo: "pelicula", categorias: ["ruta", "personas", "historia"], anio: "1979", autor: "Peter Yates", pais: "EE. UU.", extra: "Comedia dramática", destacado: true,
    resena: "Un cortador de piedra de Bloomington sueña con ser ciclista italiano y encuentra su identidad en el Little 500. Óscar a mejor guion y quizá la mejor película de ciclismo jamás hecha." },
  { titulo: "Ladri di biciclette (Ladrón de bicicletas)", tipo: "pelicula", categorias: ["historia", "personas"], anio: "1948", autor: "Vittorio De Sica", pais: "Italia", extra: "Drama clásico",
    resena: "Un hombre, un trabajo y una bici robada en la posguerra romana. La película que hizo de una bicicleta el centro del cine universal." },
  { titulo: "Les Triplettes de Belleville", tipo: "pelicula", categorias: ["historia", "personas"], anio: "2003", autor: "Sylvain Chomet", pais: "Francia", extra: "Animación",
    resena: "Animación deslumbrante sobre un ciclista secuestrado en el Tour y sus abuelas rescatadoras. La cultura ciclista vista con imaginación desbordante." },
  { titulo: "The Flying Scotsman", tipo: "pelicula", categorias: ["historia", "personas", "ruta"], anio: "2006", autor: "Douglas Mackinnon", pais: "Reino Unido", extra: "Drama biográfico",
    resena: "Graeme Obree construyó su bici con piezas de lavadora y rompió el récord de la hora. Drama honesto sobre genialidad, presión y salud mental." },
  { titulo: "The Program", tipo: "pelicula", categorias: ["historia", "personas"], anio: "2015", autor: "Stephen Frears", pais: "Reino Unido", extra: "Drama biográfico · 103 min",
    resena: "Frears adapta el caso Armstrong con el periodista David Walsh como brújula moral. Ficción necesaria sobre la gran mentira del deporte moderno." },
  { titulo: "Premium Rush", tipo: "pelicula", categorias: ["historia"], anio: "2012", autor: "David Koepp", pais: "EE. UU.", extra: "Acción urbana",
    resena: "Mensajeros de Nueva York, una carta codiciada y tráfico al máximo. Acción urbana que celebra la bici como herramienta de supervivencia en la ciudad." },
  { titulo: "Quicksilver", tipo: "pelicula", categorias: ["historia"], anio: "1986", autor: "Thomas Michael Donnelly", pais: "EE. UU.", extra: "Acción urbana",
    resena: "Kevin Bacon deja la bolsa para pedalear como mensajero en Manhattan. Fotografía la era dorada de los mensajeros de bicicleta, con todos sus mitos de los 80." },
  { titulo: "Beijing Bicycle", tipo: "pelicula", categorias: ["historia", "personas"], anio: "2001", autor: "Wang Xiaoshuai", pais: "China", extra: "Drama",
    resena: "Dos jóvenes, una bici de mensajero y la China que cambia de siglo. Drama de clase y de propiedad que ganó el Oso de Plata en Berlín." },
  { titulo: "Le gamin au vélo (El niño con la bici)", tipo: "pelicula", categorias: ["personas", "historia"], anio: "2011", autor: "Jean-Pierre y Luc Dardenne", pais: "Bélgica", extra: "Drama",
    resena: "Un niño abandonado agarra la bici y la fe de una peluquera que lo acoge. Los Dardenne en estado puro: cámara al hombro y humanidad sin azúcar." },
  { titulo: "Wadjda", tipo: "pelicula", categorias: ["personas", "historia"], anio: "2012", autor: "Haifaa al-Mansour", pais: "Arabia Saudita", extra: "Drama",
    resena: "Una niña saudita quiere una bici verde aunque la tradición diga que no. Primera película rodada íntegramente en Arabia Saudita y un canto al derecho de pedalear." },

  // ---------------- DOCUMENTALES ----------------
  { titulo: "A Sunday in Hell", tipo: "documental", categorias: ["ruta", "historia"], anio: "1976", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · París-Roubaix", destacado: true,
    resena: "París-Roubaix 1976 filmada como ópera del esfuerzo: pavé, polvo y rostros. La mejor película sobre la dura belleza del clásico de piedra." },
  { titulo: "Stars and Water Carriers", tipo: "documental", categorias: ["ruta", "historia"], anio: "1973", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · Giro de Italia",
    resena: "El Giro de 1973 retratado con elegancia y detalle: estrellas, gregarios y hasta el masajista. Poesía documental sobre el trabajo en equipo." },
  { titulo: "The Impossible Hour", tipo: "documental", categorias: ["ruta", "entrenamiento"], anio: "1974", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · Récord de la hora",
    resena: "Ole Ritter intenta el récord de la hora en México contra el tiempo y contra Merckx como espectro. Tercera joya del tríptico ciclista de Leth." },
  { titulo: "Bicycle Dreams", tipo: "documental", categorias: ["aventura", "personas"], anio: "2009", autor: "Stephen Auerbach", pais: "EE. UU.", extra: "Documental · RAAM",
    resena: "La Race Across America: 4.800 km sin dormir del todo. Retrato crudo de los límites físicos y mentales de la ultradistancia." },
  { titulo: "Ride the Divide", tipo: "documental", categorias: ["aventura", "mtb"], anio: "2010", autor: "Mike Dion", pais: "EE. UU.", extra: "Documental · Tour Divide",
    resena: "2.700 millas de montañas rocosas desde Canadá hasta la frontera mexicana. El documental que dio rostro al bikepacking de carreras." },
  { titulo: "Inspired to Ride", tipo: "documental", categorias: ["aventura", "personas"], anio: "2015", autor: "Mike Dion", pais: "EE. UU.", extra: "Documental · TransAm",
    resena: "La primera TransAm Bike Race sin apoyo: 6.400 km de costa a costa. Personajes entrañables y una lección de autonomía sobre dos ruedas." },
  { titulo: "Janapar: Love on a Bike", tipo: "documental", categorias: ["aventura", "personas"], anio: "2012", autor: "Tom Allen", pais: "Reino Unido", extra: "Documental · Viaje alrededor del mundo",
    resena: "Tom Allen pedalea del Reino Unido a Armenia y su vida se transforma más de lo que esperaba. Viaje filmado a mano que habla de rutas y también de amor." },
  { titulo: "Blood Road", tipo: "documental", categorias: ["aventura", "mtb"], anio: "2017", autor: "Nicholas Schrunk", pais: "EE. UU.", extra: "Documental · Red Bull", destacado: true,
    resena: "Rebecca Rusch recorre la Ruta Ho Chi Minh en bici para entender dónde murió su padre en la guerra. Aventura, montaña y duelo; ganadora de varios premios de festival." },
  { titulo: "Where the Trail Ends", tipo: "documental", categorias: ["mtb", "aventura"], anio: "2012", autor: "Freeride Entertainment", pais: "EE. UU.", extra: "Documental MTB", destacado: true,
    resena: "Darren Berrecloth y equipo buscan líneas nuevas en Nevada, Camboya y Nepal. La película que llevó el freeride a lugares literalmente inexplorados." },
  { titulo: "unReal", tipo: "documental", categorias: ["mtb"], anio: "2015", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Anthill Films redefine la imagen del mountain bike: ritmo, paisaje y riders al límite. Una celebración visual de la cultura de montaña moderna." },
  { titulo: "Follow Me", tipo: "documental", categorias: ["mtb"], anio: "2010", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Cámaras siguen a los mejores riders del mundo durante una temporada. El formato que abrió la era cinematográfica del MTB contemporáneo." },
  { titulo: "Strength in Numbers", tipo: "documental", categorias: ["mtb"], anio: "2012", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Comunidades de riders desde Utah hasta Nepal: el mountain bike como cultura colectiva. Belleza de imagen y montaje editorial muy sólido." },
  { titulo: "Return to Earth", tipo: "documental", categorias: ["mtb"], anio: "2019", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Descensos de otro planeta y una idea simple: volver a la tierra, al origen del trail. Visualmente impecable y muy MTB." },
  { titulo: "The Moment", tipo: "documental", categorias: ["mtb", "historia"], anio: "2018", autor: "Anthill Films", pais: "Canadá", extra: "Documental · Historia del freeride",
    resena: "Los pioneros del freeride canadiense cuentan cómo inventaron una disciplina con terrones de sal y ganas. Historia de primera mano del MTB moderno." },
  { titulo: "Life Cycles", tipo: "documental", categorias: ["mtb", "historia"], anio: "2010", autor: "Derek Frankowski y Ryan Gibb", pais: "Canadá", extra: "Película MTB",
    resena: "Ciclo de vida de una bici y de un rider, narrado con imágenes espectaculares. El documental estético por excelencia del mountain bike." },
  { titulo: "Rising from Ashes", tipo: "documental", categorias: ["personas", "historia", "mtb"], anio: "2012", autor: "T.C. Johnstone", pais: "EE. UU.", extra: "Documental · 82 min", destacado: true,
    resena: "El Team Rwanda nace del genocidio y encuentra en la bici una oportunidad de futuro. Historia de reconstrucción narrada por los propios ciclistas." },
  { titulo: "Wonderful Losers: A Different World", tipo: "documental", categorias: ["ruta", "personas"], anio: "2017", autor: "Arūnas Matelis", pais: "Lituania", extra: "Documental · 71 min",
    resena: "Los gregarios del Giro: quienes sacrifican su carrera para que otro gane. Premiado y profundamente humano; el documental de la lealtad ciclista." },
  { titulo: "The Armstrong Lie", tipo: "documental", categorias: ["historia", "personas"], anio: "2013", autor: "Alex Gibney", pais: "EE. UU.", extra: "Documental",
    resena: "Gibney filmó el regreso de Armstrong y recibió la verdad en partes. Documento fundamental del mayor caso de doping del deporte." },
  { titulo: "Slaying the Badger", tipo: "documental", categorias: ["historia", "ruta"], anio: "2014", autor: "John Dower (ESPN 30 for 30)", pais: "EE. UU.", extra: "Documental ESPN",
    resena: "La versión audiovisual del Tour de 1986: Hinault prometió y no cumplió. Entrevistas afiladas y montaje de época impecable." },
  { titulo: "Tour de France: Unchained", tipo: "documental", categorias: ["ruta", "historia"], anio: "2023", autor: "Netflix", pais: "Francia", extra: "Serie documental", destacado: true,
    resena: "Acceso sin filtro a equipos y corredores del Tour moderno. La serie que acercó la tensión interna de la carrera a una audiencia global." },
  { titulo: "Bicycle", tipo: "documental", categorias: ["historia"], anio: null, autor: "Michael B. Clifford", pais: "Reino Unido", extra: "Documental · Historia de la bicicleta",
    resena: "Recorrido por 200 años de bicicleta y su papel en la sociedad británica y global. Documental de referencia sobre el invento más eficiente jamás creado." },
];

async function main() {
  const previos = await db.culturaRecurso.count();
  if (previos >= CATALOGO.length && !process.argv.includes("--forzar")) {
    console.log(`Catálogo completo (${previos}/${CATALOGO.length}): nada que sembrar (usa --forzar para re-sincronizar).`);
    return;
  }
  let creados = 0;
  let actualizados = 0;
  for (const r of CATALOGO) {
    const url = r.tipo === "libro"
      ? ol(r.titulo, r.autor.split(" y ")[0].split(" (")[0])
      : r.titulo.includes("Unchained")
        ? tmdbTv("Tour de France Unchained")
        : imdb(r.titulo);
    const data = {
      titulo: r.titulo,
      tipo: r.tipo,
      categorias: r.categorias,
      anio: r.anio,
      autor: r.autor,
      pais: r.pais ?? null,
      extra: r.extra,
      urlExterna: url,
      resena: r.resena,
      destacado: r.destacado === true,
      publicado: true,
      proveedor: "editorial",
    };
    const previo = await db.culturaRecurso.findFirst({ where: { titulo: r.titulo, tipo: r.tipo } });
    if (previo) {
      await db.culturaRecurso.update({ where: { id: previo.id }, data });
      actualizados++;
    } else {
      await db.culturaRecurso.create({ data });
      creados++;
    }
  }
  const total = await db.culturaRecurso.count();
  const porTipo = await db.culturaRecurso.groupBy({ by: ["tipo"], _count: true });
  console.log(`Semilla: ${creados} creados, ${actualizados} actualizados → total ${total}`);
  for (const t of porTipo) console.log(`  · ${t.tipo}: ${t._count}`);
  const destacados = await db.culturaRecurso.count({ where: { destacado: true } });
  const cats = new Set((await db.culturaRecurso.findMany({ select: { categorias: true } })).flatMap((x) => x.categorias));
  console.log(`Destacados: ${destacados} · categorías en uso: ${[...cats].sort().join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
