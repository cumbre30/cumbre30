# Cultura Ciclista — documentación técnica (2026-11-22)

Módulo del menú lateral (AppDrawer → Zona 2 «Mi actividad») que incorpora a
Cumbre30 una biblioteca multimedia de libros, películas y documentales del
ciclismo, con la identidad visual de la app (emerald sobre dark) y la
estructura del mockup del cliente (`upload/cumbre30_cultura_ciclista_mockup.html`):
hero, buscador, filtros por tipo y categoría, destacados, carruseles
horizontales, ficha individual y favoritos.

## 1. Decisiones de arquitectura

**El catálogo vive en la base de datos conectada de la app (Postgres gestionado
en Neon, vía `DATABASE_URL`, a través de Prisma) — no en APIs externas.**
Conforme a la recomendación del cliente:

1. Semilla editorial curada a mano (`scripts/semilla-cultura.mjs`): 64
   recursos reales (33 libros · 10 películas · 21 documentales), con reseña
   editorial original de Cumbre30 y clasificación por categorías. Solo se
   incluyen títulos/autores/años verificables; cuando el año no es seguro se
   deja `null` (nada inventado).
2. **Idioma de la edición de referencia (v4)**: el campo `idioma` (ISO
   639-1: en|es|pt, migración aditiva `20261122200000_cultura_idioma`,
   default `en`) clasifica la EDICIÓN/VERSIÓN DE REFERENCIA, no el idioma
   original: las 11 obras no anglosajonas tienen edición/versión en inglés
   verificada con fuentes (The Rider: trad. Sam Garrett, Bloomsbury ·
   Ladri di biciclette: Criterion · Le gamin au vélo: Criterion ·
   Triplettes: Sony Pictures Classics · Beijing Bicycle: DVD/Blu-ray con
   subtítulos · Wadjda: Sony Pictures Classics · A Sunday in Hell:
   narración inglesa de David Saunders · Wonderful Losers: subtítulos ·
   Unchained: audio inglés en Netflix; Stars and Water Carriers y The
   Impossible Hour circulan en versión inglesa internacional, URL por
   confirmar). El idioma original va anotado en `extra` y la reseña se
   reescribió al inglés en la misma versión (regla v4: la reseña va en el
   idioma de la edición, sin excepciones). Lotes ES y PT (`semilla-cultura-es.mjs`,
   `semilla-cultura-pt.mjs`): fichas reales como BORRADORES con reseña
   nata en su idioma; el equipo publica por oleadas.
3. La ingesta (`scripts/ingesta-cultura.mjs`) ENRIQUECE metadatos desde los
   proveedores y solo completa campos vacíos; jamás sobreescribe el trabajo
   editorial (reseña, autor, categorías, enlace). Restricción por idioma
   según `idioma`: es → `language:spa`/`es-CL`, pt → `language:por`/`pt-BR`,
   en → corpus nativo.
3. Los carruseles se pintan SOLO desde la base propia: si Google Books, TMDB
   u Open Library están caídos, el módulo funciona exactamente igual. No hay
   llamada a proveedores en línea de petición.

### Portadas

- **Open Library covers** (`covers.openlibrary.org`): uso permitido por sus
  términos con atribución — la atribución vive en la nota al pie del módulo
  (`cu.footNota`). 22 libros quedaron con portada real tras la ingesta.
- **Respaldo procedural**: todo recurso pinta siempre una portada procedural
  (gradiente determinista por hash del id + icono del tipo + título), visible
  cuando no hay `portadaUrl`, cuando la imagen tarda o si la imagen falla
  (`onError`). Cero riesgo de licencia y funciona offline en el APK.
- TMDB y Google Books exigen condiciones de atribución adicionales para sus
  imágenes: por defecto NO se usan sus portadas (la ingesta las deja `null`;
  activarlas es una decisión editorial documentada en el script).

### Enlaces externos

