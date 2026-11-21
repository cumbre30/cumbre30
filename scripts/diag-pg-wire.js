// Prueba protocolo PG: SSLRequest + inicio TLS.
// Uso: node scripts/diag-pg-wire.js <host> [puerto]
const net = require("net");
const host = process.argv[2];
const port = Number(process.argv[3] || 5432);
const t0 = Date.now();
const s = net.connect({ host, port, family: 4 });
s.setTimeout(15000, () => { console.log(`${Date.now() - t0}ms TIMEOUT (sin respuesta)`); process.exit(1); });
s.on("connect", () => {
  console.log(`${Date.now() - t0}ms TCP ABIERTO — enviando SSLRequest`);
  s.write(Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]));
});
s.on("data", (d) => {
  console.log(`${Date.now() - t0}ms respuesta: ${d.length} bytes, primer byte 0x${d[0].toString(16)} (${d[0] === 0x53 ? "'S' → acepta TLS" : d[0] === 0x4e ? "'N' → sin TLS" : "?"})`);
  process.exit(0);
});
s.on("error", (e) => { console.log(`${Date.now() - t0}ms ERROR ${e.message || e.code}`); process.exit(1); });
