# -*- coding: utf-8 -*-
"""Contenido (ES) de la propuesta de rediseño Cumbre30 — separado del motor."""

TITULO_DOC = "Cumbre30 - Propuesta de Rediseño UX/UI y Navegación"

KICKER = "PROPUESTA DE REDISEÑO UX/UI · FASES 1-2"
RESUMEN_COVER = ("Arquitectura de navegación, sistema de diseño y prototipo navegable para simplificar "
                 "la app en tres destinos, priorizar la información de conducción y hacer visible el "
                 "valor de PRO sin perjudicar la experiencia FREE. Elaborada sobre el estado real del "
                 "código (v1.5.0, build 21).")
META_COVER = "Versión de la app: 1.5.0 (build 21)  ·  Santiago de Chile  ·  Noviembre 2026"
FOOTER_COVER = "CICLOCOMPUTADOR · CERRO SAN CRISTÓBAL · PARQUEMET"

# ============================================================
# CAPÍTULO 1
# ============================================================
CH1 = {
"titulo": "1. Resumen ejecutivo y alcance",
"parrafos": [
 ("Este documento responde al brief de rediseño de CUMBRE30 con las Fases 1 y 2 solicitadas: una "
  "auditoría de la interfaz actual hecha directamente sobre el código fuente (componentes, "
  "navegación y bloqueos FREE/PRO reales) y un prototipo navegable de alta fidelidad que valida la "
  "estructura propuesta antes de tocar la aplicación. La propuesta no reemplaza funcionalidades "
  "operativas: cada pantalla actual tiene un destino definido en la nueva arquitectura, y las "
  "decisiones que implican cambios de comportamiento quedan listadas en el capítulo 9 para "
  "aprobación expresa antes de implementar."),
 ("El rediseño se organiza en tres movimientos. Primero, simplificar la navegación: las seis "
  "pestañas actuales se convierten en una barra inferior de tres destinos (Ride, Explorar, Acceso) "
  "más un menú lateral que agrupa Mi actividad, Cuenta, la tarjeta PRO y el plan vigente. Segundo, "
  "rejerarquizar la pantalla de conducción: la velocidad pasa a ser el dato visual dominante, el "
  "mapa y el botón principal se ordenan según el flujo real de pedaleo y las estadísticas "
  "secundarias se agrupan en una sección expandible. Tercero, hacer visible la diferencia "
  "FREE/PRO: un indicador de plan en el encabezado, una tarjeta PRO en el menú, un modal de "
  "bloqueo contextual que explica el beneficio concreto y una pantalla de comparación de planes "
  "con funcionalidades reales verificadas en el código."),
 ("El alcance de esta etapa es estrictamente de diseño y organización. No se agregan "
  "funcionalidades nuevas: el ciclocomputador, el motor de navegación con rutas ciclables, el "
  "registro de viajes, el QR de entrada, la ficha médica, los desafíos y todos los beneficios Pro "
  "existentes (buscador universal, segmentos, GPX, constancias PDF) se conservan tal como "
  "funcionan hoy. La única extensión de motor propuesta es la pausa del ride, que el brief pide "
  "explícitamente en el botón principal (iniciar, pausar, finalizar) y que queda marcada como "
  "decisión pendiente por implicar una modificación controlada de useRideEngine."),
],
"callouts": [("6 → 3", "pestañas → destinos inferiores"),
             ("84 px", "velocidad como dato dominante"),
             ("0", "funcionalidades eliminadas")],
}

