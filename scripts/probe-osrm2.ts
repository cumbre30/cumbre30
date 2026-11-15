import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/red-ciclista.json")) throw new Error("no");
  return realFetch(url);
}) as typeof fetch;

async function main() {
  const url = "https://routing.openstreetmap.de/routed-bike/route/v1/driving/-70.642000,-33.447000;-70.604000,-33.406900?overview=full&geometries=geojson&steps=true&alternatives=false&radiuses=200;";
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    console.log("HTTP", r.status);
    const j = await r.json();
    console.log("code:", j.code, "routes:", j.routes?.length, "dist:", Math.round(j.routes?.[0]?.distance ?? 0), "legs:", j.routes?.[0]?.legs?.length, Date.now() - t, "ms");
  } catch (e) {
    console.log("FALLO:", (e as Error).name, (e as Error).message, Date.now() - t, "ms");
  }
}
void main();
