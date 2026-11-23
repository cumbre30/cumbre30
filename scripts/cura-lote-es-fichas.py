#!/usr/bin/env python3
# Curación de la OLEADA ES por fichas verificadas (Buscalibre, JSONs del usuario):
#  · 25 títulos elegidos de los 63 candidatos (descartados autoeditados,
#    cuadernos Createspace, POD vanidoso y duplicados de edición digital/print)
#  · autor/año del listado de origen (fichas Buscalibre) — regla v4
#  · año null cuando no es seguro; OL para los que la ficha no trae año
#  · portada: covers.openlibrary.org; respaldo Google Books; se verifica HTTP
#  · urlExterna = enlace de FICHA real (nunca /libros/search)
# Salida: scripts/data/lote-es-fichas-final.json
import json, re, time, urllib.request

BASE = "/home/z/my-project/scripts/data"
DL = "/home/z/my-project/download"

def norm(s):
    s = (s or "").lower().strip()
    return re.sub(r"\s+", " ", s)

def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "cumbre30-curacion/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None

def ol_buscar(q, fields="title,author_name,first_publish_year,publisher"):
    url = "https://openlibrary.org/search.json?q=" + urllib.request.quote(q) + f"&limit=3&fields={fields}"
    raw = http_get(url)
    try:
        return json.loads(raw).get("docs", []) if raw else []
    except Exception:
        return []

