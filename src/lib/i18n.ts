"use client";

// ============================================================
// i18n de Cumbre30 - selector de idioma para turistas (2026-11-14).
//   es = español (Chile, idioma original y fallback)
//   en = English · pt = Português
// Cubre la fase 1 orientada al ciclista en movimiento: pantalla
// Ride, banner de avisos, SOS, avisos de voz (TTS), bitácora,
// configuración y los textos nuevos (caída, avisos operativos,
// verificación de constancias, reporte ciudadano).
// Las pantallas de gestión (Historial/Stats/Perfil/Ayuda) siguen
// en español hasta la fase 2, igual que los nombres propios de
// lugares del parque y del PDF formal (documento chileno).
// ------------------------------------------------------------
// Uso:
//   const lang = useLang();          // re-render al cambiar idioma
//   t("ride.iniciar")                // texto del idioma activo
//   t("voz.cierreProximo", hora, min) // {0} {1} interpolados
// ============================================================

import { useSyncExternalStore } from "react";

export type Lang = "es" | "en" | "pt";

const LS_KEY = "cumbre30-lang";
const LANGS: Lang[] = ["es", "en", "pt"];

let current: Lang = "es";
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const v = window.localStorage.getItem(LS_KEY);
    if (v && (LANGS as string[]).includes(v)) current = v as Lang;
  }
} catch {
  // sin localStorage (SSR / privado): español
}

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try {
    window.localStorage.setItem(LS_KEY, l);
  } catch {
    // sin persistencia disponible
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook: re-renderiza el componente cuando cambia el idioma. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "es" as Lang);
}

/** Locale TTS del idioma activo (nativo y speechSynthesis). */
export function ttsLocale(): string {
  if (current === "en") return "en-US";
  if (current === "pt") return "pt-BR";
  return "es-CL";
}

const IDX: Record<Lang, number> = { es: 0, en: 1, pt: 2 };

/** [es, en, pt] - el índice 0 es la fuente de verdad (fallback). */
type E = [string, string, string];