`urlExterna` apunta a búsquedas legítimas (Open Library / IMDb / TMDB) o a
sitios oficiales. La app **no simula** reproducción ni compra: el botón de la
ficha abre la fuente en pestaña nueva (`target="_blank" rel="noopener noreferrer"`).

## 2. Modelo de datos (migraciones `20261122011856_cultura_ciclista` y `20261122200000_cultura_idioma`)

```prisma
model CulturaRecurso {          // tabla cultura_recursos
  id         String   @id @default(cuid())
  titulo     String
  resena     String              // reseña editorial propia, en el idioma de la edición (v4)
  tipo       String              // libro | pelicula | documental
  idioma     String   @default("en")  // edición/versión de referencia: en | es | pt (no el original)
  categorias String[]            // mtb | aventura | historia | ruta | entrenamiento | personas
  portadaUrl String?             // Open Library o null → portada procedural
  anio       String?             // admite "1978", "Serie", "Publicación"
  autor      String              // autor, director o productora
  extra      String?             // duración, páginas, formato…
  pais       String?
  urlExterna String
  proveedor  String  @default("editorial")  // editorial | …+open_library | +google_books | +tmdb
  publicado  Boolean @default(false)        // flujo editorial: borrador → publicado
  destacado  Boolean @default(false)        // fila «Para empezar»
  createdAt / updatedAt
  favoritos  CulturaFavorito[]
}

model CulturaFavorito {         // tabla cultura_favoritos
  id, userId → User (cascade), recursoId → CulturaRecurso (cascade)
  @@unique([userId, recursoId])  // un favorito por usuario y recurso
}
```

Índices: `tipo` y `(publicado, destacado)` para las consultas del módulo.
`User.culturaFavoritos` completa la relación.

## 3. API (backend propio; claves de proveedores nunca en el cliente)

| Endpoint | Descripción |
| --- | --- |
| `GET /api/cultura/recursos` | Catálogo publicado. Filtros combinables: `tipo`, `cat`, `q` (título/autor, insensible), `destacado=1`, `idioma` (es|en|pt — edición de referencia; valores inválidos se ignoran). Devuelve `{ recursos, favoritos: id[], total }` — los ids favoritos del usuario vienen en la misma respuesta. |
| `GET /api/cultura/favoritos` | Favoritos del usuario con sesión, con recurso completo. |
| `POST /api/cultura/favoritos` | `{ recursoId }` → agrega (idempotente, `upsert`). Rate limit 60/min. |
| `DELETE /api/cultura/favoritos?recursoId=` | Quita (idempotente). |

Todas exigen sesión (`getSessionUser`), con CORS/Bearer para el APK
(`apiCors`), el mismo patrón de `/api/friends`. Sin sesión → 401 honesto.

## 4. Ingesta de proveedores (`scripts/ingesta-cultura.mjs`)

- **Open Library** (sin clave): año de primera publicación, número de páginas
  y portada para libros. `User-Agent` propio y pausa de 350 ms por request.
- **Google Books** (`GOOGLE_BOOKS_API_KEY`, opcional): año y páginas de libros.
- **TMDB** (`TMDB_API_KEY`, Bearer v4): año, duración y país de películas y
  documentales (series vía `/search/tv`).
- Dry-run por defecto; `--aplicar` escribe. Un proveedor caído se registra y
  continúa (`0 fallos` en la corrida aplicada del 2026-11-22: 24
  enriquecimientos, 22 portadas).
- Reglas: solo completa `anio`/`pais`/`extra`/`portadaUrl` vacíos; `proveedor`
  queda trazable (`editorial+open_library`); nunca toca reseña/autor/categorías/enlace.

## 5. Frontend (`src/components/CulturaView.tsx`)

- **Hero** con eyebrow, título del mockup («La cultura también se pedalea.»),
  cuerpo y dos CTA (Explorar la biblioteca / Mis favoritos).