# ---------- selección editorial: 25 fichas (por ISBN/product_id de Buscalibre) ----------
L = [
 dict(isbn="9788494565137", ficha="https://www.buscalibre.cl/libro-la-etapa-decimocuarta-71-historias-de-ciclismo/9788494565137/p/48407647",
      titulo="La etapa decimocuarta. 71 historias de ciclismo", autor="Tim Krabbé", pais="Países Bajos",
      categorias=["historia", "personas"], anio=2017, editorial="Libros De Ruta",
      extra="71 relatos del autor de El ciclista · Edición española de Libros De Ruta",
      resena="Tim Krabbé, el novelista holandés que escribió la gran novela del ciclismo, cuenta aquí setenta y una historias del deporte a rueda libre: carreras, escapadas, héroes y lugares. Relato breve, obsesivo y preciso, del mejor cronista ciclista en lengua no española."),
 dict(isbn="9788494128790", ficha="https://www.buscalibre.cl/libro-una-dura-carrera-por-los-entresijos-del-ciclismo-a-rueda-de-un-ciclista-profesional/9788494128790/p/47456279",
      titulo="Una dura carrera", autor="Paul Kimmage", pais="Irlanda",
      categorias=["personas", "historia"], anio=2016, editorial="Libros De Ruta",
      extra="Edición española de Rough Ride (1990) · Libros De Ruta",
      resena="La crónica clásica del ciclismo profesional vista desde el fondo del pelotón: Kimmage fue gregario y escribió lo que nadie quería contar —dolor, sueldos precarios, dopaje— en su primera temporada como profesional. Ganador del William Hill Sports Book of the Year y referencia permanente del género."),
 dict(isbn="68698823", ficha="https://www.buscalibre.cl/libro-digital-dios-ha-muerto-apogeo-y-decadencia-de-frank-vandenbroucke-el-talento-mas-desaprovechado-del-ciclismo/68698823/p/68698823",
      titulo="Dios ha muerto", autor="Andy McGrath", pais="Reino Unido",
      categorias=["personas", "historia"], anio=2022, editorial="Libros De Ruta",
      extra="Edición española de God is Dead: The Rise and Fall of Frank Vandenbroucke · Libros De Ruta",
      resena="La historia de Frank Vandenbroucke, el talento belga que ganó Liège y la Clásica de San Sebastián antes de que la vida —y el dopaje— se le echaran encima. Biografía rotunda de uno de los grandes ¡qué pudo ser! del ciclismo europeo."),
 dict(isbn="9788494565175", ficha="https://www.buscalibre.cl/libro-la-historia-del-ciclismo-en-80-dias-80-grandes-historias-ilustradas/9788494565175/p/48876425",
      titulo="La historia del ciclismo en 80 días. 80 grandes historias ilustradas", autor="Giles Belbin", pais="Reino Unido",
      categorias=["historia", "ruta"], anio=2017, editorial="Libros De Ruta",
      extra="80 historias ilustradas · Edición española de Libros De Ruta",
      resena="Ochenta episodios ilustrados que recorren la historia del ciclismo de competición, de las primeras carreras a la era moderna. Formato ideal para leer un día, una historia: la puerta más amable a la historia del deporte para nuevas audiencias."),
 dict(isbn="9788494911194", ficha="https://www.buscalibre.cl/libro-escapadas-cincuenta-nombres-que-definieron-el-ciclismo-de-carretera/9788494911194/p/52009108",
      titulo="Escapadas. Cincuenta nombres que definieron el ciclismo de carretera", autor="Euan Ferguson", pais="Reino Unido",
      categorias=["historia", "personas"], anio=2019, editorial="Libros De Ruta",
      extra="Cincuenta retratos · Edición española de Libros De Ruta",
      resena="Cincuenta ciclistas que cambiaron la carrera en carretera, retratados uno a uno con su escapada —literal y figurada— como hilo. Historia del pelotón contada por sus protagonistas, con el gusto británico por el perfil y el detalle."),
 dict(isbn="9788494128707", ficha="https://www.buscalibre.cl/libro-sky-s-the-limit-sky-el-limite-es-el-cielo-la-intrahistoria-del-equipo-que-ha-revolucionado-el-ciclismo-mundial/9788494128707/p/39447999",
      titulo="Sky's the limit", autor="Richard Moore", pais="Reino Unido",
      categorias=["historia", "personas"], anio=2013, editorial="Libros De Ruta Ediciones",
      extra="La intrahistoria del equipo Sky · Edición española de Libros De Ruta",
      resena="Richard Moore narra el ascenso meteórico del equipo Sky hasta el primer Tour británico: cómo se montó, quién mandaba y qué se cocía en el autobús. Periodismo de equipo con acceso de primera mano a los protagonistas."),
 dict(isbn="9788412277661", ficha="https://www.buscalibre.cl/libro-arriva-italia-gloria-y-miseria-de-la-nacion-que-sono-ciclismo/9788412277661/p/53452985",
      titulo="Arriva Italia. Gloria y miseria de la nación que soñó ciclismo", autor="Marcos Pereda", pais="España",
      categorias=["historia", "personas"], anio=2021, editorial="Libros De Ruta",
      extra="Historia del ciclismo italiano · Libros De Ruta",
      resena="Retrato del ciclismo italiano, la nación que hizo del pedal un nacionalismo alegre: del Giro y los campionissimi a la miseria de su decadencia. Pereda combina historia, paisaje y crónica con prosa de aficionado informado."),
 dict(isbn="9791387955120", ficha="https://www.buscalibre.cl/libro-historia-del-ciclismo-en-colombia-origenes-de-la-vuelta-a-colombia-y-de-una-pasion-unica-por-las-bicicletas-la-historia-de-los-escarabajos-de-efrain-forero-a-egan-bernal/9791387955120/p/64840706",
      titulo="Historia del ciclismo en Colombia", autor="Marcos Pereda", pais="España",
      categorias=["historia", "personas"], anio=2026, editorial="Libros De Ruta",
      extra="De Efraín Forero a Egan Bernal · Libros De Ruta",
      resena="De la primera Vuelta a Colombia y los escarabajos de montaña al Tour de Egan Bernal: cómo un país andino convirtió la bici en pasión nacional. Historia completa del fenómeno colombiano, la mayor escuela de escaladores del ciclismo mundial."),
 dict(isbn="9791387955472", ficha="https://www.buscalibre.cl/libro-se-rueda-el-ciclismo-y-las-bicicletas-en-el-cine/9791387955472/p/69056918",
      titulo="Se rueda. El ciclismo y las bicicletas en el cine", autor="Jordi Rodríguez Ruiz", pais="España",
      categorias=["historia", "personas"], anio=2026, editorial="Libros De Ruta",
      extra="Ciclismo y cine · Libros De Ruta",
      resena="Las bicicletas han pedaleado el cine desde sus orígenes: herejes, épicas, documentales y comedias a rueda libre. Jordi Rodríguez repasa la relación entre ciclismo y séptimo arte con erudición de cinéfilo y pasión de ciclista."),
 dict(isbn="9788408269366", ficha="https://www.buscalibre.cl/libro-diccionario-sentimental-del-ciclismo/9788408269366/p/54892084",
      titulo="Diccionario sentimental del ciclismo", autor="Juanma Trueba", pais="España",
      categorias=["historia", "personas"], anio=2023, editorial="Geoplaneta",
      extra="Diccionario de términos y personajes · Geoplaneta",
      resena="Un diccionario en el que cada entrada es un pedazo de memoria ciclista: términos, héroes, gestas y zarandajas del deporte a rueda libre explicados por Juanma Trueba. Se lee de corrido o por entradas, siempre con la sensación de charlar con quien sabe y ama la materia."),
 dict(isbn="68732547", ficha="https://www.buscalibre.cl/libro-digital-niebla-en-el-mont-ventoux-y-otras-historias-de-ciclismo/68732547/p/68732547",
      titulo="Niebla en el Mont Ventoux y otras historias de ciclismo", autor="Wilfried de Jong", pais="Países Bajos",
      categorias=["personas", "historia"], anio=2017, editorial="Lince",
      extra="Crónicas del «Stratenmaker» holandés · Edición española de Lince",
      resena="Wilfried de Jong, el periodista holandés que hizo del ciclismo una forma de escribir la vida, firma crónicas donde el Mont Ventoux, el viento y los héroes de la carretera son excusas para hablar de todo lo demás. Prosa europea del mejor crono."),
 dict(isbn="9788411319416", ficha="https://www.buscalibre.cl/libro-eso-no-estaba-en-mi-libro-de-historia-del-ciclismo/9788411319416/p/55905979",
      titulo="Eso no estaba en mi libro de historia del ciclismo", autor="Marcos Pereda", pais="España",
      categorias=["historia", "personas"], anio=None, editorial="Almuzara",
      extra="Curiosidades y episodios menores de la historia ciclista · Almuzara",
      resena="Lo que los libros serios no cuentan: gestas absurdas, rivales imposibles, trampas legendarias y curiosidades de dos siglos de ciclismo. Divulgación ligera con oficio, perfecta para el ciclista que ya se leyó las historias grandes."),
 dict(isbn="9788499884837", ficha="https://www.buscalibre.cl/libro-bici-zen-ciclismo-urbano-como-meditacion/9788499884837/p/47256291",
      titulo="Bici zen. Ciclismo urbano como meditación", autor="Juan Carlos Kreimer", pais="Argentina",
      categorias=["personas", "aventura"], anio=2016, editorial="Kairós",
      extra="Ciclismo urbano y atención plena · Editorial Kairós",
      resena="Kreimer, escritor y practicante budista, propone el pedaleo urbano como práctica de atención plena: respiración, tráfico, presente. Un libro raro y sereno que convierte el trayecto diario en meditación con ruedas."),
 dict(isbn="9788466237604", ficha="https://www.buscalibre.cl/libro-ciclismo-con-mucho-humor-una-guia-ilustrada-de-la-vida-sobre-dos-ruedas/9788466237604/p/49026707",
      titulo="Ciclismo con mucho humor", autor="Dave Walker", pais="Reino Unido",
      categorias=["personas", "aventura"], anio=2017, editorial="Libsa",
      extra="Guía ilustrada · Libsa",
      resena="Guía ilustrada de la vida sobre dos ruedas: tipos de ciclista, defectos de la bici, el clima y el público del pelotón vistos con humor gráfico británico. El libro que se regala entre ciclistas y se termina leyendo entero."),
 dict(isbn="9788493064198", ficha="https://www.buscalibre.cl/libro-mi-querida-bicicleta-relatos-de-ciclismo-de-holanda-y-espana/9788493064198/p/50752175",
      titulo="Mi querida bicicleta. Relatos de ciclismo de Holanda y España", autor="Varios autores", pais=None,
      categorias=["personas", "aventura"], anio=None, editorial="Experimenta",
      extra="Antología de relatos · Edición española de Experimenta",
      resena="Antología de relatos ciclistas de Holanda y España: dos países con tradiciones contrapuestas —la bici de todos los días y la del deporte— escritas por autores de los dos lados. Literatura de pedaleo para lectores, no solo para aficionados."),
 dict(isbn="9788499107431", ficha="https://www.buscalibre.cl/libro-el-secreto-del-ciclismo/9788499107431/p/51089467",
      titulo="El secreto del ciclismo", autor="Hans van Dijk, Ron van Megen, Guido Vroemen", pais="Países Bajos",
      categorias=["entrenamiento"], anio=2019, editorial="Paidotribo",
      extra="Fisiología y física del rendimiento · Edición española de Paidotribo",
      resena="Tres ingenieros y un fisiólogo desmontan el rendimiento ciclista con datos: potencia, aerodinámica, resistencia y qué predice de verdad el resultado en carrera. Ciencia dura del ciclismo explicada con gráficas y números, en la línea de lo que hoy hace cualquier entrenador serio."),
 dict(isbn="9788480195867", ficha="https://www.buscalibre.cl/libro-medicina-del-ciclismo/9788480195867/p/1024814",
      titulo="Medicina del ciclismo", autor="Arnie Baker", pais="Estados Unidos",
      categorias=["entrenamiento"], anio=None, editorial="Paidotribo",
      extra="Del médico y entrenador Arnie Baker · Edición española de Paidotribo",
      resena="Arnie Baker, médico y entrenador de referencia del ciclismo estadounidense, repasa la salud del ciclista: lesiones, nutrición, altitud, y cómo entrenar sin romperse. Medicina deportiva específica de la bici, escrita para ciclistas."),
 dict(isbn="9788480199612", ficha="https://www.buscalibre.cl/libro-ciclismo-de-por-vida-montar-en-bicicleta-hasta-los-cien-anos/9788480199612/p/1247128",
      titulo="Ciclismo de por vida. Montar en bicicleta hasta los cien años", autor="Roy M. Wallack, Bill Katovsky", pais="Estados Unidos",
      categorias=["entrenamiento", "personas"], anio=2007, editorial="Paidotribo",
      extra="Edición española de Bike for Life · Paidotribo",
      resena="Cómo pedalear de forma saludable durante décadas: longevidad, prevención de lesiones, motivación y planes para cada edad, con entrevistas a ciclistas veteranos. El manual del ciclista que quiere llegar viejo a la bici."),
 dict(isbn="9788479028695", ficha="https://www.buscalibre.cl/libro-ciclismo-y-rendimiento/9788479028695/p/4270272",
      titulo="Ciclismo y rendimiento", autor="Yago Alcalde", pais="España",
      categorias=["entrenamiento"], anio=2011, editorial="Tutor",
      extra="Entrenamiento y competición · Ediciones Tutor",
      resena="Yago Alcalde, periodista y experto en entrenamiento ciclista, ordena el rendimiento en piezas: planificación, tests, potencia, táctica. Manual español de referencia para quien quiere pasar del pedaleo al entrenamiento con método."),
 dict(isbn="9788479029043", ficha="https://www.buscalibre.cl/libro-la-posicion-correcta-sobre-la-bicicleta-biomecanica-del-ciclismo/9788479029043/p/6152675",
      titulo="La posición correcta sobre la bicicleta", autor="Juliane Neub", pais="Alemania",
      categorias=["entrenamiento"], anio=2012, editorial="Tutor",
      extra="Biomecánica y ajuste de la bici · Ediciones Tutor",
      resena="La biomecánica del contacto ciclista-máquina explicada sin misterios: talla, sillín, calas y potencias de brazo, con método para ajustarse la bici uno mismo. Menos lesiones y más watts por el precio de un libro."),
 dict(isbn="9788425516146", ficha="https://www.buscalibre.cl/libro-ciclismo-en-carretera-coi/9788425516146/p/3345426",
      titulo="Ciclismo en carretera", autor="Robert J. Gregor, Francesco Conconi", pais="Italia",
      categorias=["entrenamiento", "ruta"], anio=2012, editorial="Hispano Europea",
      extra="Manual científico de la serie COI · Hispano Europea",
      resena="El manual científico del ciclismo de carretera de la serie del Comité Olímpico Internacional: fisiología, biomecánica y entrenamiento reunidos por Gregor y Conconi, uno de los fisiólogos del deporte italiano. Tecnificación seria para competidores."),
 dict(isbn="9788498296631", ficha="https://www.buscalibre.cl/libro-manual-practico-de-ciclismo-gravel/9788498296631/p/55982405",
      titulo="Manual práctico de ciclismo gravel", autor="Javier Bañón Izu", pais="España",
      categorias=["mtb", "entrenamiento"], anio=None, editorial="Ediciones Desnivel",
      extra="Guía gravel · Ediciones Desnivel",
      resena="El gravel es el boom del cicloturismo técnico y Bañón, editor de Desnivel, escribe su manual en español: qué bici, qué ruedas, qué rutas y qué espíritu. La entrada en castellano a la disciplina entre carretera y montaña."),
 dict(isbn="9788496349544", ficha="https://www.buscalibre.cl/libro-en-bicicleta-por-los-puertos-un-relato-con-las-caracteristicas-basicas-de-los-principales-puertos-de-montana-del-mundo-del-ciclismo/9788496349544/p/51084260",
      titulo="En bicicleta por los puertos", autor="Frederic Ràfols Barrufet", pais="España",
      categorias=["ruta", "aventura"], anio=2007, editorial="El Cep i la Nansa",
      extra="Los grandes puertos de montaña del mundo · El Cep i la Nansa",
      resena="Relato y ficha de los principales puertos de montaña del ciclismo mundial: distancia, pendiente, historia y la experiencia de subirlos a pedal. Libro de viaje y de referencia para quien planifica viajes con un Tour en el mapa."),
 dict(isbn="9789587982596", ficha="https://www.buscalibre.cl/libro-ciclismo-urbano-avances-y-retos-para-el-caso-de-bogota/9789587982596/p/54151215",
      titulo="Ciclismo urbano. Avances y retos para el caso de Bogotá", autor="Álvaro Rodríguez Valencia, Daniel Rosas Satizábal, Rafael Unda, Germán A. Barrero", pais="Colombia",
      categorias=["aventura", "personas"], anio=2022, editorial="Universidad de los Andes",
      extra="Estudio académico · Universidad de los Andes (Bogotá)",
      resena="Bogotá es la capital mundial de la ciclovía y este estudio académico analiza sus avances y sus retos: infraestructura, seguridad y políticas públicas de la bici como transporte. Contexto latinoamericano que ningún catálogo extranjero tiene."),
 dict(isbn="9788490880036", ficha="https://www.buscalibre.cl/libro-ciclismo-adaptado/9788490880036/p/46304853",
      titulo="Ciclismo adaptado", autor="Juan Tomás Giménez Cases", pais="España",
      categorias=["personas", "entrenamiento"], anio=2014, editorial="Formación Alcalá",
      extra="Paraciclismo y actividad física adaptada · Formación Alcalá",
      resena="El ciclista con discapacidad y el paraciclismo en el marco de la actividad física adaptada: beneficios, práctica y metodología, de un profesor universitario especialista. La bici como deporte inclusivo, un hueco que ningún catálogo cubría."),
]

