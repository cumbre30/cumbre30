// Screenshot de /pro (marca Cumbre GEO) para control visual.
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/pro`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByText("CUMBRE").first().waitFor({ timeout: 30_000 });
await page.screenshot({ path: "/tmp/render/pro-cumbre-geo.png" });
await browser.close();
console.log("OK screenshot /tmp/render/pro-cumbre-geo.png");
