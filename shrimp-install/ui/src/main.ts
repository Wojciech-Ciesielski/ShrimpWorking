import "./style.css";
import { App, type Route } from "./app";
import { DemoBackend, type DemoOptions } from "./backend/demo";
import { HostBackend, hasHost } from "./backend/host";

// Parametry: ?screen=<ekran makiety>&theme=light|dark&shot (zrzuty: bez upływu czasu).
// Program może je też wstrzyknąć jako window.SHRIMP_OPTS (np. shrimp-install.exe --demo).
declare global { interface Window { SHRIMP_OPTS?: { demo?: boolean; screen?: string; theme?: string } } }
const q = new URLSearchParams(location.search);
const opt = { ...window.SHRIMP_OPTS };
const screen = (q.get("screen") || opt.screen || "start") as Route;
const theme = q.get("theme") || opt.theme;
if (theme) document.documentElement.dataset.theme = theme;

const demo: DemoOptions = {
  devices: screen === "brak-nosnika" ? "none" : screen === "za-maly" ? "small" : "ok",
  offline: screen === "brak-internetu",
  at: screen === "postep" ? 24 : 0,
  frozen: q.has("shot"),
};
const real = hasHost() && !opt.demo && !q.has("demo");
const app = new App(real ? new HostBackend() : new DemoBackend(demo), !real);
if (!real && screen === "pliki-reczny") app.presetPicked(DemoBackend.PICKED);
app.init(real ? "start" : screen);
