// Diagnóstico de conexión a Neon: DNS y TCP por separado.
require("dns").setDefaultResultOrder("ipv4first");
const dns = require("dns");
const net = require("net");
const hosts = process.argv.slice(2);
const t0 = Date.now();
const log = (m) => console.log(`${Date.now() - t0}ms ${m}`);
(async () => {
  for (const host of hosts) {
    log(`--- ${host}`);
    await new Promise((r) =>
      dns.lookup(host, { all: true }, (e, a) => {
        log(e ? `dns.lookup ERROR ${e.code}` : `dns.lookup: ${a.map((x) => x.family + ":" + x.address).join(", ")}`);
        r();
      })
    );
    const addrs = await new Promise((r) =>
      dns.lookup(host, { all: true }, (e, a) => r(e ? [] : a))
    );
    for (const ad of addrs.slice(0, 2)) {
      await new Promise((r) => {
        const s = net.connect({ host: ad.address, port: 5432, family: ad.family });
        const done = (m) => { log(`TCP ${ad.family} ${ad.address}: ${m}`); s.destroy(); r(); };
        s.setTimeout(12000, () => done("TIMEOUT 12s"));
        s.on("connect", () => done("ABIERTO"));
        s.on("error", (e) => done(`ERROR ${e.message || e.code}`));
      });
    }
  }
})();
