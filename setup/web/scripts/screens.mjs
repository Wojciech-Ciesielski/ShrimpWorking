// Zrzuty każdego stanu Setup (tryb podglądu) do porównania z shrimp-handoff/screenshots/setup-*.png.
// Użycie: npm run build && node scripts/screens.mjs <katalog-wyjściowy> [szerokość wysokość]
import { createRequire } from "node:module";
import { preview } from "vite";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const out = process.argv[2] || "screens";
const W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080);
const STATES = [
  ["01-witaj", 0], ["02-jezyk", 1], ["03-region", 2], ["04-klawiatura", 3], ["05-dysk", 4], ["06-konto", 5],
  ["07-podsumowanie", 6], ["08-instalowanie", 7, 0, "", 2500], ["09-restart", 8], ["10-czesc", 9], ["11-siec", 10], ["12-wyglad", 11],
  ["13-sterowniki", 12], ["14-programy", 13], ["15-gotowe", 14], ["16-dysk-zaawansowane", 4, 1], ["17-siec-ukryta", 10, 1],
  ["18-siec-zaawansowane", 10, 2], ["19-wyglad-kolor", 11, 1], ["20-sterowniki-nvidia", 12, 1], ["21-programy-z-windows", 13, 1],
  ["22-programy-proponowane", 13, 2], ["23-gotowe-pokaz", 14, 1], ["24-hasla-sie-roznia", 5, 0, "pass"], ["25-hasla-dysku", 4, 1, "dpass"],
  ["26-za-malo-miejsca", 4, 0, "space"], ["27-blad-instalacji", 7, 0, "install"], ["28-zle-haslo-sieci", 10, 0, "wifi"], ["29-brak-internetu", 13, 3, "net"],
  ["30-dysk-bitlocker", 4, 0, "", 1200, "&bitlocker=1"],
];

const server = await preview({ preview: { port: 4179 }, logLevel: "silent" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const [name, step, sub = 0, err = "", wait = 1200, extra = ""] of STATES) {
  await page.goto(`http://localhost:4179/?step=${step}&sub=${sub}${err ? "&err=" + err : ""}${extra}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/setup-${name}.png` });
}
await browser.close();
server.httpServer.close();
console.log(`${STATES.length} zrzutów w ${out}`);