- **Buscador** (título y autor, client-side sobre el catálogo completo —
  respuesta instantánea) + **filtros**: el SELECTOR DE IDIOMA como PRIMERA
  fila (Todos · Español · Inglés · Portugués — v4: filtrar por edición de
  referencia; preajuste al idioma de la interfaz solo si ese idioma tiene
  recursos publicados, con caída a Todos; la elección explícita persiste en
  el dispositivo, clave `cultura-idioma`; estado vacío por idioma con CTA
  «Ver todo el catálogo»), chips de tipo (Todo/Libros/Películas/
  Documentales) y de categoría (Todas/MTB/Aventura/Historia/Ruta/Entrenamiento/
  Historias humanas), todos con estado `aria`.
- **Destacados**: tarjetas dobles con reseña truncada y «Conocer más».
- **Carruseles**: `overflow-x-auto` + `snap-x snap-mandatory` + tarjetas
  `snap-start` (gesto táctil nativo en Android), 6 rails — Libros, Películas,
  Documentales, MTB y Downhill, Aventura y Bikepacking, Historia y Cultura —
  cada uno con «Ver colección →» que activa el filtro correspondiente. Un
  recurso puede aparecer en varios rails (pertenece a varias categorías).
- **«Para tu perfil»**: carrusel complementario que mapea el arquetipo del
  Perfil Ciclista (`/api/profile`) a categorías (CLIMBER→ruta/mtb, EXPLORER→
  aventura/mtb, URBAN→historia/personas, etc., + eje exploración ≥70 →
  aventura). Falla en silencio y JAMÁS restringe el catálogo completo
  (requisito §6 del brief).
- **Ficha**: modal (`role="dialog"`) con portada, badge de tipo, título, año ·
  autor · país, chip de idioma de la edición (v4) + chips de categorías,
  reseña, dato extra (donde va anotado el idioma original de las obras
  traducidas), enlace externo y favorito. Cierra con Escape y con clic en
  el fondo.
- **Favoritos**: corazón con actualización optimista y reversión si el
  servidor no confirma; vista «Mis favoritos» con estado vacío honesto.
- **Estados**: carga (skeleton), error con reintentar, catálogo vacío /
  búsqueda sin resultados (`cu.sinResultados`), y modo sin backend en el APK
  estático (`cu.noBackend`, patrón AmigosTab).
- **Política de invitados**: la pantalla `cultura` exige sesión como el resto
  de las sub-pantallas del menú (historial/stats): sin sesión se muestra
  `PanelSesionRequerida` y no se llama al servidor.

## 6. i18n

Bloque `cu.*` (54 claves, incluido el selector de idioma v4: `cu.filtroIdiomaAria`,
`cu.idioma*`, `cu.fichaIdioma*`, `cu.vacioIdioma*`) + `menu.cultura` +
`drawer.culturaHint`, completo en es/en/pt. La auditoría de
`tests/cultura.test.ts` verifica: toda clave usada por CulturaView está
declarada ×3 idiomas y no hay huérfanas.

## 7. Cómo correr

```bash
# migración (local) y semillas (editorial en + lotes ES/PT como borradores)
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 bunx prisma migrate deploy
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 bun scripts/semilla-cultura.mjs
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 bun scripts/semilla-cultura-es.mjs
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 bun scripts/semilla-cultura-pt.mjs

# ingesta de metadatos (dry-run / aplicar)
DATABASE_URL=... [GOOGLE_BOOKS_API_KEY=...] [TMDB_API_KEY=...] bun scripts/ingesta-cultura.mjs [--aplicar]

# pruebas
DATABASE_URL=... bun tests/cultura.test.ts          # 47 comprobaciones (catálogo, idioma v4, API, favoritos, i18n)
node scripts/invivo-cultura-ui.mjs                  # in-vivo en :3100 (21/21 con sesión real)
```

