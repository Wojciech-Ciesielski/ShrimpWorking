import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./style.css";
import { start } from "./app";
import { AgamaBackend } from "./backend/agama";
import { ShrimpFirstBoot } from "./backend/firstboot";
import { demoInstall, demoFirstBoot } from "./backend/demo";
import type { Backends } from "./backend/types";

// Tryb wybiera shrimp-setup przez adres: ?mode=install (nośnik) albo ?mode=firstboot (po restarcie).
// Bez parametru: podgląd na danych z makiety.
const mode = (new URLSearchParams(location.search).get("mode") || "demo") as Backends["mode"];
const be: Backends =
  mode === "install" ? { mode, install: new AgamaBackend(), firstboot: demoFirstBoot }
  : mode === "firstboot" ? { mode, install: demoInstall, firstboot: new ShrimpFirstBoot() }
  : { mode: "demo", install: demoInstall, firstboot: demoFirstBoot };

start(document.getElementById("app")!, be);