# ============================================================
# CAPÍTULO 2 — Auditoría
# ============================================================
CH2 = {
"titulo": "2. Auditoría de la interfaz actual",
"intro": ("La auditoría se realizó leyendo el código fuente de la app (rama principal, v1.5.0) y "
 "recorriendo cada pantalla en el navegador. El objetivo no es critizar la estética sino ubicar "
 "problemas de arquitectura de información: qué compite con qué, qué se descubre tarde y dónde se "
 "rompe la jerarquía durante la conducción."),
"s21_t": "2.1 Inventario técnico y de componentes",
"s21": ("La app es un proyecto Next.js (App Router) con React, Tailwind y componentes shadcn/ui, "
 "empaquetada como APK Android con Capacitor (appId cl.cumbre30.app). La pantalla principal "
 "(page.tsx) monta un encabezado fijo, un TabsList de seis pestañas y una barra de control inferior "
 "con el selector Demo/GPS real y el botón de iniciar/detener. Los componentes de pantalla son "
 "RideView (ciclocomputador con MiniMap 3D de navegación), MapView (mapa general Leaflet con "
 "buscador de direcciones Pro), Wallet (QR de entrada Parquemet, ficha médica y datos de "
 "bicicleta), HistoryTab (viajes, constancias PDF, GPX y segmentos), ChallengesTab (desafíos y "
 "pin del mapa) y ProfileTab (cuenta, activación Pro, aportes y enlaces). La lógica vive en "
 "useRideEngine (estados idle/running, GPS nativo o simulado) y useNavEngine (rutas: grafo local "
 "del cerro más OSRM bike para el resto de Santiago)."),
"s22_t": "2.2 Navegación actual",
"s22": ("La navegación tiene seis destinos con el mismo peso visual: Ride, Mapa, Historial, QR, "
 "Premios y Perfil. En un teléfono (max-w-md) el TabsList es una grilla de seis columnas donde "
 "solo caben los íconos: las etiquetas se ocultan (hidden lg:inline) y el usuario debe adivinar "
 "qué significa cada símbolo. Además conviven dos zonas de mando: las pestañas arriba del "
 "contenido y la barra de control abajo, con el selector de fuente de datos (Demo/GPS) pegado al "
 "botón Iniciar ride, a la misma altura y con un tamaño comparable. La pestaña llamada QR agrupa "
 "en realidad tres cosas (QR de acceso, ficha médica de emergencia y datos de la bicicleta), y el "
 "acceso a la activación Pro vive escondido al final de Perfil."),
"s23_t": "2.3 Pantalla Ride: jerarquía de la información",
"s23": ("El orden actual de la pantalla es: minimapa con banner de maniobra, banner de zona, una "
 "tarjeta de dos columnas donde velocidad y distancia usan exactamente el mismo tamaño tipográfico "
 "(text-5xl en ambos), un texto suelto de precisión GPS, el contador de exceso, una grilla de seis "
 "StatTiles (máximo, promedio, tiempo, desnivel, pendiente, GPS), las indicaciones de ruta y la "
 "bitácora. El problema central es que todo tiene un peso similar: durante la conducción no existe "
 "un dato dominante al que vuelva la mirada, y métricas que solo se consultan al final del viaje "
 "(desnivel acumulado, máxima en parque) ocupan permanentemente la mitad de la pantalla. El "
 "selector Demo/GPS es una herramienta de prueba que hoy compite con el botón principal de ride."),
"s24_t": "2.4 Mapa y monetización FREE/PRO",
"s24": ("En el mapa general, un usuario FREE ve permanentemente una tarjeta de teasé con botón "
 "ámbar \"Es parte de Cumbre30 Pro\" que ocupa el lugar del buscador y lo salta a la pestaña "
 "Perfil, perdiendo el contexto. Es exactamente el patrón de interrupción invasiva que el brief "
 "pide evitar: el aviso está siempre presente aunque el usuario solo quiera mirar el mapa o su "
 "ubicación. Los demás candados Pro están dispersos (constancias y GPX en Historial, segmentos en "
 "Historial, buscador en Mapa) y no existe ningún indicador global de plan: un usuario Pro no "
 "puede distinguirse de uno FREE en ninguna pantalla salvo dentro de Perfil. La comparación de "
 "planes no existe: el valor de Pro se explica solo por listas de beneficios."),
"s25_t": "2.5 Identidad visual actual",
"s25": ("Los tokens base son los valores por defecto de shadcn/ui (grises oklch neutros) con el "
 "verde aplicado de forma ad-hoc: botones emerald-600, éxitos en emerald y el Pro asociado a un "
 "ámbar de tipo aviso (amber-500), que compite con los banners reales de precaución. El modo "
 "oscuro existe pero es opcional vía botón de tema en el encabezado, y el claro es un tema "
 "genérico blanco sin relación con la marca. Los radios mezclan rounded-lg, xl y 2xl entre "
 "componentes equivalentes, y hay bordes en casi todo. El resultado es funcional pero no expresa "
 "la identidad deportiva-tecnológica ni aprovecha el verde como color de acción."),
"hallazgos_t": "2.6 Matriz de hallazgos",
"hallazgos_intro": ("La siguiente matriz resume los hallazgos con su evidencia en código y su "
 "severidad. La severidad pondera impacto en uso diario y en el objetivo de negocio declarado en "
 "el brief (visibilidad de PRO)."),
"hallazgos": [
 ["Hallazgo", "Evidencia en código", "Impacto", "Severidad"],
 ["Seis pestañas solo con íconos en móvil", "page.tsx: TabsList grid-cols-6, etiquetas hidden lg:inline", "Descubribilidad y orientación", "Alta"],
 ["Sin indicador global de plan", "No existe badge FREE/PRO fuera de Perfil", "Diferenciación FREE/PRO invisible", "Alta"],
 ["Teaser Pro invasivo en el mapa", "MapView: tarjeta ámbar fija en modo FREE, salta a Perfil", "Experiencia FREE interrumpida", "Alta"],
 ["Velocidad sin dominancia visual", "RideView: velocidad y distancia con igual tamaño (text-5xl)", "Jerarquía de conducción", "Alta"],
 ["Selector Demo/GPS junto a Iniciar", "page.tsx: radiogroup en la barra inferior", "Confusión y toques erróneos", "Media-alta"],
 ["Estadísticas secundarias siempre visibles", "RideView: 6 StatTiles permanentes + precisión suelta", "Saturación en marcha", "Media"],
 ["Pestaña QR mezcla tres funciones", "Wallet.tsx: QR + ficha médica + bicicleta", "Claridad del destino Acceso", "Media"],
 ["Verde y ámbar aplicados ad-hoc", "emerald-600/amber-500 hardcodeados en componentes", "Consistencia y marca", "Media"],
 ["Encabezado saturado", "Tema + sonido + voz + chip GPS en una línea", "Foco y legibilidad", "Media-baja"],
],
}

