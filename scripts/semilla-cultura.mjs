// ============================================================
// Semilla editorial de Cultura Ciclista (2026-11-22, v4): catálogo
// curado a mano — SOLO recursos reales y verificables (título,
// autor/director y año incluidos solo cuando son seguros; año
// null cuando no lo es). Reseñas ORIGINALES de Cumbre30.
//
// Regla de idioma (v4, tras verificación con fuentes): el campo
// `idioma` es el idioma de la EDICIÓN/VERSIÓN DE REFERENCIA (no el
// original): todo el catálogo vigente se clasifica 'en' — 53 obras
// de origen inglés + 11 con edición/versión en inglés verificada
// (The Rider: trad. Sam Garrett, Bloomsbury · Ladri di biciclette:
// Criterion con doblaje/subtítulos · Le gamin au vélo: Criterion
// · Les Triplettes: Sony Pictures Classics · Beijing Bicycle: DVD
// con subtítulos · Wadjda: Sony Pictures Classics · A Sunday in
// Hell: narración inglesa de David Saunders · Wonderful Losers:
// subtítulos en inglés · Unchained: audio inglés en Netflix;
// Stars and Water Carriers y The Impossible Hour circulan en
// versión inglesa internacional, URL por confirmar). El idioma
// original de esas 11 se documenta en `extra` y la reseña se
// reescribió al inglés (v4): la reseña va en el idioma de la
// edición, sin excepciones.
//
// Enlaces externos legítimos (buscar/comprar/acceder): la app nunca
// simula reproducción. Política v4.2: descubrir no es conseguir
// gratis — los libros enlazan a Amazon (búsqueda por título+autor,
// catálogo global + Kindle para las ediciones 'en' del catálogo);
// IMDb/TMDB cubren películas y documentales.
// Idempotente: re-corre no duplica (match por titulo+tipo).
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//   bun scripts/semilla-cultura.mjs [--forzar]
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const enc = (s) => encodeURIComponent(s);
// Amazon: búsqueda estable por título+autor (formato universal /s?k=,
// funciona en amazon.com y amazon.com.br); sobrevive a cambios de
// stock y edición, y ofrece opciones de compra (físico y Kindle).
const am = (t, a) => `https://www.amazon.com/s?k=${enc(`${t} ${a}`)}`;
const imdb = (t) => `https://www.imdb.com/find/?q=${enc(t)}&s=tt`;
const tmdbTv = (t) => `https://www.themoviedb.org/search/tv?query=${enc(t)}`;

