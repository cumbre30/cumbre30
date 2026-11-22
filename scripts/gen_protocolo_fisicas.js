// ============================================================
// gen_protocolo_fisicas.js — Protocolo de pruebas físicas del
// Motor GPS Cumbre30 (cierre de fase única). Genera DOCX con
// portada R1 + TOC + protocolos A–F con hojas de registro.
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  AlignmentType, NumberFormat, SectionType, TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");
const H = require("./cierre-docx-helpers");

const SALIDA = "/home/z/my-project/download/Protocolo_Pruebas_Fisicas_MotorGPS_Cumbre30.docx";

// ---------- portada ----------
const portada = H.buildCoverR1({
  title: "Protocolo de Pruebas Físicas del Motor GPS",
  subtitle: "Cierre de la fase única · validación en dispositivos Android reales",
  englishLabel: "CUMBRE30 MOTOR GPS",
  metaLines: [
    "Aplicación: Cumbre30 v1.23.0 (versionCode 84)",
    "Ámbito: recuperación, precisión, altitud, pausa, tiempo y batería",
    "Preparado por: Equipo de desarrollo Cumbre30",
    "Fecha de emisión: 22 de noviembre de 2026",
  ],
  footerLeft: "Cumbre30 · Motor GPS",
  footerRight: "Fase única · documento de validación",
  palette: H.P,
});

// ---------- pies de página ----------
function pieNumerado() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: H.FONT })],
    })],
  });
}
function encabezado() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({
        text: "Protocolo de pruebas físicas · Motor GPS Cumbre30 · v1.23.0",
        size: 18, color: "808080", font: H.FONT,
      })],
    })],
  });
}

// ---------- TOC ----------
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
      italics: true, size: 18, color: "888888", font: H.FONT,
    })],
  }),
  // El propio salto de sección NEXT_PAGE separa el TOC del cuerpo:
  // un PageBreak adicional aquí crearía una página en blanco.
];

// ---------- cuerpo ----------
const cuerpo = [];

// 1 objetivo
cuerpo.push(H.h1("1. Objetivo y alcance del protocolo"));
cuerpo.push(H.body("Este documento define los procedimientos de validación en dispositivos Android reales que completan el cierre de la fase única del Motor GPS de Cumbre30. Los criterios de aceptación de las ocho correcciones de la fase única (P0-1, P0-2, P0-3, D4, D5, D6, R1/R2 y R6/R7) ya quedaron verificados en pruebas automatizadas deterministas (suite motor-gps 26/26 y suite de arquitectura motor-cierre 8/8); las pruebas físicas aquí descritas agregan la evidencia de terreno que un sandbox de compilación no puede producir: GNSS real con multipath de árboles y cañones urbanos, gestión agresiva de batería de los fabricantes, consumos eléctricos medidos en horas y la recuperación frente a muertes reales del proceso."));
cuerpo.push(H.body("El alcance cubre los seis protocolos del encargo de cierre (A a F). Cada protocolo indica los pasos numerados, la medición a registrar, la fórmula de cálculo del resultado y el criterio de aceptación inequívoco. Ningún protocolo requiere instrumentos de laboratorio: basta el propio dispositivo, una APK de validación (v1.23.0, versionCode 84), un cronómetro y, para los protocolos C y B, un dispositivo de referencia con altímetro barométrico o un punto geodésico de altitud conocida."));
cuerpo.push(H.body("Quedan fuera del alcance la validación de la interfaz general de Cumbre30 (cubierta por las suites de regresión existentes), el rendimiento del servidor y cualquier prueba de pagos o sincronización en la nube ajena al motor."));