# ============================================================
# CAPÍTULO 3 — Arquitectura
# ============================================================
CH3 = {
"titulo": "3. Arquitectura de navegación propuesta",
"s31_t": "3.1 Principios",
"s31": ["Acceso al ciclócomputador en un toque: Ride es el destino inicial y nunca está a más de "
 "un toque de distancia.",
 "Un propósito por pantalla: cada destino inferior responde a una sola pregunta (voy a pedalear, "
 "quiero explorar, voy a entrar al parque).",
 "El QR permanece como destino inferior por su frecuencia antes de ingresar al parque, tal como "
 "pide el brief.",
 "PRO visible sin invadir: etiquetas y candados discretos en contexto; interrupción solo cuando el "
 "usuario intenta usar la función.",
 "Oscuro como identidad por defecto, con verde reservado a acciones y estado activo."],
"s32_t": "3.2 Navegación inferior (3 destinos)",
"s32_intro": ("La barra inferior reemplaza al TabsList y a la actual barra de control. El botón "
 "principal de ride deja de convivir con el selector Demo/GPS: se integra a la pantalla Ride como "
 "acción primaria de 58 px en zona del pulgar."),
"s32": [
 ["Destino", "Contenido", "Viene de (estado actual)"],
 ["Ride", "Ciclocomputador, velocidad dominante, minimapa con ruta, iniciar/pausar/finalizar, estadísticas y bitácora", "Pestaña Ride + barra inferior"],
 ["Explorar", "Mapa a pantalla amplia, ubicación, buscador de direcciones (Pro), POI del cerro, incidencias y controles agrupados", "Pestaña Mapa"],
 ["Acceso", "QR de entrada Parquemet a pantalla completa, ficha médica de emergencia y datos de la bicicleta", "Pestaña QR (Wallet)"],
],
"s33_t": "3.3 Menú lateral",
"s33_intro": ("El menú se abre desde el encabezado y concentra lo que no necesita estar a un toque "
 "durante el pedaleo. Su jerarquía es fija: PRO, Mi actividad, Cuenta y Plan actual."),
"s33": [
 ["Sección", "Ítems", "Fuente actual"],
 ["CUMBRE30 PRO", "Tarjeta destacada con texto del brief, acceso a comparación de planes y botón Descubrir PRO", "Tarjeta Pro dentro de Perfil"],
 ["Mi actividad", "Historial de viajes · Estadísticas generales · Desafíos y logros", "Pestañas Historial y Premios; estadísticas de Perfil"],
 ["Cuenta", "Perfil · Configuración (Demo/GPS, sonido, voz, tema) · Ayuda", "Pestaña Perfil; controles del encabezado"],
 ["Plan actual", "Indicador FREE/PRO y acceso a la información de la suscripción", "No existe hoy (nuevo, sin lógica nueva de pago)"],
],
"s34_t": "3.4 Mapa de migración (nada se pierde)",
"s34_intro": ("Cada pantalla y control actual tiene destino explícito. Los casos marcados requieren "
 "confirmación porque el brief no los menciona nominalmente."),
"s34": [
 ["Elemento actual", "Destino nuevo", "Estado"],
 ["Pestaña Ride + botón Iniciar/Detener", "Ride (con pausa propuesta)", "Confirmado"],
 ["Pestaña Mapa y su buscador", "Explorar, con bloqueo PRO contextual", "Confirmado"],
 ["Pestaña QR (Wallet)", "Acceso", "Confirmado"],
 ["Pestaña Historial (viajes, PDF, GPX, segmentos)", "Menú → Mi actividad → Historial de viajes", "Confirmado"],
 ["Pestaña Premios (desafíos y pin)", "Menú → Mi actividad → Desafíos y logros", "Pendiente de aprobación"],
 ["Pestaña Perfil (cuenta, Pro, aportes, APK)", "Menú → Cuenta → Perfil (y Ayuda)", "Confirmado"],
 ["Selector Demo/GPS", "Configuración → Fuente de datos (persiste el último valor)", "Pendiente de aprobación"],
 ["Botones de sonido, voz y tema del encabezado", "Configuración", "Pendiente de aprobación"],
 ["Tarjeta teaser Pro del mapa", "Se elimina; la reemplaza el modal contextual al intentar buscar", "Confirmado"],
],
"s35_t": "3.5 Diagrama de la arquitectura",
"s35": ("El diagrama muestra la relación entre la barra inferior, el menú lateral y el contenido "
 "que migra a cada destino. La tarjeta Pro encabeza el menú porque es la superficie comercial "
 "principal, seguida del agrupado de actividad y cuenta."),
}

