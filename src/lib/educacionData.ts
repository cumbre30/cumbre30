"use client";

// ============================================================
// Centro de Educación Ciclista (CEC) - datos de los módulos.
// Generado desde el mockup aprobado (download/mockup-centro-
// educacion-ciclista.html, v.2026-11-20) por scripts/gen-educacion-data.mjs
// para garantizar fidelidad al contenido revisado por el cliente.
// El contenido de los módulos (reglas, citas legales, fuentes)
// permanece en español: la normativa citada (Ley 18.290, CONASET,
// UTM/SII) es chilena y su texto oficial es en español; traducir
// citas legales implicaría parafrasearlas. Los textos de interfaz
// (chips, búsqueda, quiz, insignias) sí están en i18n (i18n.ts).
// ------------------------------------------------------------
// Tipos: ModuloCEC = ficha completa; quiz en CEC-012/013/014.
// ============================================================

export type QuizCEC = { q: string; alt: string[]; ok: number; exp: string };
export type RefCEC = { t: string; f: string; r: string; v: string };
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
  quiz?: QuizCEC;
};

/** Categorías (clave = cat del módulo; etiquetas vía i18n cat.*). */
export const CEC_CATS: string[] = ["pedalear","senalizacion","seguridad","emergencias","montana","evaluaciones","legal"];

export const CEC_MODULOS: ModuloCEC[] = [
  {
    id: "CEC-001",
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
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-002",
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
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-003",
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
        t: "Ley 18.290, Ley de Tránsito",
        f: "Ministerio de Transportes - Biblioteca del Congreso Nacional",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Manual de Señalización de Tránsito",
        f: "CONASET / Ministerio de Transportes",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-004",
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
    act: "2026-11-20"
  },
  {
    id: "CEC-005",
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
        t: "Ley 18.290, Ley de Tránsito (uso obligatorio)",
        f: "Biblioteca del Congreso Nacional",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-006",
    cat: "seguridad",
    nivel: "intermedio",
    modo: [
      "urbano"
    ],
    icono: "🚶",
    titulo: "Convivencia con peatones",
    desc: "Prioridades, velocidad y comunicación en ciclovías y zonas compartidas del parque.",
    cuerpo: [
      "En zonas compartidas y pasos peatonales, el peatón tiene la prioridad: reduce y pasa a distancia lateral segura.",
      "Anuncia tu presencia con timbre a unos 30 metros; un 'gracias' mantiene la convivencia.",
      "La velocidad de convivencia en tramos compartidos del Parque Metropolitano es la del límite del parque: 30 km/h como máximo y menos en tramos peatonales."
    ],
    recos: [
      "Baja del bici en los pasos peatonales si hay mucha gente.",
      "Evita audífonos con música alta: necesitas escuchar el entorno."
    ],
    refs: [
      {
        t: "Normas de uso del Parque Metropolitano de Santiago",
        f: "Parquemet",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "DS 102/2019 y modificaciones",
        f: "Ministerio de Transportes",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-007",
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
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-008",
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
      "Números útiles: 133 (emergencias), 131 (SAMU), 132 (bomberos) y 1466 (emergencias Parquemet).",
      "Protege el lugar de la caída para evitar más incidentes y avisa a los demás ciclistas."
    ],
    recos: [
      "Guarda tus contactos de emergencia en Cumbre30: están accesibles desde el botón SOS.",
      "Lleva un kit mínimo: gasa, vendas, parches y multi herramienta."
    ],
    refs: [
      {
        t: "Teléfono de emergencias Parquemet 1466",
        f: "Parquemet",
        r: "2026-11-20",
        v: "Vigente"
      },
      {
        t: "Protocolo de emergencias - Plan Pedalea Seguro 2026",
        f: "CONASET",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-009",
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
      "En el parque, los descensos fiscalizados tienen límite de 30 km/h: respétalo, hay fiscalización.",
      "Revisa pastillas y aros/disyos antes de bajar montaña."
    ],
    refs: [
      {
        t: "Normas de ciclismo en el Parque Metropolitano",
        f: "Parquemet",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-010",
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
      "Los senderos MTB del parque tienen niveles (verde, azul, negro): elige según tu técnica."
    ],
    recos: [
      "Consulta la capa de senderos de Cumbre30 antes de salir; se actualiza con información oficial.",
      "Ceder: quien baja cede ante quien sube en sendero estrecho."
    ],
    refs: [
      {
        t: "Reglamento de senderos y MTB del Parque Metropolitano",
        f: "Parquemet",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-011",
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
        t: "Manual Integral de Educación y Seguridad Ciclista Cumbre30",
        f: "Contenido propio",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20"
  },
  {
    id: "CEC-012",
    cat: "evaluaciones",
    nivel: "basico",
    modo: [
      "urbano",
      "mtb",
      "paseo"
    ],
    icono: "🎓",
    titulo: "Evaluación: listo para pedalear",
    desc: "Cuestionario inicial del Centro de Educación: 6 preguntas para medir tu base.",
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
        t: "Programa educativo Cumbre30 - Plan Pedalea Seguro 2026",
        f: "CONASET / Cumbre30",
        r: "2026-11-20",
        v: "Vigente"
      }
    ],
    act: "2026-11-20",
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
      "Las zonas de tránsito calmado fijan máximos de 40, 30 o 20 km/h (art. 2, Ley 21.088): el límite de 30 km/h del Parque Metropolitano nace de esa familia normativa más las normas del parque.",
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
      "Lo que no aplica al ciclista: licencia de conductor, permiso de circulación, revisión técnica y patente son exigibles solo a vehículos motorizados. En el Parque Metropolitano se suman las normas internas del parque, con fiscalización de Carabineros (por ejemplo, el límite de 30 km/h)."
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
        f: "CONASET - conaset.cl/multas-asociadas",
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
  }
];