// 2 matriz de dispositivos
cuerpo.push(H.h1("2. Requisitos previos y matriz de dispositivos"));
cuerpo.push(H.body("Antes de comenzar, instale la APK de validación cumbre30-v1.23.0-code84.apk (firma debug) en cada dispositivo, conceda permiso de ubicación «Preciso» (Allow all the time) y desactive la optimización de batería para Cumbre30 en Ajustes → Aplicaciones → Batería → Sin restricciones, salvo en el protocolo F3 donde se configura deliberadamente el modo de ahorro. Registre en cada hoja de resultados el modelo, la versión de Android y la compilación del fabricante, porque el comportamiento del procesamiento en segundo plano varía por OEM y esos datos son parte de la evidencia."));
cuerpo.push(H.tituloTabla("Tabla 1: matriz mínima de dispositivos para la validación"));
cuerpo.push(H.tabla(
  ["Rol", "Requisito", "Ejemplo de clase de equipo", "Protocolos"],
  [
    ["D1 — equipo principal", "Android 12 o superior, GNSS multiconstelación", "Teléfono de uso diario del equipo", "A, B, C, D, E, F"],
    ["D2 — OEM agresivo", "Fabricante con gestión agresiva (Xiaomi/Huawei/Samsung), Android 13+", "MIUI/HyperOS o equivalente", "A, F"],
    ["D3 — equipo de referencia", "Con altímetro barométrico o altitud conocida", "Ciclocomputador GPS o app barométrica calibrada", "C"],
    ["D4 — usuario beta real", "Cualquier Android 10+ disponible", "Segundo teléfono o tablet con SIM", "A, D, F"],
  ],
  [16, 30, 34, 20]
));
cuerpo.push(H.body("Cada protocolo termina con una fila de veredicto (Cumple / No cumple / Parcial) en su hoja de registro. Un solo «No cumple» bloquea el cierre y genera un ticket de corrección contra la suite automatizada correspondiente. La evidencia mínima por protocolo es: capturas de pantalla en los pasos indicados y, en los protocolos A y E, una grabación de pantalla completa de la secuencia; además el archivo GPX del recorrido exportado cuando aplique."));

