// Ejecuta SQL contra la base apuntada por DATABASE_URL (Neon u otra).
// Uso: DATABASE_URL=... node scripts/sql-neon.js "SELECT ..."
const { Client } = require("pg");
const dns = require("dns");
// El sandbox enruta IPv6 a un blackhole: resolver el host a IPv4 y
// reemplazarlo en la cadena (TLS sin verificación de nombre).
async function aIPv4(url) {
  const limpio = url.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const u = new URL(limpio);
  const addrs = await dns.promises.lookup(u.hostname, { all: true, family: 4 });
  const endpoint = u.hostname.split(".")[0].replace(/-pooler$/, "");
  return limpio.replace(u.hostname, addrs[0].address) + `?options=endpoint%3D${endpoint}`;
}
(async () => {
  const urlOriginal = process.env.DATABASE_URL.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const hostname = new URL(urlOriginal).hostname;
  const url = await aIPv4(process.env.DATABASE_URL);
  let c;
  for (let i = 1; i <= 3; i++) {
    c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: hostname }, connectionTimeoutMillis: 30000 });
    try {
      await c.connect();
      break;
    } catch (e) {
      if (i === 3) throw e;
      console.error(`(reintento ${i}: ${e.message || e.code})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  try {
    const r = await c.query(process.argv[2]);
    console.log(r.command || "OK");
    if (r.rows && r.rows.length) console.log(JSON.stringify(r.rows));
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("ERROR:", JSON.stringify({ msg: e.message, code: e.code, detail: e.detail, where: e.where, data: e.data })); process.exit(1); });
