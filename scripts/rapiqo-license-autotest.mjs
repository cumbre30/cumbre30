// Autotest del formato de licencia RAPIQO contra la lógica EXACTA del
// dist 2.9.0 (bundle index-CAuxD0n1.js):
//   clave = RQ1.<payload b64url>.<sig b64url>
//   payload JSON { t:'rapiqo-pro', id, n?, e? } — el dist exige t==='rapiqo-pro'
//     y rechaza si e < now (e null = perpetual).
//   firma = ECDSA P-256 SHA-256 sobre los BYTES JSON del payload, en r||s
//     crudo (ieee-p1363). El dist verifica con WebCrypto:
//     crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}, spki, sig, payloadBytes)
// Este script firma con node:crypto (dsaEncoding:'ieee-p1363') y verifica
// con el WebCrypto global, replicando kt()/Tt()/Et() del bundle. Al final
// firma y verifica con el PAR DE PRODUCCIÓN real (rapiqo-keys/).
import crypto from "node:crypto";
import fs from "node:fs";

const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function sign(privateKey, payloadObj) {
  const json = JSON.stringify(payloadObj);
  const body = b64url(json);
  const sig = crypto.sign("sha256", Buffer.from(json), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `RQ1.${body}.${b64url(sig)}`;
}

// Réplica exacta de la verificación del dist (kt + wt + Tt + Et).
async function verify(key, publicKeyB64, now = Date.now()) {
  const m = /^RQ1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key.trim());
  if (!m) return { ok: false, error: "malformed" };
  const payloadBytes = new Uint8Array(fromB64url(m[1]));
  const sigBytes = new Uint8Array(fromB64url(m[2]));
  const spki = new Uint8Array(Buffer.from(publicKeyB64, "base64"));
  let pub;
  try {
    pub = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    return { ok: false, error: "spki" };
  }
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, sigBytes, payloadBytes);
  if (!ok) return { ok: false, error: "signature" };
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (payload.t !== "rapiqo-pro") return { ok: false, error: "type" };
  if (payload.e !== null && payload.e !== undefined && payload.e < now) return { ok: false, error: "expired" };
  return { ok: true, payload };
}

const results = [];

// 1) Par efímero: todos los caminos del verificador del dist.
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const spkiB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");

const k1 = sign(privateKey, { t: "rapiqo-pro", id: "TEST-0001", n: "Prueba", e: null });
const r1 = await verify(k1, spkiB64);
results.push(["perpetual verifica (payload redondo)", r1.ok === true && r1.payload?.id === "TEST-0001"]);

const k2 = sign(privateKey, { t: "rapiqo-pro", id: "TEST-0002", e: Date.now() + 86400000 });
results.push(["con e futuro verifica", (await verify(k2, spkiB64)).ok === true]);

const k3 = sign(privateKey, { t: "rapiqo-pro", id: "TEST-0003", e: Date.now() - 1000 });
results.push(["expirada rechazada (error=expired)", (await verify(k3, spkiB64)).error === "expired"]);

// Tampering determinista: payload válido pero firmado con otro contenido.
const evilBody = b64url(JSON.stringify({ t: "rapiqo-pro", id: "HACK" }));
results.push(["payload alterado rechazado (signature)", (await verify(`RQ1.${evilBody}.${k1.split(".")[2]}`, spkiB64)).error === "signature"]);

results.push(["otro tipo rechazado (error=type)", (await verify(sign(privateKey, { t: "otro" }), spkiB64)).error === "type"]);
results.push(["formato malo rechazado (malformed)", (await verify("RQ1.xxx", spkiB64)).error === "malformed"]);

// 2) Par de PRODUCCIÓN real (rapiqo-keys/): firmar con private.pem y
//    verificar EXACTAMENTE con el public.b64 que irá a la app.
try {
  const priv = crypto.createPrivateKey(fs.readFileSync("/home/z/my-project/rapiqo-keys/private.pem", "utf8"));
  const pubB64 = fs.readFileSync("/home/z/my-project/rapiqo-keys/public.b64", "utf8").trim();
  const pubDer = crypto.createPublicKey(priv).export({ format: "der", type: "spki" }).toString("base64");
  results.push(["public.b64 == SPKI de private.pem", pubDer === pubB64]);
  const kp = sign(priv, { t: "rapiqo-pro", id: "PROD-SMOKE", n: "smoke", e: null });
  const rp = await verify(kp, pubB64);
  results.push(["par de producción firma y verifica", rp.ok === true]);
  const rpExp = await verify(sign(priv, { t: "rapiqo-pro", id: "PROD-EXP", e: Date.now() + 365 * 86400000 }), pubB64);
  results.push(["producción con 365 días verifica", rpExp.ok === true]);
} catch (e) {
  results.push(["par de producción", "SKIP: " + (e.code ?? e.message)]);
}

let fails = 0;
for (const [name, r] of results) {
  const tag = r === true ? "PASS" : r === false ? "FAIL" : "SKIP";
  if (r === false) fails++;
  console.log(`${tag} | ${name}`);
}
process.exit(fails ? 1 : 0);
