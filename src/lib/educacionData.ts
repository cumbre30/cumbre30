"use client";

// ============================================================
// Centro de Educación Ciclista (CEC) - datos de los módulos.
// v1 generada desde el mockup aprobado (download/mockup-centro-
// educacion-ciclista.html) por scripts/gen-educacion-data.mjs.
// v2 (feedback del cliente, 2026-11-20): es una iniciativa
// educativa de Cumbre30, sin vínculo con Parquemet ni con planes
// externos - se eliminaron sus menciones y se mantienen solo las
// citas a textos oficiales (LeyChile - BCN, CONASET, SII), cada
// módulo con un botón de acceso al recurso citado (enlace); nuevo
// CEC-001 de señales de mano con ilustraciones en
// public/educacion/*.svg, y el módulo de evaluación cierra la
// lista (CEC-015). Los ids se renumeraron por posición; progreso
// previo en c30.educacion puede resetearse sin problema (función
// educativa, sin certificación).
// El contenido de los módulos (reglas, citas legales, fuentes)
// permanece en español: la normativa citada es chilena y su texto
// oficial es en español; traducir citas implicaría parafrasearlas.
// Los textos de interfaz (chips, búsqueda, quiz, insignias) están
// en i18n (i18n.ts). Datos mantenidos a mano: NO regenerar con el
// script v1 (sobreescribiría estos cambios).
// ============================================================

export type QuizCEC = { q: string; alt: string[]; ok: number; exp: string };
export type RefCEC = { t: string; f: string; r: string; v: string };
export type ImagenCEC = { src: string; alt: string; cap: string };
export type EnlaceCEC = { etiqueta: string; url: string };
export type ModuloCEC = {
  id: string;
  cat: string;
  nivel: string;
  modo: string[];
  icono: string;
  titulo: string;
  desc: string;
  cuerpo: string[];
  recos: string[];
  refs: RefCEC[];
  act: string;
  imagenes?: ImagenCEC[];
  enlace?: EnlaceCEC;
  quiz?: QuizCEC;
};

/** Categorías (clave = cat del módulo; etiquetas vía i18n cat.*). */
export const CEC_CATS: string[] = ["pedalear","senalizacion","seguridad","emergencias","montana","evaluaciones","legal"];

/** URLs oficiales verificadas (BCN/LeyChile, CONASET, SII). */
export const URL_LEYTRANSITO = "https://www.bcn.cl/leychile/navegar?idNorma=1007469";
export const URL_LEYCONVIVENCIA = "https://www.bcn.cl/leychile/navegar?idNorma=1118358";
export const URL_REGLACICLOVIAS = "https://www.bcn.cl/leychile/navegar?idNorma=1162453";
export const URL_UTM = "https://www.sii.cl/valores_y_fechas/utm/utm2026.htm";
export const URL_MANUALES_CONASET = "https://www.conaset.cl/manuales";
export const URL_GUIA_CICLISTAS = "https://www.conaset.cl/wp-content/uploads/2024/09/Guia-para-ciclistas-en-Chile_CONASET_13-09-2024-1-1.pdf";