const CATALOGO = [
  // ---------------- LIBROS ----------------
  { titulo: "The Rider", tipo: "libro", idioma: "en", categorias: ["ruta", "historia", "personas"], anio: "1978", autor: "Tim Krabbé", pais: "Países Bajos", extra: "Novela · Literatura deportiva · Original en neerlandés; edición en inglés de Bloomsbury (trad. Sam Garrett)", destacado: true,
    resena: "The great cycling novel: 150 kilometres of an amateur race told from the inside, where every climb is a state of mind. Intense, precise and absorbing; it reads in one sitting and stays with you for years." },
  { titulo: "It's Not About the Bike", tipo: "libro", idioma: "en", categorias: ["personas", "historia"], anio: "2000", autor: "Lance Armstrong y Sally Jenkins", pais: "EE. UU.", extra: "Memorias",
    resena: "The memoirs of the miraculous comeback after cancer that defined an era. Reading them today also means reading them as a document of a contradictory time in sport." },
  { titulo: "The Secret Race", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2012", autor: "Tyler Hamilton y Daniel Coyle", pais: "EE. UU.", extra: "Memorias · Periodismo deportivo",
    resena: "The confession that blew the lid off systematic doping in the 2000s peloton. Essential to understand the hunt around Armstrong, told from the inside and without excuses." },
  { titulo: "French Revolutions", tipo: "libro", idioma: "en", categorias: ["aventura", "historia"], anio: "2001", autor: "Tim Moore", pais: "Reino Unido", extra: "Crónica de viaje",
    resena: "A writer with no physical talent for the Tour rides its stages on a steel bike with devastating humour. The funniest cycling travelogue ever written." },
  { titulo: "Full Tilt: Ireland to India with a Bicycle", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "1965", autor: "Dervla Murphy", pais: "Irlanda", extra: "Crónica de viaje", destacado: true,
    resena: "With a gun, a bicycle and little else, Dervla Murphy pedals from Ireland to India in 1963. An absolute classic of bicycle travel, written with a frankness that never ages." },
  { titulo: "Miles from Nowhere", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "1983", autor: "Barbara Savage", pais: "EE. UU.", extra: "Crónica de viaje",
    resena: "Two years cycling around the world as a couple, with everything good and hard that implies. An honest account of the long adventure that still inspires travellers." },
  { titulo: "Bicycle: The History", tipo: "libro", idioma: "en", categorias: ["historia"], anio: "2004", autor: "David V. Herlihy", pais: "EE. UU.", extra: "Ensayo histórico",
    resena: "The complete history of the bicycle, from velocipede to folding bike, by the historian who helped rescue the record of the first pedals. A serious and very readable reference." },
  { titulo: "The Lost Cyclist", tipo: "libro", idioma: "en", categorias: ["historia", "aventura"], anio: "2010", autor: "David V. Herlihy", pais: "EE. UU.", extra: "Narrativa histórica",
    resena: "Frank Lenz cycled around the world in 1892 and vanished in Turkey. A period reconstruction mixing adventure, journalism and mystery." },
  { titulo: "Around the World on a Bicycle", tipo: "libro", idioma: "en", categorias: ["aventura", "historia"], anio: "1887", autor: "Thomas Stevens", pais: "Reino Unido", extra: "Clásico de viajes", destacado: true,
    resena: "The first man to circle the globe by bicycle told it with Victorian charm and endless detail. The founding logbook of cycle touring." },
  { titulo: "Major Taylor", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "1988", autor: "Andrew Ritchie", pais: "EE. UU.", extra: "Biografía",
    resena: "The life of the 1899 sprint world champion: Black, immensely proud and brilliant in the middle of segregation. The reference biography of a pioneer forgotten for too long." },
  { titulo: "Slaying the Badger", tipo: "libro", idioma: "en", categorias: ["historia", "ruta"], anio: "2011", autor: "Richard Moore", pais: "Reino Unido", extra: "Periodismo deportivo",
    resena: "LeMond against Hinault in the 1986 Tour: loyalty, betrayal and mountains. Moore reconstructs the rivalry that defined a decade of road cycling." },
  { titulo: "Put Me Back on My Bike", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2002", autor: "William Fotheringham", pais: "Reino Unido", extra: "Biografía",
    resena: "The search for the real Tom Simpson: pedal genius and tragic figure of the 1967 Tour. The best X-ray of the era when professional cycling began to pay for its excesses." },
  { titulo: "Merckx: Half Man, Half Bike", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2012", autor: "William Fotheringham", pais: "Reino Unido", extra: "Biografía",
    resena: "The Cannibal won 525 races and was still asked why he didn't win more. A complete portrait of the greatest cyclist in history and the pressure that broke him." },
  { titulo: "Sex, Lies and Handlebar Tape", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2008", autor: "Paul Howard", pais: "Irlanda", extra: "Biografía",
    resena: "Jacques Anquetil, the first to win five Tours, lived as high as he pedalled. A wry biography of an idol impossible to bore." },
  { titulo: "Marco Pantani: The Death of a Pirate", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2006", autor: "Matt Rendell", pais: "Reino Unido", extra: "Biografía",
    resena: "The vertiginous rise and fall of the Pirate: Mont Ventoux, Alpe d'Huez and the void afterwards. Rendell narrates modern cycling's most painful tragedy without morbidity." },
  { titulo: "The Yellow Jersey Club", tipo: "libro", idioma: "en", categorias: ["historia", "ruta"], anio: "2016", autor: "Edward Pickering", pais: "Reino Unido", extra: "Periodismo deportivo",
    resena: "One by one, the winners of the Tour de France: what they raced inside and outside the jersey. The history of the Tour told through its kings." },
  { titulo: "Boy Racer", tipo: "libro", idioma: "en", categorias: ["ruta", "personas"], anio: "2009", autor: "Mark Cavendish", pais: "Reino Unido", extra: "Memorias",
    resena: "Cavendish's first book: pure speed, a bad temper and the real mechanics of being the world's best sprinter. Direct, arrogant and honest at once." },
  { titulo: "Shut Up Legs!", tipo: "libro", idioma: "en", categorias: ["ruta", "personas"], anio: "2016", autor: "Jens Voigt", pais: "Alemania", extra: "Memorias",
    resena: "Jens Voigt's battle cry as a philosophy of life: attack, suffer and attack again. Memoirs of the domestique who became an idol on sheer attitude." },
  { titulo: "Domestique", tipo: "libro", idioma: "en", categorias: ["ruta", "personas"], anio: null, autor: "Charly Wegelius y Tom Fordyce", pais: "Reino Unido", extra: "Memorias",
    resena: "Eleven years working for others in the pro peloton, told by someone who was never the protagonist and never wanted to be. The best portrait of invisible work in cycling." },
  { titulo: "The Hour", tipo: "libro", idioma: "en", categorias: ["ruta", "entrenamiento"], anio: "2011", autor: "Michael Hutchinson", pais: "Reino Unido", extra: "Narrativa deportiva",
    resena: "A doctorate-holding professor sets out to ride the amateur hour record. The preparation, the science and the obsession of a single attempt, told with British irony." },
  { titulo: "Just Ride", tipo: "libro", idioma: "en", categorias: ["entrenamiento", "historia"], anio: "2012", autor: "Grant Petersen", pais: "EE. UU.", extra: "Ensayo · Filosofía ciclista",
    resena: "Against the data fetish of the modern cyclist: fewer watts, more joy. A manifesto for enjoying the bike without dressing like a pro on the weekend." },
  { titulo: "Bike Snob", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2010", autor: "Eben Weiss (BikeSnobNYC)", pais: "EE. UU.", extra: "Ensayo con humor",
    resena: "A hilarious taxonomy of cycling's urban tribes and their rituals. It laughs at everyone, including the reader, and teaches something on every page." },
  { titulo: "It's All About the Bike", tipo: "libro", idioma: "en", categorias: ["historia", "personas"], anio: "2011", autor: "Rob Penn", pais: "Reino Unido", extra: "Ensayo",
    resena: "Rob Penn builds his dream bike piece by piece and visits the artisans who make them. An endearing tour of the material culture of the bicycle." },
  { titulo: "The Cyclist's Training Bible", tipo: "libro", idioma: "en", categorias: ["entrenamiento"], anio: null, autor: "Joe Friel", pais: "EE. UU.", extra: "Guía de entrenamiento",
    resena: "The bible of cycling planning: periodization, intensity and transitions explained for self-coached riders. The reference with which generations ordered their training." },
  { titulo: "The Time-Crunched Cyclist", tipo: "libro", idioma: "en", categorias: ["entrenamiento"], anio: null, autor: "Chris Carmichael", pais: "EE. UU.", extra: "Guía de entrenamiento",
    resena: "Training on few real hours: smart intensity for people with jobs. The plan most cited by desk cyclists with mountain ambitions." },
  { titulo: "Zinn & the Art of Road Bike Maintenance", tipo: "libro", idioma: "en", categorias: ["entrenamiento"], anio: null, autor: "Lennard Zinn", pais: "EE. UU.", extra: "Manual de taller",
    resena: "The most complete road maintenance manual: from derailleur adjustment to bearing service, with clear illustrations. You hope never to need it; you'll have it anyway." },
  { titulo: "The Bicycling Guide to Complete Bicycle Maintenance & Repair", tipo: "libro", idioma: "en", categorias: ["entrenamiento"], anio: null, autor: "Todd Downs", pais: "EE. UU.", extra: "Manual de taller",
    resena: "A complete workshop guide for road and mountain bikes, with steps and photos by system. Recommended second copy: the one under the workbench." },
  { titulo: "Epic Bike Rides of the World", tipo: "libro", idioma: "en", categorias: ["aventura"], anio: "2016", autor: "Lonely Planet", pais: "Australia", extra: "Guía de viajes",
    resena: "200 legendary routes in 50 countries, with profiles and practical tips. The dream map every cyclist should keep under their pillow." },
  { titulo: "Lands of Lost Borders", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "2018", autor: "Kate Harris", pais: "Canadá", extra: "Memorias de viaje", destacado: true,
    resena: "Two scientists pedal the Silk Road through closed borders. Luminous prose about exploration, bureaucracy and wonder; little travel writing is this beautiful." },
  { titulo: "Cycling Home from Siberia", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "2009", autor: "Rob Lilwall", pais: "Reino Unido", extra: "Memorias de viaje",
    resena: "A banker in crisis pedals from northeastern Siberia to Hong Kong and Ireland. Winter, wet paper and faith; a sober and epic chronicle." },
  { titulo: "The Man Who Cycled the World", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "2009", autor: "Mark Beaumont", pais: "Reino Unido", extra: "Memorias de viaje",
    resena: "The 194-day circumnavigation that set a record and a way of travelling. Beaumont shares the method and the sacrifice behind the number." },
  { titulo: "A Bike Ride", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: "1987", autor: "Anne Mustoe", pais: "Reino Unido", extra: "Crónica de viaje",
    resena: "A retired headmistress rides around the world at 54 without being a cyclist. Proof that the long adventure has no age and no recipe." },
  { titulo: "This Road I Ride", tipo: "libro", idioma: "en", categorias: ["aventura", "personas"], anio: null, autor: "Juliana Buhring", pais: null, extra: "Memorias de viaje",
    resena: "The first woman to cycle around the world pedals for her life and for a record. A raw chronicle of the women's record that opened the door for many more." },

  // ---------------- PELÍCULAS ----------------
  { titulo: "Breaking Away", tipo: "pelicula", idioma: "en", categorias: ["ruta", "personas", "historia"], anio: "1979", autor: "Peter Yates", pais: "EE. UU.", extra: "Comedia dramática", destacado: true,
    resena: "A stone cutter from Bloomington dreams of being an Italian cyclist and finds his identity in the Little 500. Oscar for best screenplay and arguably the best cycling film ever made." },
  { titulo: "Ladri di biciclette (Ladrón de bicicletas)", tipo: "pelicula", idioma: "en", categorias: ["historia", "personas"], anio: "1948", autor: "Vittorio De Sica", pais: "Italia", extra: "Drama clásico · Original en italiano; edición Criterion con doblaje y subtítulos en inglés",
    resena: "A man, a job and a stolen bike in postwar Rome. The film that made a bicycle the centre of universal cinema." },
  { titulo: "Les Triplettes de Belleville", tipo: "pelicula", idioma: "en", categorias: ["historia", "personas"], anio: "2003", autor: "Sylvain Chomet", pais: "Francia", extra: "Animación · Original en francés (diálogos mínimos); edición de Sony Pictures Classics con subtítulos en inglés",
    resena: "Dazzling animation about a cyclist kidnapped during the Tour and the grannies who rescue him. Cycling culture seen with boundless imagination." },
  { titulo: "The Flying Scotsman", tipo: "pelicula", idioma: "en", categorias: ["historia", "personas", "ruta"], anio: "2006", autor: "Douglas Mackinnon", pais: "Reino Unido", extra: "Drama biográfico",
    resena: "Graeme Obree built his bike from washing-machine parts and broke the hour record. An honest drama about genius, pressure and mental health." },
  { titulo: "The Program", tipo: "pelicula", idioma: "en", categorias: ["historia", "personas"], anio: "2015", autor: "Stephen Frears", pais: "Reino Unido", extra: "Drama biográfico · 103 min",
    resena: "Frears adapts the Armstrong case with journalist David Walsh as moral compass. Necessary fiction about the great lie of modern sport." },
  { titulo: "Premium Rush", tipo: "pelicula", idioma: "en", categorias: ["historia"], anio: "2012", autor: "David Koepp", pais: "EE. UU.", extra: "Acción urbana",
    resena: "New York bike messengers, a coveted envelope and traffic at its fiercest. Urban action that celebrates the bike as a survival tool in the city." },
  { titulo: "Quicksilver", tipo: "pelicula", idioma: "en", categorias: ["historia"], anio: "1986", autor: "Thomas Michael Donnelly", pais: "EE. UU.", extra: "Acción urbana",
    resena: "Kevin Bacon leaves the office to ride as a messenger in Manhattan. It photographs the golden age of bike messengers, with all its 1980s myths." },
  { titulo: "Beijing Bicycle", tipo: "pelicula", idioma: "en", categorias: ["historia", "personas"], anio: "2001", autor: "Wang Xiaoshuai", pais: "China", extra: "Drama · Original en chino; distribuida en DVD y Blu-ray con subtítulos en inglés",
    resena: "Two young men, a courier bike and a China changing century. A drama of class and property that won the Silver Bear in Berlin." },
  { titulo: "Le gamin au vélo (El niño con la bici)", tipo: "pelicula", idioma: "en", categorias: ["personas", "historia"], anio: "2011", autor: "Jean-Pierre y Luc Dardenne", pais: "Bélgica", extra: "Drama · Original en francés; edición Criterion con subtítulos en inglés",
    resena: "An abandoned boy grabs the bike and the faith of a hairdresser who takes him in. The Dardennes in pure form: handheld camera and humanity without sugar." },
  { titulo: "Wadjda", tipo: "pelicula", idioma: "en", categorias: ["personas", "historia"], anio: "2012", autor: "Haifaa al-Mansour", pais: "Arabia Saudita", extra: "Drama · Original en árabe; distribución de Sony Pictures Classics con subtítulos en inglés",
    resena: "A Saudi girl wants a green bike even though tradition says no. The first film shot entirely in Saudi Arabia and a hymn to the right to pedal." },

  // ---------------- DOCUMENTALES ----------------
  { titulo: "A Sunday in Hell", tipo: "documental", idioma: "en", categorias: ["ruta", "historia"], anio: "1976", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · París-Roubaix · Original en danés; versión internacional con narración en inglés de David Saunders", destacado: true,
    resena: "Paris-Roubaix 1976 filmed as an opera of effort: pavé, dust and faces. The best film about the harsh beauty of the stone classic." },
  { titulo: "Stars and Water Carriers", tipo: "documental", idioma: "en", categorias: ["ruta", "historia"], anio: "1973", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · Giro de Italia · Original en danés; circula en versión inglesa internacional",
    resena: "The 1973 Giro portrayed with elegance and detail: stars, domestiques and even the masseur. Documentary poetry about teamwork." },
  { titulo: "The Impossible Hour", tipo: "documental", idioma: "en", categorias: ["ruta", "entrenamiento"], anio: "1974", autor: "Jørgen Leth", pais: "Dinamarca", extra: "Documental · Récord de la hora · Original en danés; circula en versión inglesa internacional",
    resena: "Ole Ritter attempts the hour record in Mexico against time and against Merckx as a spectre. The third jewel of Leth's cycling triptych." },
  { titulo: "Bicycle Dreams", tipo: "documental", idioma: "en", categorias: ["aventura", "personas"], anio: "2009", autor: "Stephen Auerbach", pais: "EE. UU.", extra: "Documental · RAAM",
    resena: "The Race Across America: 4,800 km of barely sleeping. A raw portrait of the physical and mental limits of ultra-distance." },
  { titulo: "Ride the Divide", tipo: "documental", idioma: "en", categorias: ["aventura", "mtb"], anio: "2010", autor: "Mike Dion", pais: "EE. UU.", extra: "Documental · Tour Divide",
    resena: "2,700 miles of Rocky Mountains from Canada to the Mexican border. The documentary that gave race bikepacking a face." },
  { titulo: "Inspired to Ride", tipo: "documental", idioma: "en", categorias: ["aventura", "personas"], anio: "2015", autor: "Mike Dion", pais: "EE. UU.", extra: "Documental · TransAm",
    resena: "The first unsupported TransAm Bike Race: 6,400 km coast to coast. Lovable characters and a lesson in autonomy on two wheels." },
  { titulo: "Janapar: Love on a Bike", tipo: "documental", idioma: "en", categorias: ["aventura", "personas"], anio: "2012", autor: "Tom Allen", pais: "Reino Unido", extra: "Documental · Viaje alrededor del mundo",
    resena: "Tom Allen pedals from the UK to Armenia and his life changes more than he expected. A hand-filmed journey about routes and about love." },
  { titulo: "Blood Road", tipo: "documental", idioma: "en", categorias: ["aventura", "mtb"], anio: "2017", autor: "Nicholas Schrunk", pais: "EE. UU.", extra: "Documental · Red Bull", destacado: true,
    resena: "Rebecca Rusch rides the Ho Chi Minh Trail to understand where her father died in the war. Adventure, mountains and mourning; a multi-festival winner." },
  { titulo: "Where the Trail Ends", tipo: "documental", idioma: "en", categorias: ["mtb", "aventura"], anio: "2012", autor: "Freeride Entertainment", pais: "EE. UU.", extra: "Documental MTB", destacado: true,
    resena: "Darren Berrecloth and team hunt new lines in Nevada, Cambodia and Nepal. The film that took freeride to literally unexplored places." },
  { titulo: "unReal", tipo: "documental", idioma: "en", categorias: ["mtb"], anio: "2015", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Anthill Films redefines the image of mountain biking: rhythm, landscape and riders at the limit. A visual celebration of modern mountain culture." },
  { titulo: "Follow Me", tipo: "documental", idioma: "en", categorias: ["mtb"], anio: "2010", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Cameras follow the world's best riders through a season. The format that opened the cinematic era of contemporary MTB." },
  { titulo: "Strength in Numbers", tipo: "documental", idioma: "en", categorias: ["mtb"], anio: "2012", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Rider communities from Utah to Nepal: mountain biking as a collective culture. Strong imagery and very solid editing." },
  { titulo: "Return to Earth", tipo: "documental", idioma: "en", categorias: ["mtb"], anio: "2019", autor: "Anthill Films", pais: "Canadá", extra: "Película MTB",
    resena: "Descents from another planet and one simple idea: return to the earth, to the origin of the trail. Visually impeccable and deeply MTB." },
  { titulo: "The Moment", tipo: "documental", idioma: "en", categorias: ["mtb", "historia"], anio: "2018", autor: "Anthill Films", pais: "Canadá", extra: "Documental · Historia del freeride",
    resena: "The pioneers of Canadian freeride tell how they invented a discipline with grit and guts. First-hand history of modern MTB." },
  { titulo: "Life Cycles", tipo: "documental", idioma: "en", categorias: ["mtb", "historia"], anio: "2010", autor: "Derek Frankowski y Ryan Gibb", pais: "Canadá", extra: "Película MTB",
    resena: "The life cycle of a bike and of a rider, narrated with spectacular images. The aesthetic documentary par excellence of mountain biking." },
  { titulo: "Rising from Ashes", tipo: "documental", idioma: "en", categorias: ["personas", "historia", "mtb"], anio: "2012", autor: "T.C. Johnstone", pais: "EE. UU.", extra: "Documental · 82 min", destacado: true,
    resena: "Team Rwanda rises from genocide and finds in the bike a chance at a future. A story of rebuilding narrated by the riders themselves." },
  { titulo: "Wonderful Losers: A Different World", tipo: "documental", idioma: "en", categorias: ["ruta", "personas"], anio: "2017", autor: "Arūnas Matelis", pais: "Lituania", extra: "Documental · 71 min · Original en lituano (audio multilingüe); exhibiciones internacionales con subtítulos en inglés",
    resena: "The domestiques of the Giro: those who sacrifice their career so another may win. Award-winning and profoundly human; the documentary of cycling loyalty." },
  { titulo: "The Armstrong Lie", tipo: "documental", idioma: "en", categorias: ["historia", "personas"], anio: "2013", autor: "Alex Gibney", pais: "EE. UU.", extra: "Documental",
    resena: "Gibney filmed Armstrong's comeback and received the truth in installments. A fundamental document of the biggest doping case in sport." },
  { titulo: "Slaying the Badger", tipo: "documental", idioma: "en", categorias: ["historia", "ruta"], anio: "2014", autor: "John Dower (ESPN 30 for 30)", pais: "EE. UU.", extra: "Documental ESPN",
    resena: "The audiovisual version of the 1986 Tour: Hinault promised and did not deliver. Sharp interviews and impeccable period editing." },
  { titulo: "Tour de France: Unchained", tipo: "documental", idioma: "en", categorias: ["ruta", "historia"], anio: "2023", autor: "Netflix", pais: "Francia", extra: "Serie documental · Original en francés; audio en inglés disponible en Netflix", destacado: true,
    resena: "Unfiltered access to teams and riders of the modern Tour. The series that brought the race's inner tension to a global audience." },
  { titulo: "Bicycle", tipo: "documental", idioma: "en", categorias: ["historia"], anio: null, autor: "Michael B. Clifford", pais: "Reino Unido", extra: "Documental · Historia de la bicicleta",
    resena: "A tour of 200 years of the bicycle and its role in British and global society. The reference documentary about the most efficient machine ever created." },
];

async function main() {
  const previos = await db.culturaRecurso.count();
  // Guard de re-sincronización (v4): además del tamaño, verifica el
  // MARCADOR de reescritura v4 (reseña de The Rider en inglés). Así,
  // el build de producción re-corre la semilla una única vez tras el
  // despliegue de la migración de idioma (actualiza reseñas es→en,
  // campo idioma y extra de las 11) y luego salta en builds futuros.
  const rider = await db.culturaRecurso.findFirst({
    where: { titulo: "The Rider", tipo: "libro" },
    select: { resena: true },
  });
  const reescritoV4 = !!rider && /150 kilometres/.test(rider.resena);
  if (previos >= CATALOGO.length && reescritoV4 && !process.argv.includes("--forzar")) {
    console.log(`Catálogo completo (${previos}/${CATALOGO.length}, reseñas v4): nada que sembrar (usa --forzar para re-sincronizar).`);
    return;
  }
  let creados = 0;
  let actualizados = 0;
  for (const r of CATALOGO) {
    const url = r.tipo === "libro"
      ? am(r.titulo, r.autor.split(" y ")[0].split(" (")[0])
      : r.titulo.includes("Unchained")
        ? tmdbTv("Tour de France Unchained")
        : imdb(r.titulo);
    const data = {
      titulo: r.titulo,
      tipo: r.tipo,
      idioma: r.idioma ?? "en",
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
  const porIdioma = await db.culturaRecurso.groupBy({ by: ["idioma"], _count: true });
  console.log(`Semilla: ${creados} creados, ${actualizados} actualizados → total ${total}`);
  for (const t of porTipo) console.log(`  · ${t.tipo}: ${t._count}`);
  for (const t of porIdioma) console.log(`  · idioma ${t.idioma}: ${t._count}`);
  const destacados = await db.culturaRecurso.count({ where: { destacado: true } });
  const cats = new Set((await db.culturaRecurso.findMany({ select: { categorias: true } })).flatMap((x) => x.categorias));
  console.log(`Destacados: ${destacados} · categorías en uso: ${[...cats].sort().join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