fichas = json.load(open(f"{BASE}/fichas-nuevas-candidatas.json"))
por_isbn = {f["isbn_en_url"]: f for f in fichas}
lote = []
for c in L:
    f = por_isbn.get(c["isbn"])
    assert f, f"no está la ficha de {c['isbn']} ({c['titulo']})"
    assert norm(f["enlace_ficha"]) == norm(c["ficha"]), f"enlace difiere para {c['isbn']}"
    lote.append({
        "titulo": c["titulo"], "tipo": "libro", "idioma": "es",
        "categorias": c["categorias"], "anio": c["anio"], "autor": c["autor"],
        "pais": c["pais"], "extra": f"{c['extra']} · Editorial {c['editorial']}",
        "urlExterna": c["ficha"], "resena": c["resena"],
        "proveedor": "buscalibre.cl", "portada": None, "isbn": c["isbn"],
    })

# ---------- año y portada vía Open Library / Google Books ----------
def gb_portada(isbn=None, q=None):
    url = ("https://www.googleapis.com/books/v1/volumes?q=isbn:" + isbn if isbn
           else "https://www.googleapis.com/books/v1/volumes?q=" + urllib.request.quote(q))
    raw = http_get(url)
    if not raw:
        return None
    try:
        items = json.loads(raw).get("items") or []
    except Exception:
        return None
    for it in items[:3]:
        th = ((it.get("volumeInfo") or {}).get("imageLinks") or {}).get("thumbnail")
        if th:
            return th.replace("http://", "https://").replace("&edge=curl", "")
    return None

