# -*- coding: utf-8 -*-
"""Fragmentos VERBATIM del repositorio Cumbre30 para el PDF técnico.
Cada entrada: (titulo_fuente, codigo). Se insertan escapados en XPreformatted."""

FRAGS = {

"kalman_dist": ("src/hooks/useRideEngine.ts · Kalman + micro-predicción + distancia (líneas 128-146)", """      const measuredKmh = fix.speedKmh;
      const vMeasured = measuredKmh / 3.6; // m/s
      const vKf = e.kalman.update(vMeasured, dt);
      let accel = 0;
      if (e.prevSpeed !== null && dt > 0) accel = (vKf - e.prevSpeed) / dt;
      accel = Math.max(-3, Math.min(3, accel));
      e.prevSpeed = vKf;
      const vPred = Math.max(0, vKf + accel * 0.4); // extrapola 400 ms
      const vKmh = vPred * 3.6;

      // 2) Distancia (rechaza teleportes > 100 m o baja precisión)
      let dValid = 0; // metros válidos de este paso (se reutilizan para el parque)
      if (e.lastFix) {
        const d = haversineM(e.lastFix, fix);
        if (d < 100 && fix.accuracyM < 60) {
          e.distanceM += d;
          dValid = d;
        }
      }"""),

"speedkalman": ("src/lib/geo.ts · SpeedKalman.update con compuerta de outliers (líneas 52-70)", """  update(measured: number, dt: number, hardConfirm = false): number {
    if (!isFinite(measured) || measured < 0) return this.x ?? 0;
    if (this.x === null) {
      this.x = measured;
      return this.x;
    }
    // predicción
    this.p += this.q * dt;
    // compuerta de outliers: aceleración imposible
    const impliedA = Math.abs(measured - this.x) / Math.max(dt, 0.1);
    let r = this.r;
    if (impliedA > 25) r = this.r * 60;
    else if (impliedA > 8 && !hardConfirm) r = this.r * 25;
    // corrección
    const k = this.p / (this.p + r);
    this.x += k * (measured - this.x);
    this.p *= 1 - k;
    return this.x;
  }"""),

"estados30": ("src/hooks/useRideEngine.ts · Máquina de estados del límite 30 km/h (líneas 226-245)", """      let nextState: SpeedState = "ok";
      if (e.inside) {
        switch (e.state) {
          case "ok":
            nextState = vKmh >= LIMIT_KMH ? "over" : vKmh >= CAUTION_KMH ? "caution" : "ok";
            break;
          case "caution":
            if (vKmh >= LIMIT_KMH) nextState = "over";
            else if (vKmh < CAUTION_KMH - 0.6) nextState = "ok";
            else nextState = "caution";
            break;
          case "over":
            if (vKmh < LIMIT_KMH - 0.6) nextState = vKmh >= CAUTION_KMH ? "caution" : "ok";
            else nextState = "over";
            break;
        }
      }
      if (e.inside && vKmh >= LIMIT_KMH) e.overSec += dt;
      // Hápticos progresivos por velocidad (25 corto / 28 doble / 30+ continuo)
      alerts.updateHaptics(e.inside ? vKmh : null);"""),

"vehiculo": ("src/lib/vehicleDetect.ts · Detección de viaje en vehículo motorizado", """export function isMotorizedRide(s: VehicleSignals): boolean {
  // 1) Velocidad absoluta imposible en bici (moto/auto directo).
  if (s.maxKmh >= VEH_ABS_KMH) return true;
  // 2) Sostuvo el umbral sin frenar: huella clara de motor.
  if (s.vehStreakSec >= VEH_STREAK_SEC) return true;
  // 3) Acumuló mucho tiempo sobre el umbral (ráfagas entre semáforos).
  if (s.vehSec >= VEH_TOTAL_SEC) return true;
  // 4) Ritmo de vía urbana sostenido 10+ min: una bici del cerro
  //    no mantiene ese promedio (y la bajada no dura 10 min).
  if (s.avgKmh >= VEH_AVG_KMH && s.movingSec >= VEH_AVG_SEC) return true;
  return false;
}
// Umbrales: VEH_LIMIT_KMH=45 · VEH_TOTAL_SEC=90 · VEH_STREAK_SEC=45
//           VEH_AVG_KMH=32 · VEH_AVG_SEC=600 · VEH_ABS_KMH=90"""),

"ridesummary": ("src/lib/history.ts · Contrato de datos de un ride", """export type TrackPt = [lat: number, lon: number, eleM: number, tsSec: number];

export type RideSummary = {
  id: string;
  dateISO: string;
  source: "gps" | "sim";
  distanceKm: number;
  maxKmh: number;
  maxInParkKmh: number | null;
  inParkKm?: number | null;   // km DENTRO de la geocerca (base de desafíos)
  avgKmh: number;
  elapsedSec: number;
  gainM: number;
  overLimitSec: number;
  track?: TrackPt[];          // solo rides GPS desde v1.5.0
  account?: string;           // correo dueño (ride local si falta)
  motorized?: boolean;        // vehículo motorizado: no cuenta para nada
};"""),

"astar": ("src/lib/routing.ts · Bucle A* con heurística 0,65 x Haversine (líneas 293-316)", """  while (heap.size > 0) {
    const cur = heap.pop()!;
    const u = cur.i;
    if (done[u]) continue;
    done[u] = 1;
    explored++;
    const du = haversineM({ lat: runNet.nodes[u][0], lon: runNet.nodes[u][1] }, to);
    if (du < bestDist) {
      bestDist = du;
      bestNode = u;
    }
    if (u === t) break;
    for (const e of runNet.adj[u]) {
      if (done[e.to]) continue;
      const ng = g[u] + e.w;
      if (ng < g[e.to]) {
        g[e.to] = ng;
        prevEdgeRef[e.to] = e;
        prevNode[e.to] = u;
        const h = haversineM({ lat: runNet.nodes[e.to][0], lon: runNet.nodes[e.to][1] }, target) * 0.65;
        heap.push({ f: ng + h, i: e.to });
      }
    }
  }"""),

"nodo_virtual": ("src/lib/routing.ts · Origen anclado a la arista más cercana: nodo virtual (líneas 244-262)", """  const edge = nearestEdge(net, from, ORIGIN_ANCHOR_MAX_M);
  let runNet: Network = net;
  let s: number;
  if (edge) {
    const virt = net.nodes.length;
    const nodes2 = net.nodes.slice();
    nodes2.push([edge.point.lat, edge.point.lon]);
    const pu = { lat: net.nodes[edge.u][0], lon: net.nodes[edge.u][1] };
    const pv = { lat: net.nodes[edge.v][0], lon: net.nodes[edge.v][1] };
    const dU = Math.max(0.1, haversineM(edge.point, pu));
    const dV = Math.max(0.1, haversineM(edge.point, pv));
    const pen = PENALTY[edge.cls] ?? 1;
    const brU = bearing(edge.point, pu);
    const brV = bearing(edge.point, pv);
    const adj2 = net.adj.slice();
    adj2[virt] = [
      { to: edge.u, w: dU * pen, dist: dU, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: brU },
      { to: edge.v, w: dV * pen, dist: dV, cls: edge.cls, name: edge.name, ciclovia: edge.ciclovia, bearing: brV },
    ];"""),

"nearest_edge": ("src/lib/routing.ts · Proyección punto-segmento equirectangular (líneas 194-217)", """    const na = net.nodes[a];
    const nb = net.nodes[b];
    const ax = na[1] * kx, ay = na[0];
    const bx = nb[1] * kx, by = nb[0];
    const px = p.lon * kx, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qy = ay + dy * t;
    const dM = Math.hypot(px - qx, py - qy) * 111_320;
    if (dM < bestD) {
      bestD = dM;
      best = {
        u: a, v: b,
        cls: net.classes[clsIdx] ?? "residential",
        name: net.names[nameIdx] ?? "",
        ciclovia: ciclo === 1,
        point: { lat: na[0] + (nb[0] - na[0]) * t, lon: na[1] + (nb[1] - na[1]) * t },
        distM: dM,
      };
    }"""),

"attach_origin": ("src/lib/routing.ts · attachOrigin: coords[0] SIEMPRE es el pin GPS (líneas 500-519)", """  if (canTrim) {
    const tail = route.coords.slice(i + 1);
    // P reemplaza coords[i]; si la proyección cae prácticamente sobre
    // coords[i+1] (dup), el punto coincide con ese vértice y el "resto
    // del tramo i" desaparece: arrancamos desde el tramo i+1.
    const dup = tail.length > 0 && haversineM(pr.point, tail[0]) < 0.5;
    const tailClean = dup ? tail.slice(1) : tail;
    // tu pin SIEMPRE primero; chaflán pin→calle proyectada
    const coords: LatLng[] = [from, pr.point, ...tailClean];
    if (coords.length < 2) return route;

    const restIdx = dup ? i + 1 : i;
    // banderas/nombres: el chaflán se dibuja como vía compartida; el
    // resto conserva la clasificación original desde restIdx
    const flags: boolean[] = [false, ...route.flags.slice(restIdx)];
    const segNames: string[] = ["", ...route.segNames.slice(restIdx)];

    let distanceM = 0;
    for (let k = 0; k < coords.length - 1; k++) distanceM += haversineM(coords[k], coords[k + 1]);
    distanceM = Math.round(distanceM);"""),

"camara_waze": ("src/components/MiniMap.tsx · Cámara estilo Waze (líneas 499-520)", """    // El CENTRO de la cámara es la posición del ciclista y el relleno
    // superior corre el punto de ancla al ~30% del alto: el pin queda
    // clavado abajo y centrado mientras el mundo fluye bajo él.
    const h = boxRef.current?.clientHeight ?? 260;
    const anchorBottom = Math.round(h * (props.onRoute ? 0.3 : 0.34));
    const padding = { top: Math.max(0, Math.round(h) - anchorBottom * 2), bottom: 0, left: 0, right: 0 };

    // rumbo: curso del GPS → dirección de la ruta → mantener actual
    let b: number;
    if (props.heading !== null) {
      b = props.heading;
    } else if (props.onRoute && props.route && props.nearestIdx !== null && props.nearestIdx < props.route.coords.length - 1) {
      b = bearingOf(props.route.coords[props.nearestIdx], props.route.coords[props.nearestIdx + 1]);
    } else {
      b = map.getBearing();
    }
    const cur = map.getBearing();
    // giro por el camino corto (evita vueltas de 340°)
    while (b - cur > 180) b -= 360;
    while (b - cur < -180) b += 360;

    const camZoom = props.onRoute && props.remainingM < ARRIVAL_M ? ARRIVAL_ZOOM : NAV_ZOOM;"""),

"route_features": ("src/lib/navCanvasLogic.ts · La ruta dibujada siempre nace en tu posición (líneas 82-103)", """  // Fuera del vértice: proyección sobre la polilínea (chaflán corto a
  // la calle; jamás una diagonal que corte la cuadra)
  const pr = projectOnPolyline(route.coords, pos!);
  const i = Math.min(pr.segIdx, route.coords.length - 2);
  const stub = pr.distM > 2 && pr.distM <= CONNECTOR_MAX_M;
  const tail = route.coords.slice(i + 1);
  const remCoords = stub ? [pos!, pr.point, ...tail] : [pr.point, ...tail];
  const remFlags = stub ? [false, ...route.flags.slice(i)] : route.flags.slice(i);
  const remaining = toFc([
    ...(remCoords.length >= 2 ? [lineFeat(remCoords, { kind: "casing", ciclo: false })] : []),
    ...groupSegments(remCoords, remFlags, 0, remCoords.length - 2).map((g) =>
      lineFeat(g.coords, { kind: "seg", ciclo: g.ciclovia })
    ),
  ]);

  const travCoords = [...route.coords.slice(0, i + 1), pr.point];
  const travFlags = [...route.flags.slice(0, i), route.flags[i] ?? false];
  const traveled = toFc(
    groupSegments(travCoords, travFlags, 0, travCoords.length - 2).map((g) =>
      lineFeat(g.coords, { ciclo: g.ciclovia }))
  );"""),

"prisma_gen": ("prisma/schema.prisma · Generator con binaryTargets para el runtime de Vercel", """generator client {
  provider = "prisma-client-js"
  // "native" = el motor del sistema donde se genera (dev/sandbox).
  // "rhel-openssl-3.0.x" = el runtime de las funciones serverless de
  // Vercel (Amazon Linux 2023). Sin este target el build pasa pero el
  // login/rides/pagos fallan en producción con "Prisma Client could not
  // locate the Query Engine for runtime rhel-openssl-3.0.x".
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}"""),

"auth_hash": ("src/lib/auth.ts · scrypt + sesión opaca en base de datos (líneas 10-37)", """export const SESSION_COOKIE = "cumbre30_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Crea una sesión en DB y devuelve el token opaco. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}"""),

"login_cookie": ("src/app/api/auth/login/route.ts · Cookie httpOnly de sesión (líneas 11-19)", """    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ username: user.username, email: user.email });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });"""),

"borrar_cuenta": ("src/app/api/auth/account/route.ts · Borrado definitivo con cascade (líneas 13-22)", """export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  await db.user.delete({ where: { id: user.id } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}"""),

"ispro": ("src/lib/proDeliver.ts · Validación server-side del pago (líneas 37-45)", """export function isProPayment(p: MpPayment): boolean {
  if (p.status !== "approved") return false;
  if ((p.currency_id ?? "").toUpperCase() !== "CLP") return false;
  if (Number(p.transaction_amount) !== proAmount()) return false;
  // El enlace de aporte voluntario comparte cuenta: si el título del
  // link menciona "aporte", nunca es una venta Pro.
  if ((p.description ?? "").toLowerCase().includes("aporte")) return false;
  return true;
}"""),

"deliver": ("src/lib/proDeliver.ts · Entrega idempotente por paymentId (líneas 164-191)", """  const email = normalizeEmail(params.email);
  const existing = await db.proDelivery.findUnique({ where: { paymentId: params.paymentId } });
  if (existing) {
    return { ok: true, action: "already", code: existing.code };
  }
  const code = await generateProLicenseCode(email);
  try {
    await sendLicenseEmail(email, code);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fallo de envío" };
  }
  await db.proDelivery.create({ data: { paymentId: params.paymentId, email, code, amount: params.amount, via: params.via } });
  return { ok: true, action: "sent", code };"""),

"gmail": ("src/lib/proDeliver.ts · Transporte SMTP de Gmail (líneas 82-92)", """function transporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER as string,
      pass: (process.env.GMAIL_APP_PASSWORD as string).replace(/\\s+/g, ""),
    },
  });
}"""),

"licencia": ("src/lib/proLicenseCore.ts · Código determinista y validación offline (líneas 54-83)", """/** Código con formato C30P-XXXX-XXXX-XXXX-XXXX (16 caracteres base32). */
export async function generateProLicenseCode(email: string): Promise<string> {
  const sig = await hmacEmail(email);
  const raw = toBase32(sig.slice(0, 10)); // 10 bytes → 16 chars
  return `C30P-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/** ¿El código corresponde a este correo? (offline, sin servidor) */
export async function validateProCode(email: string, code: string): Promise<boolean> {
  if (!email.trim() || !code.trim()) return false;
  const expected = cleanCode(await generateProLicenseCode(email));
  const given = cleanCode(code);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}"""),

"verceljson": ("vercel.json · Build, región y redirects por host", """{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "prisma generate && next build",
  "regions": ["gru1"],
  "redirects": [
    { "source": "/", "has": [{ "type": "host", "value": "cumbregeo.cl" }], "destination": "/geo", "permanent": false },
    { "source": "/", "has": [{ "type": "host", "value": "www.cumbregeo.cl" }], "destination": "/geo", "permanent": false }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }] }
  ]
}"""),

"gradle": ("android/app/build.gradle · Versión y firmas (extracto)", """    defaultConfig {
        applicationId "cl.cumbre30.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 28
        versionName "1.8.2"
    }
    buildTypes {
        debug { signingConfig signingConfigs.debug }
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            if (keystorePropertiesFile.exists()) { signingConfig signingConfigs.release }
        }
    }"""),
}
