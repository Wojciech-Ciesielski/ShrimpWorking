// Część 2 Setup: pierwsza konfiguracja. Mówi z lokalnym serwerem shrimp-setup (Rust)
// pod tym samym originem: /shrimp/api/*. Token sesji przychodzi w adresie strony (?k=…).
import { mapWindowsApps } from "../logic";
import { OfflineError, WifiError, type DriverChoice, type FirstBootBackend, type FirstBootInfo, type Network, type NetworkAdvanced, type Progress } from "./types";

const key = new URLSearchParams(location.search).get("k") || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch("/shrimp/api" + path, {
    method,
    headers: { "X-Shrimp-Key": key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  const data = t ? JSON.parse(t) : null;
  if (!r.ok) {
    const kind = data?.error;
    if (kind === "wifi") throw new WifiError(data.message);
    if (kind === "offline") throw new OfflineError(data.message);
    throw new Error(data?.message || `${method} ${path}: ${r.status}`);
  }
  return data as T;
}

interface Job { state: "running" | "done" | "failed" | "offline"; percent: number; phase: string; etaMin?: number }

export class ShrimpFirstBoot implements FirstBootBackend {
  /** Serwer zwraca programy z shrimp.json (nazwy i pakiety Store); odpowiedniki dobieramy tutaj. */
  async info(): Promise<FirstBootInfo> {
    const i = await call<Omit<FirstBootInfo, "windowsApps"> & { windowsApps: string[] | null; storeApps?: string[] | null }>("GET", "/info");
    const { storeApps, ...rest } = i;
    const apps = i.windowsApps || storeApps ? mapWindowsApps(i.windowsApps || [], storeApps || []) : null;
    return { ...rest, windowsApps: apps && apps.length ? apps : null };
  }
  networks() { return call<Network[]>("GET", "/networks"); }
  async connect(ssid: string, password?: string) { await call("POST", "/network/connect", { ssid, password }); }
  async connectHidden(ssid: string, security: "none" | "wpa2" | "wpa3", password?: string) {
    await call("POST", "/network/connect", { ssid, password, security, hidden: true });
  }
  async setNetworkAdvanced(a: NetworkAdvanced) { await call("POST", "/network/advanced", a); }
  async setAppearance(scheme: "default" | "prefer-dark", accent: string | null) { await call("POST", "/appearance", { scheme, accent }); }
  async setDrivers(c: DriverChoice) { await call("POST", "/drivers", c); }
  async installApps(ids: string[], onProgress: (p: Progress) => void) {
    await call("POST", "/apps", { ids });
    for (;;) {
      await sleep(700);
      const j = await call<Job>("GET", "/apps");
      if (j.state === "offline") throw new OfflineError();
      if (j.state === "failed") throw new OfflineError(j.phase);
      onProgress({ percent: j.percent, phase: j.state === "done" ? "Gotowe" : j.phase, etaMin: j.etaMin });
      if (j.state === "done") return;
    }
  }
  async finish() { await call("POST", "/finish"); }
}