export const CEC_MODULOS: ModuloCEC[] = [
  {
    id: "CEC-001",
    cat: "senalizacion",
    nivel: "basico",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "🖐️",
    titulo: "Señales de mano: gira y detente avisando",
    desc: "Las tres señales que debes hacer con el brazo antes de virar o detenerte, con una ilustración para cada una.",
    cuerpo: [
      "La Ley de Tránsito obliga a señalizar los cambios de rumbo con el brazo o con un señalizador eléctrico adosado al cuerpo (art. 138); no hacer las señales debidas antes de virar es infracción menos grave (art. 201 N°5).",
      "Giro a la izquierda: brazo izquierdo extendido horizontalmente, paralelo al suelo, con la palma abierta.",
      "Giro a la derecha: brazo derecho extendido horizontalmente, paralelo al suelo (también es válida la variante con el brazo izquierdo flexionado hacia arriba).",
      "Detención o freno: brazo extendido hacia abajo, inclinado unos 45 grados respecto del cuerpo.",
      "Haz la señal unos 20 a 30 metros antes de la maniobra y vuelve a poner la mano en el manubrio antes de virar o de frenar con firmeza."
    ],
    recos: [
      "Practica las señales en línea recta y en un espacio abierto antes de usarlas dentro del flujo.",
      "De noche, refuerza la señal con las luces intermitentes: el brazo no refleja por sí solo."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito, art. 138 (señalización de virajes) y art. 201 N°5",
        f: "Biblioteca del Congreso Nacional - LeyChile (texto refundido vigente)",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    imagenes: [
      {
        src: "/educacion/senal-giro-izquierda.svg",
        alt: "Ciclista visto desde atrás con el brazo izquierdo extendido horizontalmente",
        cap: "Giro a la izquierda: brazo izquierdo extendido horizontal."
      },
      {
        src: "/educacion/senal-giro-derecha.svg",
        alt: "Ciclista visto desde atrás con el brazo derecho extendido horizontalmente",
        cap: "Giro a la derecha: brazo derecho extendido horizontal."
      },
      {
        src: "/educacion/senal-detencion.svg",
        alt: "Ciclista visto desde atrás con el brazo extendido hacia abajo",
        cap: "Detención: brazo extendido hacia abajo."
      }
    ],
    enlace: {
      etiqueta: "Ver art. 138 en LeyChile",
      url: URL_LEYTRANSITO
    }
  },
  {
    id: "CEC-002",
    cat: "pedalear",
    nivel: "basico",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "🚲",
    titulo: "Tu primera bici a medida",
    desc: "Ajuste de altura de asiento y manubrio, presión de neumáticos y chequeo previo de seguridad.",
    cuerpo: [
      "El asiento a la altura de la cadera con el pie apoyado en el pedal inferior y la pierna casi extendida evita dolor de rodillas.",
      "Presión de neumáticos según el lateral del neumático: menos presión = más agarre en tierra, más presión = menos esfuerzo en asfalto.",
      "Chequeo ABC antes de salir: Aire en neumáticos, Burro (frenos), Cadena y transmisión."
    ],
    recos: [
      "Revisa la bici 1 vez al mes aunque la uses poco.",
      "Lubrica la cadena cada 3 a 4 salidas."
    ],
    refs: [
      {
        t: "Manual de uso y mantenimiento - Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Guía para ciclistas en Chile",
        f: "CONASET, septiembre 2024",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Guía para ciclistas (CONASET)",
      url: URL_GUIA_CICLISTAS
    }
  },
  {
    id: "CEC-003",
    cat: "pedalear",
    nivel: "basico",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "⚖️",
    titulo: "Equilibrio y arranque seguro",
    desc: "Técnica para partir en bicicleta en cuestas, con carga y en la ciudad.",
    cuerpo: [
      "Pon el pedal de arranque a la altura de las 2 en punto y pisa fuerte mientras te impulsas con el otro pie.",
      "En cuesta, parte en diagonal para ganar un metro de pendiente menos pronunciada.",
      "Mira lejos, no al volante delantero: el equilibrio sigue a la vista."
    ],
    recos: [
      "Practica en un espacio abierto antes de pedalear por ciclovías.",
      "Con carga, baja un poco el asiento para apoyar mejor."
    ],
    refs: [
      {
        t: "Manual Integral de Educación y Seguridad Ciclista Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Guía para ciclistas en Chile",
        f: "CONASET, septiembre 2024",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Guía para ciclistas (CONASET)",
      url: URL_GUIA_CICLISTAS
    }
  },
  {
    id: "CEC-004",
    cat: "senalizacion",
    nivel: "basico",
    modo: [
      "urbano"
    ],
    icono: "🚦",
    titulo: "Lee la ciclovía: señales que sí importan",
    desc: "Semaforización propia de ciclovías, flechas de sentido y señales de integración con el tránsito.",
    cuerpo: [
      "Los semáforos con ícono de bicicleta regulan los cruces de ciclovía: respétalos igual que un semáforo vehicular.",
      "Las flechas pintadas en la pista indican el sentido obligatorio de circulación en cada franja.",
      "Las líneas punteadas marcan zonas de conflicto con peatones y cruces de vehículos: reduce y mira de frente y por los espejos."
    ],
    recos: [
      "En intersecciones, aunque tengas verde, confirma que el vehículo te vio.",
      "No circules por la vereda salvo excepción legal de seguridad."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito (texto refundido vigente)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Reglamento de ciclovías (DS 102/2019 MTT): diseño y señalización",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver reglamento de ciclovías en LeyChile",
      url: URL_REGLACICLOVIAS
    }
  },
  {
    id: "CEC-005",
    cat: "senalizacion",
    nivel: "intermedio",
    modo: [
      "urbano"
    ],
    icono: "📏",
    titulo: "Adelantamiento seguro: los 1,5 metros",
    desc: "Qué exige la ley al adelantar ciclistas y cómo protegerte en la maniobra.",
    cuerpo: [
      "Art. 120 de la Ley de Tránsito: al adelantar a bicicletas u otros ciclos, un vehículo motorizado debe mantener una distancia prudente de aproximadamente 1,50 metros durante toda la maniobra (norma incorporada por la Ley 20.068).",
      "El conductor que adelanta no debe volver a tomar la pista de la derecha hasta tener distancia suficiente y segura delante del ciclista.",
      "Como ciclista: circula por la ciclovía o por la pista derecha de la calzada; al adelantar a otro ciclista avisa con la voz o el timbre."
    ],
    recos: [
      "Usa espejo retrovisor o mira sobre el hombro antes de moverte.",
      "Luces traseras intermitentes de día aumentan tu visibilidad."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito, art. 120 (texto refundido vigente)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Ley 20.068 (2005) - modifica el art. 120",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver art. 120 en LeyChile",
      url: URL_LEYTRANSITO
    }
  },
  {
    id: "CEC-006",
    cat: "seguridad",
    nivel: "basico",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "🪖",
    titulo: "Casco: elige y ajusta bien",
    desc: "Tipos de casco, ajuste correcto y cuándo reemplazarlo.",
    cuerpo: [
      "El casco debe quedar nivelado sobre la frente, sin moverse al girar la cabeza.",
      "La hebilla forma una V alrededor de la oreja y queda apretada a un dedo bajo la barbilla.",
      "Reemplázalo tras un impacto fuerte o cada 3 a 5 años por desgaste del material."
    ],
    recos: [
      "El casco es obligatorio en Chile para ciclistas (Ley 18.290).",
      "Guárdalo sin exponerlo al calor directo del auto por largos periodos."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito (uso obligatorio, art. 80)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver art. 80 en LeyChile",
      url: URL_LEYTRANSITO
    }
  },
  {
    id: "CEC-007",
    cat: "seguridad",
    nivel: "intermedio",
    modo: [
      "urbano"
    ],
    icono: "🚶",
    titulo: "Convivencia con peatones",
    desc: "Prioridades, velocidad y comunicación en ciclovías y tramos compartidos.",
    cuerpo: [
      "En zonas compartidas y pasos peatonales, el peatón tiene la prioridad: reduce y pasa a distancia lateral segura.",
      "Anuncia tu presencia con timbre a unos 30 metros; un 'gracias' mantiene la convivencia.",
      "En tramos compartidos la velocidad de convivencia es baja: ajusta tu marcha a la de los peatones al superarlos y reduce en zonas de conflicto."
    ],
    recos: [
      "Baja del bici en los pasos peatonales si hay mucha gente.",
      "Evita audífonos con música alta: necesitas escuchar el entorno."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito (texto refundido vigente)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Reglamento de ciclovías (DS 102/2019 MTT)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver Ley de Convivencia Vial en LeyChile",
      url: URL_LEYCONVIVENCIA
    }
  },
  {
    id: "CEC-008",
    cat: "seguridad",
    nivel: "intermedio",
    modo: [
      "urbano",
      "mtb"
    ],
    icono: "🌧️",
    titulo: "Bici y clima: lluvia, viento y frío",
    desc: "Cómo cambian frenado, visibilidad y agarre según el clima.",
    cuerpo: [
      "Con lluvia, el frenado necesita el doble de distancia: frena antes y con ambos frenos suavemente.",
      "El viento lateral en descensos abiertos empuja el volante: agarra firme y baja la posición.",
      "El frío reduce la sensibilidad de los dedos: guantes siempre en invierno."
    ],
    recos: [
      "Reduce 30% tu velocidad habitual con pista mojada.",
      "Luces frontales y traseras obligatorias o recomendadas según condiciones de visibilidad."
    ],
    refs: [
      {
        t: "Manual Integral de Educación y Seguridad Ciclista Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Guía para ciclistas en Chile",
        f: "CONASET, septiembre 2024",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Guía para ciclistas (CONASET)",
      url: URL_GUIA_CICLISTAS
    }
  },
  {
    id: "CEC-009",
    cat: "emergencias",
    nivel: "basico",
    modo: [
      "urbano",
      "mtb",
      "paseo"
    ],
    icono: "🆘",
    titulo: "SOS y primeros auxilios ciclistas",
    desc: "Qué hacer ante una caída: evaluar, avisar y proteger el lugar.",
    cuerpo: [
      "Evalúa primero tu seguridad y luego la de la persona caída; no muevas a quien no responde salvo peligro inminente.",
      "Números útiles: 131 (SAMU), 132 (bomberos) y 133 (Carabineros).",
      "Protege el lugar de la caída para evitar más incidentes y avisa a los demás ciclistas."
    ],
    recos: [
      "Guarda tus contactos de emergencia en Cumbre30: están accesibles desde el botón SOS.",
      "Lleva un kit mínimo: gasa, vendas, parches y multi herramienta."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito, art. 103 (deber de auxilio tras un accidente)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Guía para ciclistas en Chile",
        f: "CONASET, septiembre 2024",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Guía para ciclistas (CONASET)",
      url: URL_GUIA_CICLISTAS
    }
  },
  {
    id: "CEC-010",
    cat: "montana",
    nivel: "avanzado",
    modo: [
      "mtb"
    ],
    icono: "⛰️",
    titulo: "Frenada y descenso seguro",
    desc: "Técnica de frenado en descensos: dónde, cuánto y con qué dedos.",
    cuerpo: [
      "Frena antes de la curva, no dentro de ella: la bici necesita tracción recta para detenerse.",
      "Un dedo índice en cada palanca es suficiente; la fuerza de la mano se recarga si usas todos los dedos.",
      "Baja el cuerpo hacia atrás en descensos pronunciados para no sobrecargar la rueda delantera."
    ],
    recos: [
      "En descensos compartidos, regula la velocidad y cede ante quien sube.",
      "Revisa pastillas y aros/disyos antes de bajar montaña."
    ],
    refs: [
      {
        t: "Manual Integral de Educación y Seguridad Ciclista Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Manuales de conducción (CONASET)",
      url: URL_MANUALES_CONASET
    }
  },
  {
    id: "CEC-011",
    cat: "montana",
    nivel: "intermedio",
    modo: [
      "mtb"
    ],
    icono: "🌲",
    titulo: "Senderos: dónde sí y dónde no",
    desc: "Senderos habilitados, dirección, y por qué no abrir nuevos trazados.",
    cuerpo: [
      "Circula solo por senderos habilitados y en la dirección señalizada: invertir el sentido genera choques de frente.",
      "No abras atajos nuevos: erosionan el cerro y suelen cruzar zonas de restauración.",
      "Los senderos MTB suelen clasificarse por niveles (verde, azul, negro): elige según tu técnica."
    ],
    recos: [
      "Consulta la capa de senderos de Cumbre30 antes de salir; se actualiza con información oficial.",
      "Ceder: quien baja cede ante quien sube en sendero estrecho."
    ],
    refs: [
      {
        t: "Manual Integral de Educación y Seguridad Ciclista Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Manuales de conducción (CONASET)",
      url: URL_MANUALES_CONASET
    }
  },
  {
    id: "CEC-012",
    cat: "pedalear",
    nivel: "intermedio",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "📦",
    titulo: "Pedalea por la ciudad con carga",
    desc: "Mochilas, parrillas y niños: cómo afecta el equilibrio y la frenada.",
    cuerpo: [
      "La carga baja y centrada altera menos el equilibrio que la carga alta en el manubrio.",
      "Con peso extra, la distancia de frenado aumenta: anticipa el doble.",
      "Los niños van en asillas certificadas traseras o en bici acondicionada, siempre con casco."
    ],
    recos: [
      "Revisa la presión con carga: aumenta un poco la del neumático trasero.",
      "Amarra la carga: nada suelto que pueda caer al rodado."
    ],
    refs: [
      {
        t: "Ley 21.088 - Ley de Convivencia Vial (transporte de menores, art. 223)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver Ley de Convivencia Vial en LeyChile",
      url: URL_LEYCONVIVENCIA
    }
  },
  {
    id: "CEC-013",
    cat: "legal",
    nivel: "intermedio",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "📖",
    titulo: "Marco legal del ciclista: tus reglas, con artículo",
    desc: "Qué ley te aplica al pedalear en Chile: dónde circular, elementos obligatorios y deberes, cada regla con su artículo (texto vigente 2026).",
    cuerpo: [
      "Los ciclos son vehículos no motorizados según la Ley de Tránsito (definición del art. 2, incorporada por la Ley 21.088): te aplican los deberes generales de los conductores y también derechos, como el preferente de paso de los ciclos en ciclovía ante virajes (art. 134) y el adelantamiento seguro de aproximadamente 1,5 metros (art. 120).",
      "Dónde circular en zonas urbanas (art. 222): por la ciclovía y, si no existe, por la pista derecha de la calzada. Excepciones: virar a la izquierda, los casos del art. 116 (adelantar o sortear un obstáculo) y, en vías unidireccionales con pista exclusiva de buses al costado derecho, circular por el costado izquierdo de la pista izquierda.",
      "La acera solo en casos excepcionales (art. 222 b): menores de 14 años, adultos mayores, personas con discapacidad o movilidad reducida, quienes llevan niños menores de 7, o cuando las condiciones hagan peligroso continuar por ciclovía o calzada. En la vereda se avanza a velocidad de peatón y, si el flujo peatonal es muy alto, hay que descender del ciclo.",
      "Equipamiento y atención: casco obligatorio en zonas urbanas (art. 80), freno eficaz (art. 223), reflectantes para la noche (art. 72) y nada de audífonos o elementos que dificulten la visión o la audición (art. 223 a).",
      "Convivencia en la vía: máximo dos en fondo (art. 130), prohibido tomarse de otros vehículos en movimiento (art. 131), virajes cerca del borde o del elemento segregador de la ciclovía (art. 135), señalizando con el brazo o con un señalizador eléctrico adosado al cuerpo (art. 138).",
      "Familia y estacionamiento: transportar menores de 7 años exige conductor mayor de edad (art. 223 c); las bicicletas se estacionan en lugares habilitados y no deben aferrarse a paraderos de transporte público, pasos de peatones ni zonas prohibidas (art. 224)."
    ],
    recos: [
      "Las zonas de tránsito calmado fijan máximos de 40, 30 o 20 km/h (art. 2, Ley 21.088): en ellas el límite es menor que el general de la vía.",
      "Las ciclovías se rigen por el reglamento DS 102/2019 del MTT: diseño, señalización y elementos de seguridad homologados.",
      "Consulta el texto exacto en LeyChile (BCN): cada regla de esta ficha cita su artículo para que puedas verificarlo."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito (texto refundido DFL 1/2007, versión vigente al 22-10-2026)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Ley 21.088 (2018) - Título XX de bicicletas y otros ciclos (arts. 221-224)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "DS 102/2019 MTT - Reglamento de ciclovías",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver el texto vigente en LeyChile",
      url: URL_LEYTRANSITO
    },
    quiz: {
      q: "Sin ciclovía disponible, ¿por dónde deben circular los ciclos en zonas urbanas?",
      alt: [
        "Por la acera, siempre",
        "Por la pista derecha de la calzada",
        "Por donde prefieran",
        "Solo en sentido contrario"
      ],
      ok: 1,
      exp: "Art. 222 de la Ley de Tránsito: los ciclos transitan por las ciclovías y, a falta de ellas, por la pista derecha de la calzada; la acera es solo excepcional."
    }
  },
  {
    id: "CEC-014",
    cat: "legal",
    nivel: "intermedio",
    modo: [
      "urbano",
      "paseo"
    ],
    icono: "🚨",
    titulo: "Infracciones y multas: qué te pueden cursar hoy",
    desc: "Las infracciones de tránsito que se pueden cursar a ciclistas, con categoría y monto según la escala vigente. Información educativa, no asesoría legal.",
    cuerpo: [
      "Cómo funciona: Carabineros o el inspector fiscal cursa la denuncia y el Juzgado de Policía Local aplica la escala del art. 204. Las multas se expresan en UTM y se actualizan cada mes (SII); no llevan recargos legales (art. 205). Referencia noviembre 2026: 1 UTM = $72.440.",
      "Gravísimas, 1,5 a 3 UTM (aprox. $108.660 a $217.320): no detenerse ante la luz roja del semáforo o la señal PARE (art. 199 N°1). Si reincides en gravísimas dentro de 3 años, la multa se duplica; a la tercera vez, se triplica.",
      "Graves, 1 a 1,5 UTM (aprox. $72.440 a $108.660): no respetar señales de tránsito (art. 200 N°7), conducir contra el sentido del tránsito (N°9), no respetar la preferencia de paso de peatones u otros conductores (N°11), infringir las normas de virajes (N°13), circular sin luces cuando la ley las exige (N°15) y no cumplir la prohibición de tomarse de otros vehículos en movimiento (N°8, art. 131).",
      "Menos graves, 0,5 a 1 UTM (aprox. $36.220 a $72.440): conducir una bicicleta contraviniendo el uso obligatorio del casco protector y demás elementos de seguridad (art. 201; así lo publica CONASET) y no hacer las señales debidas antes de virar (art. 201 N°5).",
      "Leves, 0,2 a 0,5 UTM (aprox. $14.488 a $36.220): todas las demás transgresiones (art. 202), por ejemplo infringir los deberes del art. 223 (freno eficaz, atención plena) o las reglas de ciclovías y estacionamiento del Título XX (arts. 221-224).",
      "Lo que no aplica al ciclista: licencia de conductor, permiso de circulación, revisión técnica y patente son exigibles solo a vehículos motorizados. En zonas de tránsito calmado o recintos con normas propias se suman sus máximos específicos, también fiscalizados por Carabineros."
    ],
    recos: [
      "Los montos en pesos son referencia con la UTM de noviembre 2026 ($72.440, SII): se recalculan cada mes.",
      "Si te cursan una denuncia, puedes defenderla ante el Juzgado de Policía Local; este módulo no reemplaza asesoría legal.",
      "Categorías y montos verificados en el texto refundido vigente al 22-10-2026 (BCN): pueden cambiar con nuevas leyes."
    ],
    refs: [
      {
        t: "Ley 18.290 - Ley de Tránsito, arts. 199-205 (texto refundido DFL 1/2007, versión vigente al 22-10-2026)",
        f: "Biblioteca del Congreso Nacional - LeyChile",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Multas asociadas: casco y elementos de seguridad para ciclistas",
        f: "CONASET",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Guía para ciclistas en Chile (tabla de multas por tipo de infracción)",
        f: "CONASET, septiembre 2024",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Valor UTM noviembre 2026: $72.440",
        f: "Servicio de Impuestos Internos (SII)",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Ver arts. 199-205 en LeyChile",
      url: URL_LEYTRANSITO
    },
    quiz: {
      q: "Andar en bicicleta sin casco en zona urbana, ¿qué infracción es?",
      alt: [
        "Gravísima: 1,5 a 3 UTM",
        "Grave: 1 a 1,5 UTM",
        "Menos grave: 0,5 a 1 UTM",
        "No es infracción"
      ],
      ok: 2,
      exp: "El casco es obligatorio en zonas urbanas (art. 80) y su infracción es menos grave, con multa de 0,5 a 1 UTM (art. 201; verificado en CONASET)."
    }
  },
  {
    id: "CEC-015",
    cat: "evaluaciones",
    nivel: "basico",
    modo: [
      "urbano",
      "mtb",
      "paseo"
    ],
    icono: "🎓",
    titulo: "Evaluación: listo para pedalear",
    desc: "Cuestionario de repaso del Centro de Educación: mide tu base antes de pedalear.",
    cuerpo: [
      "Repasa los módulos básicos y responde el cuestionario. Puedes repetirlo las veces que quieras.",
      "Al aprobar desbloqueas la insignia 'Primer módulo' y se suma a tu progreso educativo del perfil ciclista.",
      "Las evaluaciones son educativas: no otorgan certificaciones oficiales."
    ],
    recos: [
      "Vuelve al cuestionario cada temporada: las normas cambian y el repaso mantiene hábitos.",
      "Los resultados viven en tu teléfono y se sincronizan con tu cuenta."
    ],
    refs: [
      {
        t: "Programa educativo Cumbre30",
        f: "Cumbre30",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
    enlace: {
      etiqueta: "Guía para ciclistas (CONASET)",
      url: URL_GUIA_CICLISTAS
    },
    quiz: {
      q: "Al adelantarte, ¿qué distancia aproximada debe mantener un vehículo motorizado durante toda la maniobra?",
      alt: [
        "0,5 metros",
        "1 metro",
        "1,5 metros",
        "3 metros"
      ],
      ok: 2,
      exp: "Art. 120 de la Ley de Tránsito (inciso introducido por la Ley 20.068): al adelantar a bicicletas u otros ciclos, el vehículo motorizado debe mantener una distancia prudente de aproximadamente 1,50 metros durante toda la maniobra."
    }
  }
];