# ============================================================
# CAPÍTULO 4 — Sistema de diseño
# ============================================================
CH4 = {
"titulo": "4. Sistema de diseño y componentes",
"intro": ("Antes de pintar pantallas se consolida un sistema único de tokens y componentes. La "
 "paleta es la definida en el brief; el modo oscuro pasa a ser el tema principal y el verde se "
 "reserva para acciones primarias, navegación activa y estados importantes. Los tokens se "
 "implementarán sobre las variables CSS existentes (compatibles con shadcn/ui), de modo que los "
 "componentes actuales hereden la nueva identidad sin reescribirse."),
"s41_t": "4.1 Tokens de color",
"s41": [
 ["Token", "Hex", "Uso principal"],
 ["Verde principal", "#00A86B", "Acciones primarias, navegación activa, velocidad en rango"],
 ["Verde profundo", "#075C3B", "Gradientes, presionado, banner de modo parque"],
 ["Verde luminoso", "#A7E5BD", "Acentos y textos destacados sobre fondo oscuro"],
 ["Fondo oscuro", "#101C19", "Fondo de la app (identidad principal)"],
 ["Fondo de tarjetas", "#151817", "Superficies y tarjetas (variación elevada #1B2622)"],
 ["Texto principal", "#F5F8F6", "Contenido legible (contraste 15.9:1 sobre fondo)"],
 ["Texto secundario", "#9AA6A0", "Etiquetas, metadatos (contraste 5.4:1 sobre fondo)"],
 ["Rojo de exceso", "#E5534B", "Solo estados de peligro y finalizar ride"],
 ["Ámbar de aviso", "#D9A03F", "Solo precaución por velocidad; ya no representa PRO"],
],
"s41_nota": ("El color de PRO pasa del ámbar al verde de marca (etiqueta luminosa, candado "
 "discreto, tarjeta con gradiente verde profundo), liberando el ámbar para su único significado "
 "real: precaución. Los contrastes del par texto/fondo y secundario/fondo superan los umbrales "
 "WCAG AA de 4.5:1, condición necesaria para uso a plena luz del sol."),
"s42_t": "4.2 Tipografía y escalas",
"s42": ("Se mantiene la familia sans de la app (Geist) para interfaz y la monoespaciada con "
 "dígitos tabulares para toda métrica. La escala propuesta es: velocidad hero 84 px con peso 800 "
 "y seguimiento negativo; métricas secundarias 20-23 px; títulos de sección 13-15 px; cuerpo "
 "12.5-13 px; etiquetas 10 px en mayúsculas con seguimiento amplio; chips y badges 9-10 px en "
 "700-800. Toda cifra que cambie en vivo usa tabular-nums para evitar saltos de layout, y la "
 "jerarquía se construye con peso y tamaño, no con colores adicionales."),
"s43_t": "4.3 Espaciado, radios y elevación",
"s43": ("Radios uniformes: 16 px para tarjetas, 14 px para botones, 13 px para controles de mapa "
 "y 999 px para chips. El espaciado sigue múltiplos de 4 (4/8/12/16/24) con un ritmo vertical de "
 "12 px entre bloques de la pantalla Ride. Las sombras se reservan para elementos flotantes "
 "(barra inferior, hoja modal, tarjeta de búsqueda sobre el mapa); las superficies estáticas se "
 "separan con borde de 1 px al 9 por ciento de opacidad, evitando el exceso de marcos. Los "
 "íconos son de trazo simple (lucide, ya en uso) con un solo grosor y se acompañan siempre de "
 "etiqueta cuando inician acciones."),
"s44_t": "4.4 Componentes reutilizables",
"s44_intro": ("Inventario de componentes a crear o consolidar una vez y reutilizar en todas las "
 "pantallas. Ninguno introduce dependencias nuevas."),
"s44": [
 ["Componente", "Variantes y estados", "Se usa en"],
 ["AppHeader", "Compacto: menú, marca, chip GPS, badge de plan", "Todas las pantallas"],
 ["BottomNav", "3 destinos, estado activo en verde", "Global"],
 ["SideMenu", "Drawer con tarjeta Pro, grupos y plan actual", "Global"],
 ["PlanBadge", "FREE (neutro) / PRO (verde luminoso), tocable", "Header, menú, planes"],
 ["ProCard", "Descubrir (FREE) / Activo (PRO)", "Menú lateral, Planes"],
 ["ProLockSheet", "Modal contextual: función, beneficio, diferencia, CTA, cerrar", "Buscador, GPX, segmentos, PDF"],
 ["PlanComparison", "Tabla FREE/PRO sobre datos reales", "Pantalla Planes"],
 ["MetricHero", "Velocidad dominante con estados ok/aviso/exceso", "Ride"],
 ["MetricRow", "Distancia y tiempo en pareja tabular", "Ride"],
 ["StatTile + ExpandableSection", "Grilla secundaria colapsable", "Ride"],
 ["EventLog", "Bitácora con severidad por color de punto", "Ride"],
 ["StatusBanner", "Modo parque / precaución / exceso", "Ride"],
 ["PrimaryCta", "Iniciar (verde) · Pausa/Reanudar (secundario) · Finalizar (rojo)", "Ride"],
 ["MapControls", "Columna derecha: centrar, capas, incidencias", "Explorar"],
],
"s45_t": "4.5 Estados FREE y PRO",
"s45": ("Todo elemento bloqueado comparte el mismo lenguaje: una etiqueta PRO en verde luminoso o "
 "un candado discreto junto al control, y al activarlo el ProLockSheet explica nombre de la "
 "función, beneficio concreto, diferencia respecto de FREE y ofrece dos salidas (conocer PRO o "
 "seguir usando lo gratuito). Se prohíben mensajes genéricos del tipo función bloqueada. Las "
 "funciones esenciales de seguridad y registro (GPS, límite de 30 km/h, inicio de ride, QR, "
 "bitácora) jamás se bloquean ni se interrumpen con comerciales."),
}