// 3 Protocolo A
cuerpo.push(H.h1("3. Protocolo A — Recuperación de recorridos"));
cuerpo.push(H.h2("3.1 Procedimiento"));
cuerpo.push(H.body("El protocolo A verifica la corrección P0-1 (checkpoint cada 15 segundos y continuidad de la actividad) frente a los cuatro modos de muerte del proceso que existen en Android. Ejecútelo cuatro veces en D1, una vez por cada modo de interrupción, y repita el modo 3 en D2 con la administración agresiva activa."));
cuerpo.push(H.bullet("Modo 1 — cierre desde la interfaz: inicie un ride con fuente GPS, pedalee o camine al menos 2 minutos registrando distancia y tiempo en pantalla, abra la pantalla de aplicaciones recientes y arrastre Cumbre30 fuera; vuelva a abrir la app y compruebe que aparece la tarjeta «¿Retomar ride?» con fecha, distancia y tiempo."));
cuerpo.push(H.bullet("Modo 2 — muerte del proceso por el sistema: con el ride en curso y la pantalla bloqueada, ejecute desde un computador con depuración USB el comando adb shell am force-stop cl.cumbre30.app; al reabrir, la tarjeta de recuperación debe aparecer con las métricas del último checkpoint."));
cuerpo.push(H.bullet("Modo 3 — pantalla bloqueada y gestión agresiva de batería: en D2 active el modo de ahorro del fabricante, bloquee el teléfono y pedalee 10 minutos; acepte cualquier alerta de «app detenida» del OEM; al reabrir, verifique continuidad de distancia, tiempo, velocidad y estado de actividad (corriendo o auto-pausada)."));
cuerpo.push(H.bullet("Modo 4 — reinicio del dispositivo: con el ride en curso, reinicie el teléfono por completo; al arrancar y abrir Cumbre30, la tarjeta «¿Retomar ride?» debe proponer el ride con las métricas del último checkpoint y el track debe continuar sin duplicar puntos."));
cuerpo.push(H.h2("3.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("Anote en la hoja la distancia y el tiempo mostrados justo antes de la interrupción (D_anterior, T_anterior) y los que muestra la tarjeta de recuperación al reabrir (D_recuperado, T_recuperado). La pérdida permitida corresponde al intervalo de checkpoint: la fórmula de cálculo es pérdida_distancia = D_anterior − D_recuperado y pérdida_tiempo = T_anterior − T_recuperado, ambas en valores absolutos. El criterio de aceptación es pérdida_tiempo ≤ 20 segundos y pérdida_distancia ≤ el producto de la velocidad media del tramo por 20 segundos (por ejemplo, a 20 km/h ≈ 111 m); el track no debe contener puntos duplicados ni un salto posicional mayor a 100 metros entre el punto anterior al cierre y el primero tras retomar. La ausencia total de la tarjeta de recuperación con un ride abierto en curso constituye fallo directo del protocolo."));

// 4 Protocolo B
cuerpo.push(H.h1("4. Protocolo B — Precisión en reposo"));
cuerpo.push(H.h2("4.1 Procedimiento"));
cuerpo.push(H.body("Coloque D1 inmóvil sobre una superficie estable con cielo despejado (una baranda metálica o el suelo de un patio funciona; el interior con ventana es aceptable pero registre la condición). Inicie un ride con GPS y deje el dispositivo sin tocar durante 3 minutos con la pantalla encendida. La deriva del GNSS se registra sola: la app acumula la distancia que el motor acepta. Para capturar la deriva cruda opcionalmente active un ride con la fuente de demostración desactivada y compare contra la posición inicial marcada en el mapa."));
cuerpo.push(H.h2("4.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("Al cierre de los 3 minutos, registre la distancia acumulada del ride (D_reposo) y el tiempo en movimiento (T_mov). La fórmula de tasa de deriva es deriva = D_reposo / 3 minutos, expresada en metros por minuto. El criterio de aceptación, tomado del encargo de cierre, es D_reposo < 10 metros para los 3 minutos completos (deriva < 3,3 m/min) y T_mov = 0 segundos: la velocidad Doppler filtrada bajo el umbral de 2,5 km/h debe mantener el acumulador de distancia en cero aunque la posición derive visualmente unos metros en el mapa. Repita una vez en un estacionamiento techado (GNSS degradado, accuracy reportada 20 a 50 m): el gate de precisión debe rechazar los fixes y la distancia debe seguir en cero."));

// 5 Protocolo C
cuerpo.push(H.h1("5. Protocolo C — Altitud y desnivel"));
cuerpo.push(H.h2("5.1 Procedimiento"));
cuerpo.push(H.body("Elija una subida y bajada conocida con desnivel documentado (en San Cristóbal la referencia local es el tramo Pío Nono a Plaza México, aproximadamente 90 a 120 metros de ascenso según el punto de partida; registre el valor de referencia del equipo D3 o del punto geodésico elegido). Inicie el ride en D1 y en D3 simultáneamente, realice la subida a ritmo constante, descanse 2 minutos en la cima y baje al punto de partida. Repita el recorrido por un sector arbolado (sendero con dosel cerrado) para forzar multipath y sombra de satélites."));
cuerpo.push(H.h2("5.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("Registre gain y loss del ride en D1 (G_app, L_app) y el desnivel de referencia del D3 (G_ref, L_ref). Las fórmulas de error son error_gain = (G_app − G_ref) / G_ref × 100 % y error_loss análogo con L. El criterio de aceptación es error_gain ≤ 15 % y error_loss ≤ 15 % en cielo despejado, y error_gain ≤ 25 % en el sector arbolado, con la condición adicional de que al exportar el GPX ningún punto de la traza tenga altitud 0 en sectores donde la altitud real supera los 300 metros: eso verificaría la corrección P0-3 (los fixes sin altitud válida no alteran la cadena vertical; el motor conserva la última altitud válida y la accuracy vertical valt ≥ 30 m descarta los fixes ruidosos). La histéresis de desnivel D4 se comprueba con la fase plana: durante los 2 minutos en la cima el contador de gain no debe crecer más de 5 metros, porque el ruido vertical típico del GNSS es de 10 a 15 metros y la cadena de histéresis de 4 metros con EMA lenta debe absorberlo."));

// 6 Protocolo D
cuerpo.push(H.h1("6. Protocolo D — Pausa automática"));
cuerpo.push(H.h2("6.1 Procedimiento"));
cuerpo.push(H.body("Ejecute dos ciclos en D1. Ciclo 1 (semáforo largo): pedalee hasta 18 km/h, deténgase por completo 20 segundos y reanude a más de 3 km/h. Ciclo 2 (pausa manual tras auto-pausa): deténgase 20 segundos hasta ver el chip de auto-pausa, presione pausa manual, espere 1 minuto y reanude. Registre el instante aproximado en que aparece el chip «Pausa automática» desde la detención completa."));
cuerpo.push(H.h2("6.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("El criterio temporal: la auto-pausa debe activarse entre 15 y 20 segundos después de la detención (la FSM exige 15 segundos sostenidos bajo 2,0 km/h y el decaimiento del filtro Doppler añade 1 a 3 segundos). Tras reanudar, registre la distancia acumulada durante la detención sumada por el sistema (D_fantasma): el criterio de aceptación es D_fantasma < 5 metros por ciclo y que la fiscalización de 30 km/h no se active durante la detención ni en los 5 segundos posteriores a la reanudación (sin alertas de exceso ni vibración estando de pie). En el ciclo 2, el tiempo total de pausa mostrado al terminar el ride debe incluir ambos períodos (automático y manual) sin duplicar el tramo compartido: verifique en el resumen que elapsed + tiempo pausado ≈ tiempo de pared con tolerancia de ±2 segundos, usando la fórmula identidad = elapsed + secPausa − tiempo_pared."));

// 7 Protocolo E
cuerpo.push(H.h1("7. Protocolo E — Tiempo transcurrido"));
cuerpo.push(H.h2("7.1 Procedimiento"));
cuerpo.push(H.body("Con el ride en curso en D1, entre a un túnel, un estacionamiento subterráneo o simply active el modo avión durante exactamente 5 minutos (cronometre desde la pantalla de reloj). La app debe seguir en primer plano o bloqueada; el reloj de la pantalla de ride debe seguir corriendo. Al recuperar la señal, compruebe el tiempo total, el tiempo en movimiento y el tiempo pausado del resumen."));
cuerpo.push(H.h2("7.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("Registre el tiempo mostrado antes de la interrupción (T_antes), el mostrado al salir (T_después) y el tiempo real medido con cronómetro (T_real). Las fórmulas son: tiempo_elapapsed_durante_interrupción = T_después − T_antes y desviación = tiempo_elapsed_durante_interrupción − T_real. El criterio de aceptación es desviación ≤ 2 segundos: el elapsed corre por reloj de pared y una pérdida de señal no resta tiempo (corrección D5). Adicionalmente, tiempo_en_movimiento debe crecer menos de 10 segundos durante el hueco (no llegaron fixes) y el tiempo pausado no debe variar si nadie pausó. La diferenciación total/movimiento/pausa se verifica con la identidad elapsed + secPausa ≈ tiempo de pared desde el inicio (tolerancia ±2 s)."));

// 8 Protocolo F
cuerpo.push(H.h1("8. Protocolo F — Consumo de batería"));
cuerpo.push(H.h2("8.1 Procedimiento"));
cuerpo.push(H.body("Realice tres pruebas de dos horas en D1 con el mismo perfil de movimiento simulado ( fuente demostración a escala 12 equivale a un ride continuo sin desplazamiento físico, o un circuito urbano repetido con GPS real si prefiere datos de terreno; elija una y repítala idéntica en las tres pruebas). Cargue el teléfono al 100 %, desconecte el cargador y anote el porcentaje de batería al inicio, a la hora y a las dos horas. No use el teléfono para nada ajeno durante la prueba, mantenga la misma luminosidad de pantalla y la misma conexión de red en las tres corridas."));
cuerpo.push(H.bullet("F1 — pantalla encendida: ride activo con la pantalla siempre encendida (wake lock de la app)."));
cuerpo.push(H.bullet("F2 — pantalla bloqueada con servicio de ubicación en primer plano: ride activo con la pantalla bloqueada; el FGS de ubicación debe mantener la notificación persistente."));
cuerpo.push(H.bullet("F3 — modo ahorro: ride activo con pantalla bloqueada y el modo de ahorro de batería del sistema activado, con el modo ahorro de la app (saltar fixes 1 de cada 2) encendido desde Ajustes."));
cuerpo.push(H.h2("8.2 Medición y criterio de aceptación"));
cuerpo.push(H.body("Registre porcentaje inicial (B0), a una hora (B1) y al final (B2). Las fórmulas de consumo por hora son consumo_h1 = B0 − B1 y consumo_h2 = B1 − B2, y el promedio es consumo_h = (B0 − B2) / 2 en puntos porcentuales por hora. El criterio de aceptación orientativo (no bloqueante, es un registro de referencia para la ficha técnica) es consumo_h ≤ 8 en F1, ≤ 5 en F2 y ≤ 4 en F3 sobre un hardware de referencia moderno; un valor de F2 más del doble del de F2 de la versión 1.22.0 indicaría regresión energética y generaría ticket. Registre además la temperatura del chasis al final y cualquier evento de «app congelada» del sistema, que son parte de la evidencia para el informe."));

// 9 evidencia
cuerpo.push(H.h1("9. Registro de evidencia y criterio de cierre"));
cuerpo.push(H.body("Cada hoja de registro debe quedar fechada y con el modelo exacto del dispositivo, la versión de Android (por ejemplo Android 14, build AP2A.240905.003), la APK instalada (v1.23.0, code 84) y el estado de la optimización de batería. La evidencia de cada protocolo se compone de: capturas de los pasos marcados, el archivo GPX exportado cuando el protocolo lo indica, la grabación de pantalla para A y E, y la tabla de mediciones con sus fórmulas aplicadas. Con los seis protocolos en «Cumple» (o en «Parcial» con justificación documentada), el punto 2 del criterio de cierre queda completo y la fase única puede declararse terminada; cualquier «No cumple» devuelve el trabajo a la suite automatizada correspondiente para reproducir el defecto de forma determinista antes de corregir."));
cuerpo.push(H.tituloTabla("Tabla 2: hoja de registro resumida (una fila por protocolo y dispositivo)"));
cuerpo.push(H.tabla(
  ["Protocolo", "Dispositivo", "Medición principal", "Criterio", "Veredicto"],
  [
    ["A. Recuperación", "【D1/D2/D4】", "Pérdida de distancia y tiempo en los 4 modos", "≤ 20 s y ≤ 20 s de tramo", "【 】"],
    ["B. Reposo", "【D1】", "D_reposo en 3 min; deriva m/min", "< 10 m; T_mov = 0", "【 】"],
    ["C. Altitud", "【D1/D3】", "error_gain y error_loss %", "≤ 15 % despejado; ≤ 25 % arbolado", "【 】"],
    ["D. Auto-pausa", "【D1】", "Activación 15-20 s; D_fantasma", "< 5 m; sin fiscalización parado", "【 】"],
    ["E. Tiempo", "【D1】", "Desviación elapsed vs cronómetro", "≤ 2 s en hueco de 5 min", "【 】"],
    ["F. Batería", "【D1】", "Consumo %/hora en F1, F2, F3", "Referencia 8 / 5 / 4 % por hora", "【 】"],
  ],
  [17, 15, 30, 25, 13]
));
cuerpo.push(H.body("Los campos marcados con 【 】 se completan durante la ejecución física. Este protocolo se acompaña del informe de cierre de la fase única, donde se documentan los resultados automatizados ya obtenidos y el estado de cada criterio del encargo."));

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
      headers: { default: encabezado() },
      footers: { default: pieNumerado() },
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
      headers: { default: encabezado() },
      footers: { default: pieNumerado() },
      children: cuerpo,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(SALIDA, buf);
  console.log("ESCRITO:", SALIDA, (buf.length / 1024).toFixed(0) + " KB");
});
