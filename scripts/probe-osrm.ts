import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
async function main() {
  const url = "https://routing.openstreetmap.de/routed-bike/route/v1/driving/-70.642000,-33.447000;-70.604000,-33.406900?overview=false&radiuses=200;";
  const t = Date.now();
  try {
    const r = await fetch(url);
    const j = await r.json();
    console.log("HTTP", r.status, j.code, Math.round(j.routes?.[0]?.distance ?? 0), "m", Date.now() - t, "ms");
  } catch (e) {
    console.log("FALLO:", (e as Error).name, (e as Error).message, Date.now() - t, "ms");
  }
}
void main();
