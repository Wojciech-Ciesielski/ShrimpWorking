// Zrzuty ekranów Shrimp Install w trybie podglądu, do porównania z shrimp-handoff/screenshots/install-*.png.
// Użycie: npm run build && node scripts/screens.mjs <katalog-wyjściowy>
import { createRequire } from "node:module";
import { preview } from "vite";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const out = process.argv[2] || "screens";
const STATES = [
  ["01-start", "start"], ["02-nosnik", "nosnik"], ["03-pliki", "pliki"], ["04-postep", "postep"], ["05-gotowe", "gotowe"],
  ["06-nosnik-lista", "nosnik-lista"], ["07-nosnik-info", "nosnik-info"], ["08-brak-nosnika", "brak-nosnika"],
  ["09-za-maly", "za-maly"], ["10-pliki-reczny", "pliki-reczny"], ["11-brak-internetu", "brak-internetu"],
  ["12-nosnik-zajety", "nosnik-zajety"], ["13-pytanie-rufusa", "pytanie-rufusa"],
];
const server = await preview({ preview: { port: 4180 }, logLevel: "silent" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
for (const theme of ["light", "dark"]) {
  for (const [name, screen] of STATES) {
    await page.goto(`http://localhost:4180/?screen=${screen}&theme=${theme}&shot`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${out}/install-${theme}-${name}.png` });
  }
}
await browser.close();
server.httpServer.close();
console.log(`${STATES.length * 2} zrzutów w ${out}`);