# ============================================================
# CAPÍTULO 5 — Prototipo
# ============================================================
CH5 = {
"titulo": "5. Prototipo navegable (Fase 2)",
"intro": ("El prototipo está entregado como archivo HTML autónomo "
 "(Cumbre30_Prototipo_Rediseno.html) que se abre en cualquier navegador y permite recorrer los "
 "estados clave: Ride detenido y en conducción con pausa, Explorar con búsqueda en modo PRO, "
 "bloqueo contextual en modo FREE, menú lateral y pantalla de planes. Un conmutador superior "
 "alterna FREE/PRO para verificar ambos estados sin tocar la app real. Las cifras del demo son "
 "simuladas; los precios y beneficios mostrados son los ya vigentes en la app."),
"s_ride_t": "5.1 Pantalla Ride (estados detenido y conducción)",
"s_ride": ("El orden de elementos sigue el brief: encabezado compacto (global), estado de zona, "
 "velocidad como dato dominante, minimapa con posición y ruta activa, botón principal de iniciar "
 "o pausar/finalizar, distancia y tiempo transcurrido, estadísticas secundarias agrupadas en "
 "sección expandible y bitácora del viaje. En conducción, las estadísticas quedan colapsadas por "
 "defecto (etiqueta oculto en marcha) y la velocidad cambia de color al acercarse al límite o "
 "superarlo, manteniendo el banner de seguridad. La pausa congela tiempo y distancia; finalizar "
 "restaura el estado inicial con la confirmación de guardado en el historial."),
"s_exp_t": "5.2 Explorar y Acceso",
"s_exp": ("Explorar concentra el mapa a pantalla amplia con el buscador flotante, la simbología "
 "de ciclovía y vía compartida, los POI del cerro y los controles agrupados a la derecha. En "
 "modo FREE el buscador se muestra con etiqueta PRO; al escribir se abre el bloqueo contextual "
 "una única vez por interacción, sin retirar ninguna función gratuita del mapa. La pestaña "
 "Acceso mantiene el QR como protagonista con acceso a pantalla completa que mantiene la pantalla "
 "encendida, y agrupa ficha médica y bicicleta en secciones colapsables."),
"s_menu_t": "5.3 Menú lateral y Planes",
"s_menu": ("El menú lateral implementa la jerarquía del brief con la tarjeta PRO en verde de "
 "marca, el texto sugerido y el botón Descubrir PRO; en modo PRO la tarjeta cambia a estado "
 "activo con el correo de la licencia. La pantalla de planes presenta el precio real (6.500 pesos "
 "chilenos, pago único) y la tabla comparativa con funcionalidades verificadas, sin beneficios "
 "inventados ni condiciones nuevas."),
"figs": [
 ("fig-ride-run.png", "Figura 2. Ride en conducción: velocidad dominante, minimapa con ruta, pausa/finalizar y distancia-tiempo bajo el botón."),
 ("fig-drawer.png", "Figura 3. Menú lateral: tarjeta PRO en verde de marca, Mi actividad, Cuenta y plan actual."),
 ("fig-explorar.png", "Figura 4. Explorar en modo PRO: buscador con resultados, ruta trazada y controles agrupados."),
 ("fig-planes.png", "Figura 5. Comparación de planes con precio y beneficios reales."),
],
}