En producción (la base de datos conectada de la app — Neon vía `DATABASE_URL`):
la migración y la semilla editorial se aplican automáticamente en el build de
Vercel — `scripts/migrate-deploy.sh` corre `prisma migrate deploy` y luego
`node scripts/semilla-cultura.mjs` solo cuando el catálogo está incompleto o
la reescritura v4 no está aplicada (guard con marcador: reseña de The Rider
en inglés; `--forzar` para re-sincronizar a mano). El guard re-corre UNA vez
tras la migración de idioma (actualiza reseñas es→en e `idioma`) y salta en
builds futuros. La ingesta
es opcional y idempotente, con claves solo en variables de entorno del backend.

## 8. Aceptación del brief — evidencias

| Requisito | Evidencia |
| --- | --- |
| 1. Integrado en la app | Menú lateral → pantalla `cultura` (`page.tsx`, `AppDrawer`). |
| 2. Carruseles funcionales | In-vivo: 6 rails, scroll táctil verificado (0 → 316 px). |
| 3. Búsqueda y filtros correctos | Tests 14-20 de `cultura.test.ts` + in-vivo («krabbé» → The Rider; filtro Películas). |
| 4. Fichas completas | In-vivo ficha con portada, reseña, meta, extra, categorías. |
| 5. Enlaces externos | `https://` verificado en los 64 recursos (test) + enlace en ficha. |
| 6. Favoritos por usuario | Tests de aislamiento A/B, idempotencia y persistencia + in-vivo. |
| 7. Fuente persistente | 64 recursos en `cultura_recursos`; el módulo no llama a APIs externas. |
| 8. Android | Viewport 412×915 en todos los in-vivo; scroll táctil nativo; APK cubierto por `noBackend`/Bearer. |
| 9. Estados carga/error/vacío | `cu-cargando`, `cu-error` + reintentar, `cu.sinResultados`, `cu.favoritosVacio`, `cu.noBackend`. |
| 10. Sin regresiones | 13 suites previas OK (explorar-view 61/61, comunidad, fase-f, pro-muro…), tsc en baseline, build OK. |

## 9. Política de enlaces externos (v4.2)

Principio: el módulo ayuda a DESCUBRIR el ciclismo y sus especialidades, pero
descubrir no es conseguir gratis — cada obra es de pago (libro físico/Kindle,
cine o streaming) y el enlace de la ficha («Consultar ↗») debe llevar a un
destino legítimo de búsqueda/compra, nunca a contenido pirata ni a simulación
de reproducción dentro de la app.

| Segmento | Destino de `urlExterna` | Motivo |
| --- | --- | --- |
| Libros `es` | Buscalibre Chile — `https://www.buscalibre.cl/libros/search?q=<titulo+autor>` | Catálogo local en español verificado (p. ej. *Elogio de la bicicleta* en 2 ediciones), precios en CLP y envío nacional; la búsqueda por título+autor sobrevive a cambios de stock y edición. Formato confirmado vía robots.txt propio de Buscalibre y URLs indexadas. |
| Libros `en` | Amazon — `https://www.amazon.com/s?k=<titulo+autor>` | Catálogo global + Kindle para las ediciones de referencia en inglés (todo el catálogo vigente es `en`); la búsqueda reemplaza a Open Library (préstamo gratuito, contradice el principio). |
| Libros `pt` | Amazon Brasil — `https://www.amazon.com.br/s?k=<titulo+autor>` | Catálogo local en BRL para las ediciones pt-BR del lote. |
| Películas / documentales | IMDb find / TMDB search (sin cambios) | Páginas de acceso/buscar donde ver; una mejora futura podría apuntar a JustWatch por país. |

Implementación: helpers `bc()` / `am()` / `amBr()` en las semillas. El catálogo
publicado (64 obras) se actualiza solo con el guard del build de producción
(`migrate-deploy.sh` → `semilla-cultura.mjs`, que re-corre UNA vez tras la
migración de idioma); los lotes ES/PT (borradores) se siembran a mano contra
`DATABASE_URL` de producción después del despliegue. Open Library sigue como
fuente de METADATOS y portadas (ingesta), no como destino del enlace.