const D: Record<string, E> = {
  // ---------- navegación / header ----------
  "nav.ride": ["Ride", "Ride", "Pedal"],
  "nav.explorar": ["Explorar", "Explore", "Explorar"],
  "nav.credencial": ["Credencial", "Pass", "Credencial"],
  "nav.subtitle": ["Sube tu límite", "Sube tu límite", "Sube tu límite"],
  "nav.abrirMenu": ["Abrir menú", "Open menu", "Abrir menu"],
  "gps.idle": ["GPS en espera", "GPS standby", "GPS em espera"],
  "gps.buscar": ["Buscando GPS…", "Finding GPS…", "Buscando GPS…"],
  "gps.activo": ["GPS activo", "GPS active", "GPS ativo"],
  "gps.denegado": ["GPS denegado", "GPS denied", "GPS negado"],
  "gps.error": ["GPS sin señal", "GPS no signal", "GPS sem sinal"],
  "gps.demo": ["Demo activo", "Demo active", "Demo ativo"],
  "menu.historial": ["Mis viajes", "My rides", "Meus passeios"],
  "menu.stats": ["Estadísticas generales", "Overall statistics", "Estatísticas gerais"],
  "menu.premios": ["Desafíos y recompensas", "Challenges and rewards", "Desafios e recompensas"],
  "menu.amigos": ["Amigos", "Friends", "Amigos"],
  "menu.perfil": ["Perfil", "Profile", "Perfil"],
  "menu.config": ["Configuración", "Settings", "Configurações"],
  "menu.ayuda": ["Ayuda y contacto", "Help and contact", "Ajuda e contato"],
  "menu.planes": ["Planes", "Plans", "Planos"],

  // ---------- pantalla ride ----------
  "ride.iniciar": ["Iniciar ride", "Start ride", "Iniciar pedal"],
  "ride.pausar": ["Pausar", "Pause", "Pausar"],
  "ride.reanudar": ["Reanudar", "Resume", "Retomar"],
  "ride.finalizarAria": ["Finalizar y guardar ride", "Finish and save ride", "Finalizar e salvar pedal"],
  "ride.fuenteLeyenda": ["Fuente: {0} (GPS en la app · demo en la web)", "Source: {0} (GPS in the app · demo on the web)", "Fonte: {0} (GPS no app · demo na web)"],
  "ride.demo": ["Demo", "Demo", "Demo"],
  "ride.gpsReal": ["GPS real", "Real GPS", "GPS real"],
  "ride.distancia": ["Distancia", "Distance", "Distância"],
  "ride.tiempo": ["Tiempo", "Time", "Tempo"],
  "ride.cajaTitulo": ["Estadísticas y bitácora", "Stats and log", "Estatísticas e registro"],
  "ride.tabStats": ["Estadísticas", "Stats", "Estatísticas"],
  "ride.tabBitacora": ["Bitácora", "Log", "Registro"],
  "ride.statMax": ["Máx", "Max", "Máx"],
  "ride.statProm": ["Prom", "Avg", "Méd"],
  "ride.statDesnivel": ["Desnivel", "Elevation", "Desnível"],
  "ride.statPendiente": ["Pendiente", "Slope", "Inclinação"],
  "ride.statPrecision": ["Precisión GPS", "GPS accuracy", "Precisão GPS"],
  "ride.statEnParque": ["En parque", "In park", "No parque"],
  "ride.statSi": ["Sí", "Yes", "Sim"],
  "ride.statNo": ["No", "No", "Não"],
  "ride.sobreLimite": ["Tiempo sobre el límite en el parque", "Time over the limit in the park", "Tempo acima do limite no parque"],
  "ride.descensoLimpio": ["Descenso limpio: respetaste los {0} km/h en el parque", "Clean descent: you kept under {0} km/h in the park", "Descida limpa: você respeitou os {0} km/h no parque"],
  "ride.maxParque": ["Máxima dentro del parque:", "Max inside the park:", "Máxima dentro do parque:"],
  "ride.sinEventos": ["Sin eventos aún - los avisos de zona, geocercas y excesos aparecerán aquí.", "No events yet - zone, geofence and speeding alerts will show up here.", "Sem eventos ainda - os avisos de zona, cerca virtual e excessos aparecerão aqui."],
  "ride.indicaciones": ["Indicaciones de la ruta ({0})", "Route directions ({0})", "Instruções da rota ({0})"],
  "ride.verTodas": ["ver todas", "see all", "ver todas"],
  "ride.ocultar": ["ocultar", "hide", "ocultar"],
  "ride.cargandoMinimapa": ["Cargando minimapa…", "Loading mini-map…", "Carregando minimapa…"],

  // ---------- píldora de estado ----------
  "chip.pausa": ["EN PAUSA", "PAUSED", "EM PAUSA"],
  "chip.exceso": ["EXCESO · límite {0}", "OVER LIMIT · max {0}", "EXCESSO · limite {0}"],
  "chip.precaucion": ["PRECAUCIÓN · cerca del límite", "CAUTION · near the limit", "CUIDADO · perto do limite"],
  "chip.parque": ["MODO PARQUE · {0}", "PARK MODE · {0}", "MODO PARQUE · {0}"],
  "chip.libre": ["MODO LIBRE", "FREE MODE", "MODO LIVRE"],

  // ---------- clima ----------
  "clima.aria": ["Clima en el parque: {0}, {1} grados", "Park weather: {0}, {1} degrees", "Clima no parque: {0}, {1} graus"],
  "clima.actualizado": ["Actualizado a las {0}", "Updated at {0}", "Atualizado às {0}"],
  "clima.despejado": ["Despejado", "Clear sky", "Céu limpo"],
  "clima.parcial": ["Parcialmente nublado", "Partly cloudy", "Parcialmente nublado"],
  "clima.nublado": ["Nublado", "Cloudy", "Nublado"],
  "clima.neblina": ["Neblina", "Fog", "Nevoeiro"],
  "clima.llovizna": ["Llovizna", "Drizzle", "Garoa"],
  "clima.lluvia": ["Lluvia", "Rain", "Chuva"],
  "clima.nieve": ["Nieve", "Snow", "Neve"],
  "clima.chubascos": ["Chubascos", "Rain showers", "Pancadas de chuva"],
  "clima.nieveChubascos": ["Nieve en chubascos", "Snow showers", "Neve em pancadas"],
  "clima.tormenta": ["Tormenta", "Thunderstorm", "Tempestade"],
  "clima.generico": ["Clima", "Weather", "Clima"],
  // Detalle expandible del banner (v1.12.0): viento, calidad del aire y UV
  "clima.detalleAria": ["Ver detalle del clima: viento, calidad del aire y UV", "Weather details: wind, air quality and UV", "Ver detalhes do clima: vento, qualidade do ar e UV"],
  "clima.ver": ["Viento", "Wind", "Vento"],
  "clima.rachas": ["Rachas", "Gusts", "Rajadas"],
  "clima.aire": ["Calidad del aire", "Air quality", "Qualidade do ar"],
  "clima.uv": ["Índice UV", "UV index", "Índice UV"],
  "clima.sinDato": ["Sin dato", "No data", "Sem dado"],
  "clima.uv.bajo": ["Bajo", "Low", "Baixo"],
  "clima.uv.moderado": ["Moderado", "Moderate", "Moderado"],
  "clima.uv.alto": ["Alto", "High", "Alto"],
  "clima.uv.muyAlto": ["Muy alto", "Very high", "Muito alto"],
  "clima.uv.extremo": ["Extremo", "Extreme", "Extremo"],
  "clima.aire.buena": ["Buena", "Good", "Boa"],
  "clima.aire.moderada": ["Moderada", "Moderate", "Moderada"],
  "clima.aire.sensible": ["Dañina p/ sensibles", "Harmful (sensitive)", "Ruim p/ sensíveis"],
  "clima.aire.danina": ["Dañina", "Harmful", "Ruim"],
  "clima.aire.muyDanina": ["Muy dañina", "Very harmful", "Muito ruim"],
  "clima.aire.peligrosa": ["Peligrosa", "Hazardous", "Perigosa"],
  "clima.bloqueador": ["Usa bloqueador solar", "Use sunscreen", "Use protetor solar"],
  "clima.bloqueadorFuerte": ["UV muy alto: bloqueador, gorra y anteojos", "Very high UV: sunscreen, hat and glasses", "UV muito alto: protetor, boné e óculos"],

  // ---------- banner de avisos ----------
  "aviso.titulo": ["Avisos y restricciones", "Notices and restrictions", "Avisos e restrições"],
  "aviso.verAria": ["Ver avisos y restricciones ({0})", "View notices and restrictions ({0})", "Ver avisos e restrições ({0})"],
  "aviso.colapsarAria": ["Colapsar avisos y restricciones ({0})", "Collapse notices and restrictions ({0})", "Recolher avisos e restrições ({0})"],
  "aviso.cerrarAria": ["Colapsar banner de avisos", "Collapse notices banner", "Recolher faixa de avisos"],
  "aviso.panelAria": ["Avisos y restricciones del parque", "Park notices and restrictions", "Avisos e restrições do parque"],
  "aviso.ingresaBici": ["Ingresa en bici solo por:", "Enter by bike only through:", "Entre de bicicleta somente por:"],
  "aviso.noHabilitan": ["Los demás accesos no habilitan ingreso de ciclistas.", "The other gates do not allow bike access.", "Os demais acessos não permitem entrada de ciclistas."],
  "aviso.msgCierre": ["El ingreso de ciclistas al parque es de 06:00 a 20:30, todos los días.", "Cyclists may enter the park from 6:00 am to 8:30 pm, every day.", "A entrada de ciclistas no parque é das 06:00 às 20:30, todos os dias."],
  "aviso.fiscalizacion": ["Las luces y el casco se fiscalizan.", "Lights and helmet are enforced.", "Luzes e capacete são fiscalizados."],
  "aviso.msgTupahue": ["Fines de semana y festivos: el acceso a la cumbre desde el sector Tupahue está restringido a partir de las 13:30.", "Weekends and holidays: summit access from the Tupahue area is restricted from 1:30 pm.", "Fins de semana e feriados: o acesso ao cume pelo setor Tupahue fica restrito a partir das 13:30."],
  "aviso.msgPedalea": ["Pedalea Seguro (desde dic 2026): límite 30 km/h en vías interiores, fiscalizado por Carabineros. Senderos de enduro: QR obligatorio en la bici desde el 15/12 (marcha blanca desde el 01/12). Ruta y recreativo: sin QR, con casco y luces.", "Pedalea Seguro (from Dec 2026): 30 km/h limit on park roads, enforced by police. Enduro trails: mandatory QR code on the bike from Dec 15 (grace period from Dec 1). Route and recreational paths: no QR needed, helmet and lights required.", "Pedalea Seguro (a partir de dez 2026): limite de 30 km/h nas vias internas, fiscalizado pela polícia. Trilhas de enduro: QR obrigatório na bicicleta desde 15/12 (marcha branca desde 01/12). Rota e recreativo: sem QR, com capacete e luzes."],
  "aviso.operativo": ["Operativo", "Operations", "Operacional"],
  "aviso.actualizado": ["Actualizado {0}", "Updated {0}", "Atualizado {0}"],

  // ---------- horario (estadoParque) ----------
  "horario.anochece": ["Ya anochece: luces encendidas, fiscalización activa al caer la tarde.", "It is getting dark: lights on, enforcement active in the evening.", "Já está anoitecendo: luzes acesas, fiscalização ativa ao anoitecer."],
  "horario.llevaLuces": ["Anochece a las {0} · lleva luces", "Sunset at {0} · bring lights", "Anoitece às {0} · leve luzes"],

  // ---------- SOS ----------
  "sos.titulo": ["Emergencia en el cerro", "Emergency on the hill", "Emergência no morro"],
  "sos.cerrarAria": ["Cerrar tarjeta de emergencia", "Close emergency card", "Fechar cartão de emergência"],
  "sos.emergencias": ["Emergencias", "Emergency", "Emergências"],
  "sos.carabineros": ["Carabineros", "Police", "Polícia"],
  "sos.ambulancia": ["Ambulancia", "Ambulance", "Ambulância"],
  "sos.bomberos": ["Bomberos", "Fire brigade", "Bombeiros"],
  "sos.parqueYApoyo": ["Parque y apoyo", "Park and support", "Parque e apoio"],
  "sos.emergParquemet": ["Emergencias Parquemet", "Parquemet emergencies", "Emergências Parquemet"],
  "sos.providencia": ["Mun. Providencia", "Providencia council", "Mun. Providencia"],
  "sos.saludResponde": ["Salud Responde", "Health hotline", "Saúde Responde"],
  "sos.compartir": ["Compartir mi ubicación", "Share my location", "Compartilhar minha localização"],
  "sos.compartirTitulo": ["Mi ubicación - Cumbre30", "My location - Cumbre30", "Minha localização - Cumbre30"],
  "sos.compartirMsg": ["Estoy pedaleando. Mi ubicación: {0}", "I am cycling. My location: {0}", "Estou pedalando. Minha localização: {0}"],
  "sos.okCompartida": ["Ubicación compartida ✓", "Location shared ✓", "Localização compartilhada ✓"],
  "sos.okCopiada": ["Ubicación copiada al portapapeles ✓", "Location copied to clipboard ✓", "Localização copiada ✓"],
  "sos.errorCompartir": ["No se pudo compartir; copia la ubicación de abajo.", "Could not share; copy the location below.", "Não foi possível compartilhar; copie a localização abaixo."],
  "sos.sinGps": ["Sin posición GPS aún: no se puede compartir ubicación. Acércate al acceso o caseta más cercana del parque.", "No GPS position yet: location cannot be shared. Move to the nearest park gate or booth.", "Sem posição GPS ainda: não é possível compartilhar a localização. Vá até o acesso ou caseta mais próxima do parque."],
  "sos.nota": ["Si puedes, avisa también al personal del parque (accesos y casetas). El 1466 es la línea de emergencias oficial de Parquemet; ante una urgencia llama también al 133. Tu QR Pedalea Seguro pegado en la bici ayuda a que te identifiquen rápido.", "If you can, also alert the park staff (gates and booths). 1466 is the official Parquemet emergency line; in an emergency also call 133. The Pedalea Seguro QR sticker on your bike helps them identify you quickly.", "Se puder, avise também a equipe do parque (acessos e cassetes). O 1466 é a linha oficial de emergências do Parquemet; em uma urgência ligue também para o 133. O QR Pedalea Seguro colado na bicicleta ajuda a identificar você rapidamente."],

  // ---------- voz (TTS) ----------
  "voz.ingresandoParque": ["Ingresando al Parque Metropolitano. Límite 30 kilómetros por hora.", "Entering the Metropolitan Park. Speed limit 30 kilometers per hour.", "Entrando no Parque Metropolitano. Limite de 30 quilômetros por hora."],
  "voz.saliendoParque": ["Saliendo del parque. Modo libre.", "Leaving the park. Free mode.", "Saindo do parque. Modo livre."],
  "voz.parqueCerrado": ["El parque está cerrado para ciclistas. El ingreso es de 6 a 20 y 30.", "The park is closed for cyclists. Entry is from 6 am to 8:30 pm.", "O parque está fechado para ciclistas. A entrada é das 6 às 20 horas e 30."],
  "voz.accesoExclusivo": ["Acceso exclusivo de ciclistas. Casco y luces puestos.", "Cyclist-only gate. Helmet and lights on.", "Acesso exclusivo de ciclistas. Capacete e luzes a postos."],
  "voz.accesoNoBici": ["Este acceso no permite el ingreso de bicicletas. Usa Zapadores, Pedro de Valdivia Norte, Pío Nono o La Pirámide.", "This gate does not allow bicycles. Use Zapadores, Pedro de Valdivia Norte, Pío Nono or La Pirámide.", "Este acesso não permite bicicletas. Use Zapadores, Pedro de Valdivia Norte, Pío Nono ou La Pirâmide."],
  "voz.zona100": ["Zona de riesgo a 100 metros: {0}.", "Risk zone 100 meters ahead: {0}.", "Zona de risco a 100 metros: {0}."],
  "voz.pioBajada": ["Atención: por Pío Nono no se puede bajar. La bajada es por el puente de Tupahue hacia Pedro de Valdivia Norte.", "Attention: downhill is not allowed through Pío Nono. Descend via the Tupahue bridge toward Pedro de Valdivia Norte.", "Atenção: não se pode descer por Pío Nono. A descida é pela ponte de Tupahue em direção a Pedro de Valdivia Norte."],
  "voz.corteCumbreAlt": ["Alternativas según tu posición: Av. Gabriela Mistral o Av. Carlos Martner.", "Alternatives depending on your position: Gabriela Mistral Avenue or Carlos Martner Avenue.", "Alternativas conforme sua posição: Avenida Gabriela Mistral ou Avenida Carlos Martner."],
  "voz.bajada30": ["Entrando a la bajada fiscalizada. Control de 30 kilómetros por hora.", "Entering the enforced descent. 30 kilometers per hour speed check.", "Entrando na descida fiscalizada. Controle de 30 quilômetros por hora."],
  "voz.parqueYaCerro": ["El parque ya cerró. El ingreso de ciclistas es hasta las {0}.", "The park is now closed. Cyclist entry ends at {0}.", "O parque já fechou. A entrada de ciclistas vai até as {0}."],
  "voz.cierreProximo": ["Atención: el parque cierra a las {0}. Te quedan {1} minutos.", "Attention: the park closes at {0}. You have {1} minutes left.", "Atenção: o parque fecha às {0}. Você tem {1} minutos restantes."],
  "voz.precaucion": ["Precaución: vas a {0} kilómetros por hora. Límite 30.", "Caution: you are at {0} kilometers per hour. Limit 30.", "Cuidado: você está a {0} quilômetros por hora. Limite 30."],
  "voz.exceso": ["Exceso de velocidad. Reduce a menos de 30 kilómetros por hora.", "Speeding. Slow down to less than 30 kilometers per hour.", "Excesso de velocidade. Reduza para menos de 30 quilômetros por hora."],
  "voz.fueraHorario": ["Estás fuera del horario del parque. El ingreso de ciclistas es de {0} a {1}.", "You are outside park hours. Cyclist entry is from {0} to {1}.", "Você está fora do horário do parque. A entrada de ciclistas é das {0} às {1}."],
  "voz.avisoOp": ["Aviso operativo del parque: {0}", "Park operations notice: {0}", "Aviso operacional do parque: {0}"],
  "voz.posibleCaida": ["Posible caída detectada. ¿Estás bien? Toca Estoy bien en la pantalla.", "Possible fall detected. Are you okay? Tap I'm fine on the screen.", "Possível queda detectada. Você está bem? Toque em Estou bem na tela."],

  // ---------- bitácora (logEvent) ----------
  "log.rideGps": ["Ride iniciado con GPS real", "Ride started with real GPS", "Pedal iniciado com GPS real"],
  "log.rideDemo": ["Ride iniciado en modo demo", "Ride started in demo mode", "Pedal iniciado em modo demo"],
  "log.pausa": ["Ride en pausa - cronómetro detenido", "Ride paused - stopwatch stopped", "Pedal em pausa - cronômetro parado"],
  "log.reanudado": ["Ride reanudado", "Ride resumed", "Pedal retomado"],
  "log.guardado": ["Ride guardado en el historial", "Ride saved to history", "Pedal salvo no histórico"],
  "log.vehiculo": ["Velocidad sostenida típica de vehículo: al guardar te preguntaremos", "Speed typical of a motor vehicle: we will ask when you save", "Velocidade típica de veículo: perguntaremos ao salvar"],
  "log.gpsNativo": ["GPS nativo a 1 Hz: sigue activo con la pantalla bloqueada", "Native 1 Hz GPS: keeps running with the screen locked", "GPS nativo a 1 Hz: continua ativo com a tela bloqueada"],
  "log.gpsNativoFallback": ["GPS nativo no disponible: usando GPS del WebView", "Native GPS unavailable: using WebView GPS", "GPS nativo indisponível: usando GPS do WebView"],
  "log.sinGeoloc": ["Este navegador no soporta geolocalización", "This browser does not support geolocation", "Este navegador não suporta geolocalização"],
  "log.permisoDenegado": ["Permiso de ubicación denegado. Usa el Modo Demo para probar.", "Location permission denied. Use Demo mode to test.", "Permissão de localização negada. Use o modo Demo para testar."],
  "log.gpsError": ["GPS: {0}", "GPS: {0}", "GPS: {0}"],
  "log.demoActivo": ["Modo demo activo: Pío Nono → Plaza México → Pedro de Valdivia (12× tiempo real)", "Demo mode active: Pío Nono → Plaza México → Pedro de Valdivia (12x real time)", "Modo demo ativo: Pío Nono → Plaza México → Pedro de Valdivia (12x tempo real)"],
  "log.ingresoParque": ["Ingresando al Parque Metropolitano · límite 30 km/h", "Entering the Metropolitan Park · 30 km/h limit", "Entrando no Parque Metropolitano · limite 30 km/h"],
  "log.salidaParque": ["Saliendo del parque · modo libre", "Leaving the park · free mode", "Saindo do parque · modo livre"],
  "log.cercaGateCerrado": ["Cerca de {0}: el parque está cerrado para ciclistas (06:00-20:30)", "Near {0}: the park is closed for cyclists (6:00 am-8:30 pm)", "Perto de {0}: o parque está fechado para ciclistas (06:00-20:30)"],
  "log.cercaGateCiclistas": ["Cerca de {0}: acceso exclusivo de ciclistas · casco y luces puestos", "Near {0}: cyclist-only gate · helmet and lights on", "Perto de {0}: acesso exclusivo de ciclistas · capacete e luzes"],
  "log.cercaGateNoBici": ["Cerca de {0}: sin ingreso en bici · entra por Zapadores, PdV Norte, Pío Nono o La Pirámide", "Near {0}: no bike access · enter via Zapadores, PdV Norte, Pío Nono or La Pirámide", "Perto de {0}: sem entrada de bicicleta · entre por Zapadores, PdV Norte, Pío Nono ou La Pirâmide"],
  "log.zona100": ["{0} a ~100 metros", "{0} about 100 meters ahead", "{0} a cerca de 100 metros"],
  "log.zonaRiesgo": ["Zona de riesgo: {0}", "Risk zone: {0}", "Zona de risco: {0}"],
  "log.pioBajada": ["Bajada bloqueada: Pío Nono es sólo de subida", "Downhill blocked: Pío Nono is uphill only", "Descida bloqueada: Pío Nono é só de subida"],
  "log.corteCumbre": ["Corte horario: acceso a la cumbre por Tupahue cerrado desde las 13:30 (fin de semana y festivos)", "Time restriction: summit access via Tupahue closed from 1:30 pm (weekends and holidays)", "Restrição de horário: acesso ao cume por Tupahue fechado a partir das 13:30 (fins de semana e feriados)"],
  "log.bajada30": ["Bajada fiscalizada: {0} · control 30 km/h", "Enforced descent: {0} · 30 km/h check", "Descida fiscalizada: {0} · controle 30 km/h"],
  "log.parqueCerrado": ["Parque cerrado ({0}): el horario de ciclistas terminó", "Park closed ({0}): cyclist hours are over", "Parque fechado ({0}): o horário de ciclistas terminou"],
  "log.horarioLimite": ["Al límite del horario: el parque cierra a las {0} ({1} min)", "Closing time near: the park closes at {0} ({1} min)", "Perto do horário: o parque fecha às {0} ({1} min)"],
  "log.fueraHorario": ["Ride fuera de horario: {0}", "Ride outside park hours: {0}", "Pedal fora do horário: {0}"],
  "log.horarioInicio": ["Ride al límite del horario: cierre a las {0} ({1} min)", "Ride near closing time: park closes at {0} ({1} min)", "Pedal perto do horário: fecha às {0} ({1} min)"],
  "log.precaucion": ["Te acercas al límite: {0} km/h", "Approaching the limit: {0} km/h", "Você se aproxima do limite: {0} km/h"],
  "log.exceso": ["¡Exceso! {0} km/h dentro del parque", "Speeding! {0} km/h inside the park", "Excesso! {0} km/h dentro do parque"],
  "log.velocidadOk": ["Velocidad normalizada", "Speed back to normal", "Velocidade normalizada"],
  "log.caidaDetectada": ["Posible caída detectada - revisa cómo estás", "Possible fall detected - check how you are", "Possível queda detectada - verifique como você está"],
  "log.caidaBien": ["Marcaste: estoy bien", "You marked: I'm fine", "Você marcou: estou bem"],
  "log.caidaAyuda": ["Alerta de caída: pediste ayuda", "Fall alert: you requested help", "Alerta de queda: você pediu ajuda"],

  // ---------- zonas de riesgo (voz) ----------
  "zona.anahuac": ["Atención, curva cerrada de la Casa Anáhuac. Reduce velocidad.", "Attention, sharp curve at Casa Anáhuac. Slow down.", "Atenção, curva fechada da Casa Anáhuac. Reduza a velocidade."],
  "zona.antiluen": ["Proximidad a la piscina Antilén. Cruza con precaución, área peatonal.", "Approaching the Antilén pool. Cross with care, pedestrian area.", "Proximidade da piscina Antilén. Atravesse com cuidado, área de pedestres."],
  "zona.jardinJapones": ["Jardín Japonés a la vista. Peatones cruzando.", "Japanese Garden in sight. Pedestrians crossing.", "Jardim Japonês à vista. Pedestres atravessando."],
  "zona.salidaPv": ["Tramo previo a la salida Pedro de Valdivia. Confluencia de ciclistas y vehículos.", "Approaching the Pedro de Valdivia exit. Cyclists and vehicles merging.", "Trecho antes da saída Pedro de Valdivia. Confluência de ciclistas e veículos."],
  "zona.zoologico": ["Zona de Zoológico. Niños y peatones en el camino.", "Zoo area. Children and pedestrians on the path.", "Área do Zoológico. Crianças e pedestres no caminho."],

  // ---------- configuración ----------
  "cfg.fuenteDatos": ["Fuente de datos", "Data source", "Fonte de dados"],
  "cfg.fuenteDatosSub": ["Demo simula la subida Pío Nono → Plaza México. GPS real usa tu ubicación. Herramienta de prueba: ya no compite con el botón Iniciar.", "Demo simulates the Pío Nono → Plaza México climb. Real GPS uses your location. Test tool: it no longer competes with the Start button.", "O Demo simula a subida Pío Nono → Plaza México. O GPS real usa sua localização. Ferramenta de teste: não compete mais com o botão Iniciar."],
  "cfg.pitidos": ["Pitidos de velocidad", "Speed beeps", "Bipes de velocidade"],
  "cfg.pitidosSub": ["Suena al acercarte al límite de 30 km/h", "Sounds as you approach the 30 km/h limit", "Soa quando você se aproxima do limite de 30 km/h"],
  "cfg.avisosVoz": ["Avisos de voz", "Voice alerts", "Avisos de voz"],
  "cfg.avisosVozSub": ["Zonas de riesgo, geocercas, bajadas 30, horario y excesos", "Risk zones, geofences, 30 descents, schedule and speeding", "Zonas de risco, cercas virtuais, descidas 30, horário e excessos"],
  "cfg.tema": ["Tema", "Theme", "Tema"],
  "cfg.temaSub": ["Recomendado: oscuro, legible bajo el sol del cerro", "Recommended: dark, readable under the hill sun", "Recomendado: escuro, legível sob o sol do morro"],
  "cfg.idioma": ["Idioma / Language", "Language / Idioma", "Idioma / Língua"],
  "cfg.idiomaSub": ["Textos y avisos de voz de la app. Los nombres de lugares del parque se mantienen en español.", "App texts and voice alerts. Park place names stay in Spanish.", "Textos e avisos de voz do app. Nomes de lugares do parque permanecem em espanhol."],
  "cfg.caida": ["Detección de caída", "Fall detection", "Detecção de queda"],
  "cfg.caidaSub": ["Si tu velocidad cae a cero de golpe y quedas inmóvil, la app pregunta si estás bien y puede abrir la ayuda de emergencia.", "If your speed suddenly drops to zero and you stay still, the app asks if you are okay and can open emergency help.", "Se sua velocidade cai a zero de repente e você fica imóvel, o app pergunta se você está bem e pode abrir a ajuda de emergência."],
  "cfg.temas": ["Temas y pantalla ride", "Themes and ride screen", "Temas e tela de pedal"],
  "cfg.temasSub": ["Color de la app, velocímetro y minimapa. La personalización es de Cumbre30 Pro.", "App color, speedometer and mini-map. Customization is part of Cumbre30 Pro.", "Cor do app, velocímetro e minimapa. A personalização é do Cumbre30 Pro."],
  "cfg.colorApp": ["Color de la app", "App color", "Cor do app"],
  "cfg.velocimetro": ["Velocímetro", "Speedometer", "Velocímetro"],
  "cfg.minimapa": ["Minimapa", "Mini-map", "Minimapa"],
  "cfg.vistaPrevia": ["Vista previa · 27 km/h en el parque", "Preview · 27 km/h in the park", "Prévia · 27 km/h no parque"],
  "cfg.proNota": ["{0} es parte de Cumbre30 Pro.", "{0} is part of Cumbre30 Pro.", "{0} faz parte do Cumbre30 Pro."],
  "cfg.verPlanes": ["Ver planes", "See plans", "Ver planos"],
  "cfg.proFoot": ["Con Pro eliges el color de la app, el estilo (arco, dial o aguja) y el tamaño del velocímetro, y el minimapa grande.", "With Pro you choose the app color, the style (arc, dial or needle) and speedometer size, plus the large mini-map.", "Com o Pro você escolhe a cor do app, o estilo (arco, mostrador ou agulha) e o tamanho do velocímetro, além do minimapa grande."],
  "cfg.acercaSub": ["Versión {0} · build {1}", "Version {0} · build {1}", "Versão {0} · build {1}"],
  "cfg.contacto": ["Contacto", "Contact", "Contato"],
  "cfg.contactoSub": ["contacto.cumbre30@gmail.com · WhatsApp +56 9 4296 1619", "contacto.cumbre30@gmail.com · WhatsApp +56 9 4296 1619", "contacto.cumbre30@gmail.com · WhatsApp +56 9 4296 1619"],
  "cfg.cgeo": ["Cumbre GEO", "Cumbre GEO", "Cumbre GEO"],
  "cfg.cgeoSub": ["Tecnología para descubrir. App independiente de apoyo al ciclista; no es oficial del Parque Metropolitano de Santiago.", "Technology to discover. Independent cyclist support app; not official from Santiago Metropolitan Park.", "Tecnologia para descobrir. App independente de apoio ao ciclista; não é oficial do Parque Metropolitano de Santiago."],
  "cfg.demoNota": ["La fuente Demo existe para probar la app sin salir de casa. Los viajes demo se marcan como simulación en tu historial y no emiten constancia PDF.", "The Demo source exists to test the app without leaving home. Demo rides are marked as simulation in your history and do not issue PDF certificates.", "A fonte Demo existe para testar o app sem sair de casa. Os passeios demo são marcados como simulação no histórico e não emitem constância PDF."],
  "cfg.esp": ["Español", "Español", "Espanhol"],
  "cfg.eng": ["English", "English", "Inglês"],
  "cfg.port": ["Português", "Português", "Português"],

  // ---------- detección de caída ----------
  "caida.titulo": ["¿Estás bien?", "Are you okay?", "Você está bem?"],
  "caida.sub": ["Detectamos una posible caída durante tu ride.", "We detected a possible fall during your ride.", "Detectamos uma possível queda durante seu pedal."],
  "caida.detalle": ["Frenada brusca seguida de inmovilidad. Si estás bien, toca Estoy bien; si no, pide ayuda.", "A hard stop followed by no movement. If you are fine, tap I'm fine; otherwise ask for help.", "Frenagem brusca seguida de imobilidade. Se você está bem, toque em Estou bem; caso contrário, peça ajuda."],
  "caida.bien": ["Estoy bien", "I'm fine", "Estou bem"],
  "caida.ayuda": ["Necesito ayuda", "I need help", "Preciso de ajuda"],
  "caida.contando": ["Buscando respuesta en {0} s", "Waiting for an answer: {0} s", "Aguardando resposta em {0} s"],
  "caida.ayudaModo": ["Modo de ayuda activado", "Help mode activated", "Modo de ajuda ativado"],
  "caida.ayudaSub": ["Comparte tu ubicación o llama a emergencias.", "Share your location or call emergency services.", "Compartilhe sua localização ou ligue para as emergências."],
  "caida.cerrar": ["Cerrar", "Close", "Fechar"],
  // ---------- contactos ICE (Ola 1: aviso a la gente de confianza) ----------
  "cfg.ice": ["Contactos de emergencia", "Emergency contacts", "Contatos de emergência"],
  "cfg.iceSub": ["Avisan a tu gente si una caída deja la alerta sin respuesta.", "They alert your people if a fall leaves the alert unanswered.", "Avisam suas pessoas se uma queda deixar o alerta sem resposta."],
  "cfg.iceAuto": ["Aviso automático al expirar", "Automatic alert on expiry", "Aviso automático ao expirar"],
  "cfg.iceAutoSub": ["Al terminar la cuenta regresiva abre el mensaje al primer contacto.", "When the countdown ends it opens the message to the first contact.", "Ao fim da contagem abre a mensagem para o primeiro contato."],
  "cfg.iceNombre": ["Nombre", "Name", "Nome"],
  "cfg.iceTelefono": ["Teléfono (9 a 15 dígitos)", "Phone (9 to 15 digits)", "Telefone (9 a 15 dígitos)"],
  "cfg.iceAgregar": ["Agregar contacto", "Add contact", "Adicionar contato"],
  "cfg.iceQuitar": ["Quitar", "Remove", "Remover"],
  "cfg.iceEmpty": ["Sin contactos todavía: agrega hasta {0}.", "No contacts yet: add up to {0}.", "Sem contatos ainda: adicione até {0}."],
  "cfg.iceErrNombre": ["Escribe un nombre (1 a 40 letras).", "Enter a name (1 to 40 characters).", "Escreva um nome (1 a 40 letras)."],
  "cfg.iceErrTelefono": ["Teléfono inválido: usa 9 a 15 dígitos.", "Invalid phone: use 9 to 15 digits.", "Telefone inválido: use 9 a 15 dígitos."],
  "cfg.iceNota": ["Los contactos quedan solo en tu teléfono; el aviso abre tu app de mensajes con el texto listo y tu ubicación.", "Contacts stay on your phone only; the alert opens your messages app with the text and your location ready.", "Os contatos ficam só no seu telefone; o aviso abre seu app de mensagens com o texto e sua localização prontos."],
  "ice.titulo": ["Avisar a mis contactos", "Alert my contacts", "Avisar meus contatos"],
  "ice.abriendo": ["Abriendo mensajes a {0}…", "Opening messages to {0}…", "Abrindo mensagens para {0}…"],
  "ice.sms": ["SMS", "SMS", "SMS"],
  "ice.wa": ["WhatsApp", "WhatsApp", "WhatsApp"],
  "ice.sinContactos": ["Sin contactos ICE: agrégalo en Configuración.", "No ICE contacts: add one in Settings.", "Sem contatos ICE: adicione um nas Configurações."],
  "ice.mensajeConPos": ["ALERTA de Cumbre30: posible caída durante un ride. El ciclista no respondió a la alerta de la app. Ubicación: {0} (hora del aviso {1})", "Cumbre30 ALERT: possible fall during a ride. The cyclist did not respond to the app alert. Location: {0} (alert time {1})", "ALERTA do Cumbre30: possível queda durante um pedal. O ciclista não respondeu ao alerta do app. Localização: {0} (hora do aviso {1})"],
  "ice.mensajeSinPos": ["ALERTA de Cumbre30: posible caída durante un ride. El ciclista no respondió a la alerta de la app. Sin ubicación GPS disponible (hora del aviso {0}).", "Cumbre30 ALERT: possible fall during a ride. The cyclist did not respond to the app alert. No GPS location available (alert time {0}).", "ALERTA do Cumbre30: possível queda durante um pedal. O ciclista não respondeu ao alerta do app. Sem localização GPS disponível (hora do aviso {0})."],
  "ice.mensajeAyuda": ["El ciclista pidió ayuda desde la app.", "The cyclist asked for help from the app.", "O ciclista pediu ajuda pelo app."],
  // ---------- zonas de esfuerzo (Ola 1: pulso Bluetooth) ----------
  "zonaFc.z1": ["Z1 Recup.", "Z1 Recovery", "Z1 Recup."],
  "zonaFc.z2": ["Z2 Base", "Z2 Base", "Z2 Base"],
  "zonaFc.z3": ["Z3 Tempo", "Z3 Tempo", "Z3 Tempo"],
  "zonaFc.z4": ["Z4 Umbral", "Z4 Threshold", "Z4 Limiar"],
  "zonaFc.z5": ["Z5 Máx.", "Z5 Max", "Z5 Máx."],
  "voz.zonaFc": ["Zona {0}. Si te exige demasiado, modera.", "Zone {0}. If it's too hard, ease off.", "Zona {0}. Se estiver exigindo demais, modere."],
  "ride.fcAria": ["Pulso actual {0} pulsaciones por minuto, zona {1}", "Current heart rate {0} beats per minute, zone {1}", "Pulso atual {0} batimentos por minuto, zona {1}"],
  "cfg.fc": ["Zonas de esfuerzo", "Training zones", "Zonas de esforço"],
  "cfg.fcSub": ["Para el sensor de pulso Bluetooth: zonas por Karvonen con tu FC máxima y de reposo.", "For the Bluetooth heart-rate sensor: Karvonen zones from your max and resting heart rate.", "Para o sensor de pulso Bluetooth: zonas por Karvonen com sua FC máxima e de repouso."],
  "cfg.fcMax": ["FC máxima (bpm)", "Max heart rate (bpm)", "FC máxima (bpm)"],
  "cfg.fcReposo": ["FC reposo (bpm)", "Resting heart rate (bpm)", "FC reposo (bpm)"],
  "cfg.fcGuardar": ["Guardar", "Save", "Salvar"],
  "cfg.fcOk": ["Guardado ✓", "Saved ✓", "Salvo ✓"],
  "cfg.fcErr": ["FC máxima 120-230 y reposo 30-120, con el reposo al menos 20 bpm bajo la máxima.", "Max heart rate 120-230 and resting 30-120, with resting at least 20 bpm below max.", "FC máxima 120-230 e repouso 30-120, com o repouso pelo menos 20 bpm abaixo da máxima."],
  // ---------- avisos push del parque en la web (Ola 2) ----------
  "cfg.push": ["Avisos del parque (web)", "Park alerts (web)", "Avisos do parque (web)"],
  "cfg.pushSub": ["Notificaciones del navegador sin instalar nada: luces al anochecer, cierres y avisos operativos. Solo en la web; el APK ya las tiene locales.", "Browser notifications without installing anything: lights at dusk, closures and operational notices. Web only; the APK already has local ones.", "Notificações do navegador sem instalar nada: luz ao anoitecer, fechamentos e avisos operacionais. Só na web; o APK já tem locais."],
  "cfg.pushActivar": ["Activar avisos", "Enable alerts", "Ativar avisos"],
  "cfg.pushDesactivar": ["Desactivar", "Disable", "Desativar"],
  "cfg.pushProbar": ["Enviar aviso de prueba", "Send test alert", "Enviar aviso de teste"],
  "cfg.pushActivado": ["Activados ✓ recibirás luces, cierres y avisos del parque.", "Enabled ✓ you'll get lights, closures and park alerts.", "Ativados ✓ você receberá luz, fechamentos e avisos do parque."],
  "cfg.pushDenegado": ["Permiso denegado: actívalo en la configuración del navegador para este sitio.", "Permission denied: enable it in the browser site settings.", "Permissão negada: ative nas configurações do navegador para este site."],
  "cfg.pushErr": ["No pudimos activar los avisos. Intenta de nuevo.", "We couldn't enable alerts. Try again.", "Não conseguimos ativar os avisos. Tente de novo."],
  "cfg.pushNoCfg": ["El servidor todavía no tiene avisos push configurados.", "The server doesn't have push alerts configured yet.", "O servidor ainda não tem avisos push configurados."],
  "cfg.pushSesion": ["Inicia sesión en Perfil para recibir la prueba.", "Sign in under Profile to receive the test.", "Entre no Perfil para receber o teste."],
  "cfg.pushEnviada": ["Aviso enviado ✓ revisa tus notificaciones.", "Alert sent ✓ check your notifications.", "Aviso enviado ✓ veja suas notificações."],
  // ---------- modo ahorro de batería (Ola 1) ----------
  "bat.aria": ["Modo ahorro de batería: procesa menos GPS y deja apagable la pantalla", "Battery saver: processes GPS less often and lets the screen sleep", "Modo economia de bateria: processa menos GPS e deixa a tela apagar"],
  "voz.ahorroOn": ["Modo ahorro activado. La pantalla puede apagarse; sigo guiándote por voz.", "Battery saver on. The screen may sleep; I keep guiding you by voice.", "Modo economia ativado. A tela pode apagar; continuo guiando por voz."],
  "voz.ahorroOff": ["Modo ahorro desactivado.", "Battery saver off.", "Modo economia desativado."],
  // ---------- notificaciones locales (Ola 1: APK, sin conexión) ----------
  "notif.luces": ["Anochece a las {0}: lleva luces y casco, se fiscaliza.", "Sunset at {0}: carry lights and a helmet, they are enforced.", "Anoitece às {0}: leve luzes e capacete, há fiscalização."],
  "notif.cierre": ["El ingreso de ciclistas cierra a las {0}: planifica tu retorno.", "Cyclist entry closes at {0}: plan your way back.", "A entrada de ciclistas fecha às {0}: planeie seu retorno."],
  // ---------- rachas de actividad (Ola 1) ----------
  "racha.dias": ["{0} día(s) seguidos", "{0} day(s) in a row", "{0} dia(s) seguidos"],

  // ---------- reporte ciudadano ----------
  "rep.enPosicion": ["en tu posición", "at your position", "na sua posição"],
  "rep.sinGps": ["(sin GPS aún)", "(no GPS yet)", "(sem GPS ainda)"],
  "rep.titulo": ["Reportar incidencia", "Report an incident", "Reportar incidente"],
  "rep.cerrar": ["Cerrar reporte", "Close report", "Fechar relatório"],
  "rep.nota": ["Se registra con fecha y hora, y aparece en el mapa compartido.", "It is saved with date and time, and appears on the shared map.", "É registrado com data e hora e aparece no mapa compartilhado."],
  "rep.enviarParquemet": ["Enviar a Parquemet", "Send to Parquemet", "Enviar ao Parquemet"],
  "rep.sinGpsStatus": ["Aún sin GPS: no podemos fijar la ubicación del reporte.", "No GPS yet: we cannot set the report location.", "Ainda sem GPS: não podemos fixar a localização do relatório."],
  "rep.okServer": ["Incidencia reportada ✓ visible para toda la comunidad", "Incident reported ✓ visible to the whole community", "Incidente reportado ✓ visível para toda a comunidade"],
  "rep.okLocal": ["Sin conexión: reporte guardado en este dispositivo.", "Offline: report saved on this device.", "Sem conexão: relatório salvo neste dispositivo."],
  "rep.compartirMsg": ["Reporte de la comunidad ciclista (app Cumbre30): {0} en el Parque Metropolitano de Santiago, cerca de {1}. Registrado el {2}.", "Cycling community report (Cumbre30 app): {0} in Santiago Metropolitan Park, near {1}. Logged on {2}.", "Relatório da comunidade ciclista (app Cumbre30): {0} no Parque Metropolitano de Santiago, perto de {1}. Registrado em {2}."],
  "rep.compartirHint": ["Elige el canal oficial del parque para enviarlo: línea 1466, web o redes de Parquemet.", "Choose the park's official channel to send it: 1466 line, website or Parquemet social media.", "Escolha o canal oficial do parque para enviá-lo: linha 1466, site ou redes do Parquemet."],
  "rep.compartido": ["Reporte listo para enviar ✓", "Report ready to send ✓", "Relatório pronto para enviar ✓"],

  // ---------- verificación de constancias ----------
  "ver.titulo": ["Verificación de constancias", "Certificate verification", "Verificação de constâncias"],
  "ver.sub": ["Pega el enlace o el código que aparece en el QR de una constancia de trayecto de Cumbre30.", "Paste the link or code from the QR of a Cumbre30 ride certificate.", "Cole o link ou o código do QR de uma constância de trajeto do Cumbre30."],
  "ver.inputLabel": ["Enlace o código de verificación", "Verification link or code", "Link ou código de verificação"],
  "ver.verificar": ["Verificar", "Verify", "Verificar"],
  "ver.checking": ["Verificando…", "Verifying…", "Verificando…"],
  "ver.valida": ["Constancia válida", "Certificate valid", "Constância válida"],
  "ver.integridadOk": ["Integridad confirmada: los datos coinciden con el código de integridad emitido por la app.", "Integrity confirmed: the data matches the integrity code issued by the app.", "Integridade confirmada: os dados correspondem ao código de integridade emitido pelo app."],
  "ver.onlineOk": ["Verificada en línea: esta constancia fue registrada por la app del ciclista al momento de la emisión.", "Verified online: this certificate was registered by the cyclist's app when it was issued.", "Verificada on-line: esta constância foi registrada pelo app do ciclista no momento da emissão."],
  "ver.onlineNo": ["Sin registro en línea: el código es íntegro, pero este documento no fue registrado en el servidor (constancia emitida sin conexión o con una versión anterior de la app).", "No online record: the code is intact, but this document was not registered on the server (certificate issued offline or by an older app version).", "Sem registro on-line: o código está íntegro, mas este documento não foi registrado no servidor (constância emitida off-line ou por versão anterior do app)."],
  "ver.invalida": ["Código no válido", "Invalid code", "Código inválido"],
  "ver.invalidaSub": ["No pudimos leer el código. Pega el enlace completo del QR o el código C30 completo.", "We could not read the code. Paste the full QR link or the full C30 code.", "Não pudemos ler o código. Cole o link completo do QR ou o código C30 completo."],
  "ver.tampered": ["Constancia alterada", "Certificate altered", "Constância alterada"],
  "ver.tamperedSub": ["Los datos no coinciden con el código de integridad: el documento fue modificado después de su emisión.", "The data does not match the integrity code: the document was modified after it was issued.", "Os dados não correspondem ao código de integridade: o documento foi modificado após a emissão."],
  "ver.datos": ["Datos del trayecto", "Ride data", "Dados do trajeto"],
  "ver.fecha": ["Fecha del trayecto", "Ride date", "Data do trajeto"],
  "ver.distancia": ["Distancia", "Distance", "Distância"],
  "ver.duracion": ["Duración", "Duration", "Duração"],
  "ver.velMax": ["Velocidad máxima", "Max speed", "Velocidade máxima"],
  "ver.velMaxParque": ["Vel. máxima en el Parque", "Max speed in the park", "Vel. máxima no parque"],
  "ver.sobreLimite": ["Tiempo sobre 30 km/h", "Time over 30 km/h", "Tempo acima de 30 km/h"],
  "ver.ciclista": ["Ciclista", "Cyclist", "Ciclista"],
  "ver.version": ["Versión de la app", "App version", "Versão do app"],
  "ver.registroId": ["ID del registro", "Record ID", "ID do registro"],
  "ver.registradoEl": ["Registrado en línea el {0}", "Registered online on {0}", "Registrado on-line em {0}"],
  "ver.sinRegistroTs": ["Sin registro en línea", "No online record", "Sem registro on-line"],
  "ver.comoFunciona": ["Cómo funciona", "How it works", "Como funciona"],
  "ver.explicacion": ["Cada constancia PDF lleva un QR con los datos del trayecto y un código de integridad SHA-256. Esta página recompone el código en tu dispositivo y, además, consulta el registro en línea de Cumbre30 para confirmar que la constancia fue emitida por la app. El documento es una bitácora personal autogenerada: no reemplaza registros oficiales.", "Each PDF certificate carries a QR with the ride data and a SHA-256 integrity code. This page rebuilds the code on your device and also checks the Cumbre30 online registry to confirm the certificate was issued by the app. The document is a self-generated personal logbook: it does not replace official records.", "Cada constância PDF traz um QR com os dados do trajeto e um código de integridade SHA-256. Esta página recompõe o código no seu dispositivo e também consulta o registro on-line do Cumbre30 para confirmar que a constância foi emitida pelo app. O documento é um diário pessoal autogerado: não substitui registros oficiais."],
  "ver.codigoCorto": ["Código corto", "Short code", "Código curto"],
};

/** Texto para el índice activo con fallback al español y a la clave. */
export function t(key: string, ...args: (string | number)[]): string {
  const e = D[key];
  let s = e ? e[IDX[current]] ?? e[0] : key;
  if (args.length) {
    s = s.replace(/\{(\d+)\}/g, (_, i: string) => {
      const v = args[Number(i)];
      return v === undefined ? "" : String(v);
    });
  }
  return s;
}

/** "6" y "20 y 30" (es) · "6 am" y "8:30 pm" (en) · "6" y "20h30" (pt). */
export function vozHoras(): { abre: string; cierra: string } {
  if (current === "en") return { abre: "6 am", cierra: "8:30 pm" };
  if (current === "pt") return { abre: "6 horas", cierra: "20 horas e 30" };
  return { abre: "6", cierra: "20 y 30" };
}

/** Lectura de voz de la hora de cierre según idioma: es "20 y 30". */
export function vozHoraCierre(): string {
  return vozHoras().cierra;
}