# ============================================================
# CAPÍTULO 6 — Comparación FREE/PRO
# ============================================================
CH6 = {
"titulo": "6. Comparación de planes FREE / PRO",
"intro": ("La tabla valida la propuesta inicial del brief contra las funcionalidades que existen "
 "hoy en el código. Se añaden tres filas que el borrador no mencionaba (constancias PDF, GPX y "
 "segmentos) porque ya están implementadas y son la diferencia real entre planes; no se inventó "
 "ningún beneficio ni condición. El precio mostrado es el vigente: 6.500 pesos, pago único, con "
 "el enlace de Mercado Pago ya integrado."),
"tabla": [
 ["Funcionalidad", "FREE", "PRO"],
 ["Ciclocomputador y límite 30 km/h", "Sí", "Sí"],
 ["GPS real y registro de viajes", "Sí", "Sí"],
 ["Estadísticas básicas y bitácora", "Sí", "Sí"],
 ["Acceso QR, ficha médica y bicicleta", "Sí", "Sí"],
 ["Mapa general, alertas e incidencias", "Sí", "Sí"],
 ["Desafíos y logros", "Sí", "Sí"],
 ["Constancias PDF", "3 al mes", "Ilimitadas"],
 ["Buscador universal de direcciones y marcadores", "No", "Sí"],
 ["Herramientas avanzadas de rutas (segmentos del cerro)", "No", "Sí"],
 ["Export GPX (Strava, Garmin, Komoot)", "No", "Sí"],
],
"nota": ("Correspondencia con la propuesta del brief: búsqueda de direcciones y herramientas "
 "avanzadas de rutas coinciden con los gates reales existentes (geocode y segmentos). El "
 "ciclocomputador, GPS, registro, estadísticas, QR y mapa quedan explícitamente como core gratis "
 "y sin límites de uso. Si en el futuro se ajusta el límite de constancias gratuitas, se actualiza "
 "solo esta tabla y el texto de HistoryTab."),
}