sin_anio = [l for l in lote if l["anio"] is None]
print("verificación OL de los sin año:")
for l in sin_anio:
    docs = ol_buscar(f"{l['titulo']} {l['autor']}")
    l["ol_docs"] = docs
    for d in docs[:2]:
        print(f"  «{l['titulo']}» → OL: {d.get('title')} | {', '.join(d.get('author_name', []))[:40]} | {d.get('first_publish_year')} | {d.get('publisher', [])[:2]}")
    time.sleep(1)

# años que OL confirma de forma segura (edición/obra verificada a mano tras ver salida):
ANIO_OL = {}
for l in lote:
    if l["anio"] is None and l.get("ol_docs"):
        pass  # se decide tras revisar la impresión; v4: null si no es seguro

print("\nresolución de portadas:")
for l in lote:
    p = f"https://covers.openlibrary.org/isbn/{l['isbn']}-L.jpg"
    ok = False
    if re.fullmatch(r"97[89]\d{10}|979\d{9}", l["isbn"] or ""):
        raw = http_get(p, timeout=15)
        if raw and len(raw) > 3000 and raw[:3] != b"GIF":
            l["portada"] = p; ok = True
    if not ok:
        q = None if re.fullmatch(r"\d{8}", l["isbn"] or "") else l["isbn"]
        g = gb_portada(isbn=q, q=None if q else f"{l['titulo']} {l['autor'].split(',')[0]}")
        if g:
            l["portada"] = g
    src = "OL" if l["portada"] and "openlibrary" in l["portada"] else ("GB" if l["portada"] else "—")
    print(f"  [{src}] {l['titulo'][:52]}")
    time.sleep(0.4)

json.dump(lote, open(f"{BASE}/lote-es-fichas-final.json", "w"), ensure_ascii=False, indent=1)
n = len(lote)
print(f"\nlote: {n} registros · con año: {sum(1 for l in lote if l['anio'])} · con portada: {sum(1 for l in lote if l['portada'])}")
print("guardado:", f"{BASE}/lote-es-fichas-final.json")