# ============================================================
# CAPÍTULO 7 — Plan de implementación
# ============================================================
CH7 = {
"titulo": "7. Plan de implementación por etapas",
"intro": ("La implementación (Fase 3 del brief) no reescribe la aplicación: se ejecuta en cinco "
 "etapas cortas, cada una deja la app compilable y probada. No se compila APK nuevo hasta tener "
 "el paquete v1.6.0 (build 22) completo con segmentos y buscador, según lo acordado."),
"etapas": [
 ["Etapa", "Contenido", "Archivos principales"],
 ["A. Tokens", "Paleta y radios sobre variables CSS existentes; reemplazo de emerald/ámbar hardcodeados; oscuro por defecto", "globals.css, tailwind.config.ts, componentes con colores fijos"],
 ["B. Navegación", "AppHeader, BottomNav, SideMenu y pantalla Planes; migración de tabs según mapa 3.4", "page.tsx, nuevos AppHeader/BottomNav/SideMenu/PlansScreen"],
 ["C. Ride", "MetricHero, MetricRow, PrimaryCta con pausa (extensión useRideEngine), stats expandibles, Demo/GPS a Configuración con persistencia", "RideView.tsx, useRideEngine.ts, nueva SettingsScreen"],
 ["D. Explorar y PRO", "Buscador contextual con ProLockSheet, PlanBadge, PlanComparison, retirada del teaser ámbar", "MapView.tsx, proConfig.ts, nuevos ProLockSheet/PlanBadge"],
 ["E. Acceso y cierre", "Reorganización Acceso (QR+ficha+bici), Ayuda con contacto existente, revisión de safe areas", "Wallet.tsx → AccessScreen, ayuda"],
],
"validacion_t": "Validación (Fase 4)",
"validacion": ("El protocolo de pruebas cubre: navegación entre las tres secciones y el menú; "
 "GPS real con permisos; ciclo completo iniciar-pausar-reanudar-finalizar; guardado y consulta "
 "del historial; constancias PDF y GPX según plan; QR a pantalla completa con pantalla encendida; "
 "perfil y estadísticas; estado FREE y PRO con activación por código; funciones bloqueadas y su "
 "modal; apertura y cierre del menú; y comportamiento en pantallas de distintos tamaños "
 "(max-w-md en web y densidades de Android). Cada etapa termina con esta lista ejecutada en el "
 "navegador antes de pasar a la siguiente."),
}

# ============================================================
# CAPÍTULO 8 — Riesgos
# ============================================================
CH8 = {
"titulo": "8. Riesgos técnicos y mitigaciones",
"intro": ("Los riesgos se limitan a la reorganización de interfaz; no hay cambios de backend, de "
 "esquema de datos ni de monetización. El mayor cuidado está en no romper los gates Pro "
 "existentes ni el motor de ride, ambos verificados en la auditoría."),
"tabla": [
 ["Riesgo", "Prob.", "Impacto", "Mitigación"],
 ["Pausa altera métricas del ride (tiempo, promedio, constancias)", "Media", "Medio", "Extensión mínima de useRideEngine: flag paused que congela acumuladores; pruebas del ciclo completo y del PDF de constancia antes y después"],
 ["Regresión al reemplazar Tabs por BottomNav + drawer", "Media", "Alto", "Mantener el estado de tab interno y los dynamic imports; migración por etapas B→E con la app compilable en cada paso"],
 ["Cambio global de tokens altera legibilidad de mapas y banners", "Media", "Medio", "Revisión por componente con grep de colores fijos; contraste AA verificado; mapas conservan sus filtros de tema"],
 ["Modo claro degradado tras priorizar oscuro", "Baja", "Medio", "El tema claro se mantiene funcional con tokens equivalentes; verificación específica en la Fase 4"],
 ["Safe areas y alturas en Android (barra inferior fija)", "Media", "Bajo", "Conservar env(safe-area-inset-bottom) y probar en las densidades actuales del APK"],
 ["Discoveribilidad empeora al mover Premios/Perfil al menú", "Baja", "Medio", "Decisión explícita del usuario (cap. 9); el menú se abre desde el header siempre visible y las acciones quedan a un toque"],
 ["Duplicación de fuentes de verdad FREE/PRO", "Baja", "Medio", "Único hook useProLicense ya existente; PlanBadge y ProLockSheet leen de él"],
 ["Rendimiento con nuevos componentes", "Baja", "Bajo", "Cero dependencias nuevas; drawer y barra inferiores son CSS puro"],
],
}

# ============================================================
# CAPÍTULO 9 — Decisiones
# ============================================================
CH9 = {
"titulo": "9. Decisiones pendientes de aprobación",
"intro": ("Seis decisiones requieren tu confirmación antes de la Fase 3. Cada una incluye la "
 "recomendación del equipo de diseño. Responder con el número y la opción (por ejemplo: 1 sí, "
 "2 sí, 4 no) basta para desbloquear la implementación."),
"decisiones": [
 ["N", "Decisión", "Recomendación"],
 ["1", "Pausa del ride", "Sí: el brief la pide en el botón principal; extensión controlada de useRideEngine con métricas congeladas durante la pausa"],
 ["2", "Premios (desafíos y pin) dentro de Mi actividad", "Sí: el brief no lo menciona; conservarlo agrupado evita eliminar funcionalidad existente"],
 ["3", "Demo/GPS se mueve a Configuración y persiste el último valor", "Sí: es herramienta de prueba; no debe competir con Iniciar ride"],
 ["4", "Sonido, voz y tema salen del encabezado hacia Configuración", "Sí: encabezado compacto; los avisos quedan configurables una sola vez"],
 ["5", "Acceso agrupa QR + ficha médica + bicicleta", "Sí: mantiene la pestaña única del QR y ordena lo identitario; alternativa: ficha médica en Perfil"],
 ["6", "Tabla de planes con las filas del capítulo 6", "Sí: refleja gates reales (constancias 3/mes, buscador, segmentos, GPX) sin inventar beneficios"],
],
"cierre": ("Con estas decisiones confirmadas, la Fase 3 puede ejecutarse completa en una sola "
 "pasada de trabajo y dejar la app lista para la validación de la Fase 4 y, si corresponde, la "
 "compilación v1.6.0 (build 22) junto con los segmentos y el buscador ya terminados."),
}
