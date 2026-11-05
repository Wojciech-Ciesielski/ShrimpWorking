// Setup Shrimp: jedna ciągła prezentacja, instalacja (kroki 1–9) i pierwsza konfiguracja (10–15).
// Układ, teksty i zachowanie przeniesione z shrimp-handoff/mockups/setup.html; dane i akcje idą przez backendy.
import logoSrc from "./assets/logo.svg?raw";
import iconSprite from "./assets/icons.svg?raw";
import {
  HELLO, ENCS, HSEC, IPS, DNSS, PROXY, THEMES, DRV, NV, ACCENTS, PLACES, USES, ERR, SHRIMP_MIN_GB,
  DEFAULT_KB, DEFAULT_TZ, slides, type ErrKey, type Lang, type Region, type Keyboard,
} from "./data";
import { firstName, slug, proposals, windowsList, tnow, esc } from "./logic";
import { InstallError, OfflineError, type Backends, type Disk, type FirstBootInfo, type InstallPlan, type Network, type Place } from "./backend/types";

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];

const STEPS = ["witaj", "jezyk", "region", "klawiatura", "dysk", "konto", "podsumowanie", "instalacja", "restart",
  "czesc", "siec", "wyglad", "sterowniki", "programy", "gotowe"] as const;
type StepId = (typeof STEPS)[number];
const idx = (id: StepId) => STEPS.indexOf(id);
const THEME_STEP = idx("wyglad");
const FIRST_BOOT = idx("czesc");

/** Logo przycięte do ramki kształtu (DESIGN.md › Logo) i barwione kolorem tekstu. */
const LOGO = logoSrc.replace(/viewBox="[^"]*"/, 'viewBox="-1.1 3.6 184.6 178.5"').replace(/fill="#000"/g, 'fill="currentColor"')
  .replace("<svg", '<svg class="sh" role="img" aria-label="Logo Shrimp"');
const logo = (w: string) => `<div class="logo" style="width:${w}">${LOGO}</div>`;
const icon = (name: string, cls = "", label = "") =>
  `<svg class="i ${cls}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><use href="#${name}"/></svg>`;

export function start(root: HTMLElement, be: Backends) {
  document.body.insertAdjacentHTML("afterbegin", `<div hidden>${iconSprite}</div>`);
  root.innerHTML = `
    <div class="screen" id="screen" data-look="light">
      <div class="wall" aria-hidden="true"></div><div class="veil" aria-hidden="true"></div>
      <button class="back" id="back" type="button" aria-label="Wstecz" hidden>${icon("go-previous-symbolic")}</button>
      <button class="infobtn" id="infoBtn" type="button" aria-label="Informacje" hidden>${icon("help-about-symbolic")}</button>
      <div class="pop" id="infoPop" role="tooltip">Sterownik NVIDIA zapewnia pełną wydajność w grach i programach graficznych. Sterownik otwarty jest prostszy, ale działa wolniej.</div>
      <section class="pane" id="pane" aria-live="polite"></section>
      <div class="scrim" id="modal" hidden>
        <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dT" aria-describedby="dD">
          ${icon("dialog-warning-symbolic", "ic")}
          <h2 id="dT"></h2><p id="dD"></p>
          <div class="acts"><button class="btn" id="dP" type="button"></button><button class="skip" id="dS" type="button"></button></div>
        </div>
      </div>
    </div>`;
  const screen = $("#screen")!, pane = $("#pane")!, modal = $("#modal")!;

  // --- dane z backendów ---
  let LANGS: Lang[] = [], REGS: Region[] = [], KBS: Keyboard[] = [], DISKS: Disk[] = [], NETS: Network[] = [];
  let INFO: FirstBootInfo = { fullName: "", beside: false, wired: false, nvidia: null, windowsApps: null };

  const S = {
    lang: 0, region: 0, kb: 0, place: 0, win: 0, disk: 0, enc: 0, dp: "", dp2: "", online: true,
    full: "", user: "", userEdited: false, pass: "", pass2: "", confirm: false,
    net: 0, netPass: "", hsec: 1, ssid: "", hpass: "", ip: 0, dns: 0, proxy: 0,
    theme: "light" as "light" | "dark", accent: null as number | null, drv: 0, nv: 0,
    use: [true, false, false, false, true], sel: {} as Record<string, boolean>, err: null as ErrKey | null,
  };
  let step = 0, sub = 0, boot = false, busy = false;
  const T: Record<string, number> = {};
  const cur = () => STEPS[step];
  const disk = () => DISKS[S.disk];
  const hasWin = () => !!disk()?.windows;
  const beside = () => (be.mode === "install" ? hasWin() && S.place === 0 : INFO.beside);
  const pool = () => disk()?.windows?.poolGB ?? disk()?.sizeGB ?? 0;
  const winMin = () => disk()?.windows?.minGB ?? 0;
  const place = (): Place => (!hasWin() ? "whole" : S.place === 0 ? "beside" : "replace");
  const winApps = () => windowsList(INFO.windowsApps);
  const props = () => proposals(S.use, INFO.windowsApps);
  const hasNvidia = () => !!INFO.nvidia;

  // --- wygląd: jasny do kroku „Wygląd”, od niego wybrany ---
  function applyLook() { screen.dataset.look = boot ? "boot" : step >= THEME_STEP ? S.theme : "light"; }
  function applyAccent() {
    if (S.accent === null) { screen.style.removeProperty("--s-acc"); screen.style.removeProperty("--s-acc-on"); }
    else { screen.style.setProperty("--s-acc", ACCENTS[S.accent][2]); screen.style.setProperty("--s-acc-on", "#fff"); }
  }

  // --- klocki widoku ---
  const head = (h: string, s?: string) => `<h1 class="h1">${h}</h1>` + (s ? `<p class="sub">${s}</p>` : "");
  const body = (h: string) => `<div class="body">${h}</div>`;
  function acts(p: string, skip?: string, o: { hid?: boolean; act?: string; skipAct?: string } = {}) {
    return `<div class="acts"${o.hid ? " hidden" : ""}>` + (p ? `<button class="btn" data-act="${o.act || "next"}" type="button">${p}</button>` : "") +
      (skip ? `<button class="skip" data-act="${o.skipAct || "skip"}" type="button">${skip}</button>` : "") + "</div>";
  }
  type Item = string | { t: string; m?: string };
  function lst(l: string, items: Item[], curI: number, o: { row?: boolean; scroll?: boolean } = {}) {
    return `<div class="list${o.row ? " row" : ""}${o.scroll ? " scroll" : ""}" data-l="${l}" role="radiogroup">` + items.map((t, j) => {
      const it = typeof t === "string" ? { t } : t;
      return `<button class="opt${j === curI ? " sel" : ""}" role="radio" aria-checked="${j === curI}" data-i="${j}" type="button"><span class="t">${icon("go-next-symbolic", "mk")}${it.t}</span>` +
        (it.m ? ` <span class="meta">${it.m}</span>` : "") + "</button>";
    }).join("") + "</div>";
  }
  function tgl(l: string, items: string[], onFn: (j: number) => boolean) {
    return `<div class="list" data-l="${l}">` + items.map((t, j) => {
      const on = onFn(j);
      return `<button class="opt${on ? " on" : ""}" role="checkbox" aria-checked="${on}" data-t="${j}" type="button"><span class="t">${icon("object-select-symbolic", "mk")}${t}</span></button>`;
    }).join("") + "</div>";
  }
  const col = (label: string, l: string, items: Item[], c: number) => `<div class="col"><div class="cl">${label}</div>${lst(l, items, c)}</div>`;
  const field = (id: string, label: string, val: string, type = "text", extra = "") =>
    `<div class="f" ${extra}><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val)}" autocomplete="off" spellcheck="false"></div>`;

  function descFor() {
    const id = cur();
    if (id === "region") { const r = REGS[S.region]; return r ? r.tzLabel + " · " + tnow(r.tz) : ""; }
    if (id === "dysk") {
      if (sub === 1) return S.enc === 1 ? "Komputer zapyta o to hasło przy każdym uruchomieniu. Bez niego nie odzyskasz danych." : "";
      return hasWin() ? PLACES[S.place].d : "Shrimp zajmie cały dysk " + esc(disk()?.name || "") + "." + (DISKS.some((d) => d.windows) ? " Windows zostaje na drugim dysku." : "");
    }
    if (id === "wyglad") return "Zawsze możesz to zmienić w ustawieniach.";
    if (id === "sterowniki") return S.nv === 0 ? "Najlepsza wydajność w grach i programach graficznych." : "Prostszy w działaniu, ale mniej wydajny.";
    return "";
  }

  // --- widoki kroków ---
  function view(): string {
    switch (cur()) {
      case "witaj": return logo("13cqw") + `<h1 class="h1" id="hello">Witaj</h1><p class="sub">Przygotujmy Shrimp na Twoim komputerze.</p>` + acts("Zaczynajmy");
      case "jezyk": return logo("6cqw") + head("Wybierz język") + body(lst("lang", LANGS.map((l) => l.name), S.lang, { scroll: true })) + acts("Dalej");
      case "region": return logo("6cqw") + head("Gdzie jesteś?", "Ustawimy strefę czasową i format dat.") +
        body(lst("region", REGS.map((r) => r.label), S.region, { scroll: true }) + `<p class="desc" id="desc">${descFor()}</p>`) + acts("Dalej");
      case "klawiatura": return logo("6cqw") + head("Wybierz układ klawiatury") +
        body(lst("kb", KBS.map((k) => k.name), S.kb, { scroll: true }) + `<div class="fields" style="margin-top:2.2cqw">${field("kbT", "Sprawdź układ", "")}</div>`) + acts("Dalej");
      case "dysk": {
        if (sub === 1) return logo("6cqw") + head("Zaawansowane") + body(`<div class="cols">` +
          col("Dysk", "disk", DISKS.map((d) => ({ t: esc(d.name), m: `${d.sizeGB} GB · ${d.windows ? "Windows" : "pusty"}` })), S.disk) + col("Szyfrowanie dysku", "enc", ENCS, S.enc) + "</div>" +
          (S.enc === 1 ? `<div class="fields wide" style="margin-top:2.4cqw"><div class="frow">${field("inDp", "Hasło dysku", S.dp, "password")}${field("inDp2", "Powtórz hasło dysku", S.dp2, "password")}</div></div>` : "") +
          `<p class="desc" id="desc">${descFor()}</p>`) + acts("Gotowe", "", { act: "done" });
        if (!hasWin()) return logo("6cqw") + head("Gdzie zainstalować Shrimp?") + body(`<p class="desc" id="desc" style="margin-top:0">${descFor()}</p>`) + acts("Dalej", "Zaawansowane", { skipAct: "adv" });
        return logo("6cqw") + head("Gdzie zainstalować Shrimp?") + body(lst("place", PLACES.map((p) => p.n), S.place) +
          (S.place === 0
            ? `<div class="split"><div class="sp">Windows<b id="wGB"></b></div><div class="sp r">Shrimp<b id="sGB"></b></div><input class="rng" id="rng" type="range" min="0" max="${pool()}" step="1" value="${S.win}" aria-label="Podział dysku"></div>`
            : `<p class="desc" id="desc">${descFor()}</p>`)) + acts("Dalej", "Zaawansowane", { skipAct: "adv" });
      }
      case "konto": return logo("6cqw") + head("Utwórz konto", "Będzie potrzebne do logowania.") + body(`<div class="fields wide"><div class="frow">` +
        field("inFull", "Imię i nazwisko", S.full) + field("inUser", "Nazwa użytkownika", S.user) + "</div>" + field("inPass", "Hasło", S.pass, "password") +
        field("inPass2", "Potwierdź hasło", S.pass2, "password", 'id="f2"' + (S.confirm ? "" : " hidden")) + "</div>") + acts("Dalej");
      case "podsumowanie": {
        const rows: [string, string][] = [["Język", LANGS[S.lang]?.name], ["Region", REGS[S.region]?.label], ["Klawiatura", KBS[S.kb]?.name], ["Dysk", esc(disk()?.name || "")],
          ["Instalacja", place() === "whole" ? "Cały dysk" : place() === "beside" ? "Obok Windows" : "Zamiast Windows"]];
        if (beside()) rows.push(["Podział dysku", `Windows ${S.win} GB · Shrimp ${pool() - S.win} GB`]);
        rows.push(["Konto", `${esc(S.full)} (${esc(S.user)})`]);
        if (S.enc === 1) rows.push(["Szyfrowanie", "Włączone"]);
        return logo("6cqw") + head("Gotowi do instalacji", "Nic nie zmieni się, dopóki nie klikniesz „Zainstaluj”.") +
          body(`<div class="sum">${rows.map((r) => `<span>${r[0]}</span><b>${r[1]}</b>`).join("")}</div>`) + acts("Zainstaluj");
      }
      case "instalacja": return logo("9cqw") + head("Instalowanie Shrimp") + `<div class="pbar" role="progressbar" aria-label="Instalowanie"><i id="ib"></i></div><div class="cap"><b id="ph">Przygotowanie dysku</b><span id="eta">Pozostało około 11 min</span></div>` + acts("Dalej", "", { hid: true });
      case "restart": return logo("13cqw") + head("Instalacja zakończona", "Uruchom ponownie komputer, aby dokończyć.") + acts("Uruchom ponownie");
      case "czesc": return logo("13cqw") + head("Cześć, " + esc(firstName(be.mode === "install" ? S.full : INFO.fullName || S.full)), "Dokończmy konfigurację. To zajmie chwilę.") + acts("Dalej");
      case "siec": {
        if (sub === 1) return logo("6cqw") + head("Ukryta sieć", "Wpisz dane sieci, której nie widać na liście.") + body(`<div class="fields">` + field("inSsid", "Nazwa sieci", S.ssid) +
          `<div class="f"><label>Zabezpieczenie</label>${lst("hsec", HSEC, S.hsec, { row: true })}</div>` + (S.hsec ? field("inHPass", "Hasło", S.hpass, "password") : "") + "</div>") +
          acts("Połącz", "Anuluj", { act: "hconnect", skipAct: "cancel" });
        if (sub === 2) return logo("6cqw") + head("Zaawansowane") + body(`<div class="cols">${col("Adres IP", "ip", IPS, S.ip)}${col("Serwer DNS", "dns", DNSS, S.dns)}${col("Proxy", "proxy", PROXY, S.proxy)}</div>`) + acts("Gotowe", "", { act: "done" });
        const n = NETS[S.net];
        return logo("6cqw") + head("Połącz z siecią") + body(lst("net", NETS.map((x) => ({ t: esc(x.ssid) + (x.secure ? " " + icon("network-wireless-encrypted-symbolic", "lk", "Zabezpieczona") : ""), m: x.secure ? "" : "Otwarta" })), S.net) +
          (!n ? "" : n.secure ? `<div class="fields" style="margin-top:1.8cqw">${field("inNet", "Hasło sieci " + esc(n.ssid), S.netPass, "password")}</div>`
            : `<p class="desc" id="desc" style="margin-top:1.8cqw">Sieć otwarta. Inni mogą widzieć, co w niej robisz.</p>`)) +
          acts("Dalej", "Pomiń") + `<div class="mini"><button class="mlink" data-act="hid" type="button">Ukryta sieć</button><button class="mlink" data-act="nadv" type="button">Zaawansowane</button></div>`;
      }
      case "wyglad":
        if (sub === 1) return logo("6cqw") + head("Wybierz kolor") + body(`<div class="sws" role="radiogroup">` + ACCENTS.map((a, j) =>
          `<button class="sw" role="radio" aria-checked="${S.accent === j}" aria-label="${a[0]}" data-c="${j}" style="--c:${a[2]}" type="button"></button>`).join("") +
          `</div><p class="accname" id="accn">${S.accent === null ? "" : ACCENTS[S.accent][0]}</p>`) + acts("Dalej");
        return logo("6cqw") + head("Wybierz wygląd") + body(lst("theme", THEMES, S.theme === "dark" ? 1 : 0) + `<p class="desc" id="desc">${descFor()}</p>`) + acts("Dalej");
      case "sterowniki":
        if (sub === 1) return logo("6cqw") + head("Karta graficzna NVIDIA", `Wykryliśmy kartę ${esc(INFO.nvidia || "NVIDIA")}.`) + body(lst("nv", NV, S.nv) + `<p class="desc" id="desc">${descFor()}</p>`) + acts("Dalej");
        return logo("6cqw") + head("Obraz i dźwięk bez problemów", "Zainstalujemy potrzebne sterowniki i kodeki, aby filmy oraz gry działały od razu.") + body(lst("drv", DRV, S.drv)) + acts("Dalej");
      case "programy": {
        if (sub === 1) {
          const W = winApps();
          return logo("5cqw") + head("Twoje programy z Windows", "Znaleźliśmy je na Twoim komputerze. Wybierz, które zainstalować.") + body(tgl("win", W.map((p) => p.label), (j) => S.sel[W[j].key] !== false)) + acts("Dalej", "Pomiń");
        }
        if (sub === 2) {
          const P = props();
          return logo("5cqw") + head("Proponowane programy", "Wybierz, które zainstalować.") +
            body(P.length ? tgl("sel", P.map((p) => p.label), (j) => S.sel[P[j].key] !== false) : `<p class="desc">Nic nie wybrano.</p>`) + acts(P.length ? "Zainstaluj" : "", "Pomiń");
        }
        if (sub === 3) return logo("9cqw") + head("Instalowanie programów") + `<div class="pbar" role="progressbar"><i id="ab"></i></div><div class="cap"><b id="aph">Pobieranie</b><span id="aeta">Pozostało około 2 min</span></div>` + acts("Dalej", "", { hid: true });
        return logo("5cqw") + head("Jak używasz swojego komputera?", "Zainstalujemy najpotrzebniejsze programy.") + body(tgl("use", USES, (j) => S.use[j])) + acts("Dalej", "Pomiń");
      }
      case "gotowe": {
        const SL = slides(beside());
        if (sub >= 1) { const s = SL[sub - 1]; return logo("6cqw") + head(s.t, s.d) + `<p class="count">${sub} z ${SL.length}</p>` + acts(sub === SL.length ? "Zaczynajmy" : "Dalej"); }
        return logo("13cqw") + head("Wszystko gotowe", "Miłego korzystania z Shrimp.") + acts("Zaczynajmy", "Chcę wiedzieć więcej", { skipAct: "more" });
      }
    }
  }

  const bigStep = () => { const id = cur(); return id === "witaj" || id === "restart" || id === "czesc" || (id === "gotowe" && sub === 0); };
  function clearTimers() { clearInterval(T.hello); clearTimeout(T.boot); }
  function rise() { $$("#pane > *").forEach((el, i) => { el.style.setProperty("--i", String(i)); el.classList.add("rise"); }); }
  function render(anim: boolean) {
    pane.className = "pane" + (bigStep() ? " big" : "");
    pane.innerHTML = view();
    if (anim) rise();
    post();
  }
  function post() {
    const id = cur();
    if (id === "witaj") {
      let k = 0; const h = $("#hello")!;
      T.hello = window.setInterval(() => { h.classList.add("fade"); setTimeout(() => { k = (k + 1) % HELLO.length; h.textContent = HELLO[k]; h.classList.remove("fade"); }, 380); }, 2300);
    }
    if (id === "region") T.hello = window.setInterval(() => { const d = $("#desc"); if (d) d.textContent = descFor(); }, 15000);
    if (id === "instalacja") runInstall();
    if (id === "konto") syncAccount();
    if (id === "dysk" && sub === 0) updSplit();
    if (id === "dysk" && sub === 1) syncDisk();
    if (id === "programy" && sub === 3) runApps();
    if (id === "siec") syncNet();
    $$<HTMLElement>(".list.scroll", pane).forEach(centerSel);
  }
  function centerSel(box: HTMLElement) { const o = $<HTMLElement>(".opt.sel", box); if (o) box.scrollTop = o.offsetTop - box.clientHeight / 2 + o.offsetHeight / 2; }
  function syncDisk() { const b = $<HTMLButtonElement>(".btn", pane); if (b) b.disabled = S.enc === 1 && (!S.dp || !S.dp2); }
  function chrome() {
    const id = cur();
    const first = be.mode === "firstboot" ? FIRST_BOOT : 0;
    $("#back")!.hidden = step <= first || ["witaj", "instalacja", "restart", "czesc"].includes(id) || (id === "programy" && sub === 3);
    const nv = id === "sterowniki" && sub === 1;
    $("#infoBtn")!.hidden = !nv; $("#infoPop")!.hidden = !nv; $("#infoPop")!.classList.remove("show");
  }
  function go(n: number, s = 0, keep = false) {
    clearTimers(); closeErr(); boot = false;
    const lo = be.mode === "firstboot" ? FIRST_BOOT : 0, hi = be.mode === "install" ? FIRST_BOOT - 1 : STEPS.length - 1;
    const prev = step;
    step = Math.max(lo, Math.min(hi, n)); sub = s;
    // Internet po kablu: krok Sieć jest pomijany w obie strony.
    if (cur() === "siec" && INFO.wired && be.mode !== "install") step += n >= prev ? 1 : -1;
    if (cur() === "konto" && !keep) S.confirm = false;
    chrome(); applyLook(); render(true);
  }

  // --- instalowanie ---
  function plan(): InstallPlan {
    return {
      locale: LANGS[S.lang].locale, timezone: REGS[S.region].tz, keymap: KBS[S.kb].keymap,
      disk: disk(), place: place(), windowsGB: beside() ? S.win : undefined,
      diskPassword: S.enc === 1 ? S.dp : undefined,
      fullName: S.full.trim(), userName: S.user, password: S.pass,
    };
  }
  function setBar(bar: string, ph: string, eta: string, p: { percent: number; phase: string; etaMin?: number }) {
    const b = $(bar); if (b) b.style.width = p.percent + "%";
    const f = $(ph); if (f) f.textContent = p.phase;
    const e = $(eta); if (e) e.textContent = p.percent >= 100 ? "" : !p.etaMin ? "" : p.etaMin <= 1 ? "Za chwilę" : `Pozostało około ${p.etaMin} min`;
  }
  async function runInstall() {
    const my = step;
    try {
      await be.install.install(plan(), (p) => { if (step === my) setBar("#ib", "#ph", "#eta", p); });
      if (step === my) showActs();
    } catch (e) {
      if (step === my) openErr(e instanceof InstallError ? e.key : "install");
    }
  }
  async function runApps() {
    const my = step, mySub = sub;
    const ids = [...winApps(), ...props()].filter((p) => S.sel[p.key] !== false).map((p) => p.id);
    const uniq = [...new Set(ids)];
    try {
      if (!S.online) throw new OfflineError();
      await be.firstboot.installApps(uniq, (p) => { if (step === my && sub === mySub) setBar("#ab", "#aph", "#aeta", p); });
      if (step === my && sub === mySub) showActs();
    } catch {
      if (step === my && sub === mySub) openErr("net");
    }
  }
  function showActs() { const a = $(".acts", pane)!; a.hidden = false; a.classList.remove("rise"); void a.offsetWidth; a.style.setProperty("--i", "0"); a.classList.add("rise"); }
  function restart() {
    clearTimers(); boot = true; applyLook(); $("#back")!.hidden = true; $("#infoBtn")!.hidden = true; $("#infoPop")!.hidden = true;
    pane.className = "pane";
    pane.innerHTML = logo("14cqw") + '<div class="pbar run"><i></i></div>'; rise();
    if (be.mode === "install") { be.install.reboot().catch(() => openErr("install")); return; }
    // Podgląd: czarny ekran startu (Plymouth), potem część 2.
    T.boot = window.setTimeout(() => go(FIRST_BOOT), 3600);
  }

  // --- formularze ---
  function syncAccount() { const b = $<HTMLButtonElement>(".btn", pane); if (b) b.disabled = !S.full.trim() || !S.user || !S.pass || (S.confirm && !S.pass2); }
  function syncNet() {
    const b = $<HTMLButtonElement>(".btn", pane); if (!b) return;
    if (sub === 0) b.disabled = !NETS[S.net] || (NETS[S.net].secure && !S.netPass);
    if (sub === 1) b.disabled = !S.ssid.trim() || (S.hsec > 0 && !S.hpass);
  }
  function updSplit() {
    const r = $<HTMLInputElement>("#rng"); if (!r) return;
    const t = pool(), w = Math.max(winMin(), Math.min(t - 20, +r.value)); r.value = String(w); S.win = w;
    r.style.setProperty("--v", String(w / t));
    $("#wGB")!.textContent = w + " GB"; $("#sGB")!.textContent = t - w + " GB";
  }
  pane.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement, id = t.id;
    if (id === "rng") { updSplit(); return; }
    if (id === "inFull") { S.full = t.value; if (!S.userEdited) { S.user = slug(firstName(S.full, "")); $<HTMLInputElement>("#inUser")!.value = S.user; } syncAccount(); }
    else if (id === "inUser") { S.user = t.value = slug(t.value); S.userEdited = true; syncAccount(); }
    else if (id === "inPass") { S.pass = t.value; syncAccount(); }
    else if (id === "inPass2") { S.pass2 = t.value; syncAccount(); }
    else if (id === "inDp") { S.dp = t.value; syncDisk(); }
    else if (id === "inDp2") { S.dp2 = t.value; syncDisk(); }
    else if (id === "inNet") { S.netPass = t.value; syncNet(); }
    else if (id === "inSsid") { S.ssid = t.value; syncNet(); }
    else if (id === "inHPass") { S.hpass = t.value; syncNet(); }
  });

  // --- wybór ---
  const SINGLE: Record<string, 1> = { lang: 1, region: 1, kb: 1, place: 1, disk: 1, enc: 1, net: 1, hsec: 1, ip: 1, dns: 1, proxy: 1, drv: 1, nv: 1, theme: 1 };
  const RELAYOUT: Record<string, 1> = { place: 1, net: 1, hsec: 1, disk: 1, enc: 1 };
  function pick(l: string, i: number) {
    if (l === "theme") { S.theme = i === 1 ? "dark" : "light"; applyLook(); } else (S as unknown as Record<string, number>)[l] = i;
    if (l === "disk") defaultSplit();
    if (l === "kb") be.install.setKeymap(KBS[i].keymap).catch(() => {});
    if (RELAYOUT[l]) { render(false); return; }
    const box = $<HTMLElement>(`.list[data-l="${l}"]`, pane)!;
    $$(".opt", box).forEach((o, k) => { o.classList.toggle("sel", k === i); o.setAttribute("aria-checked", String(k === i)); });
    if (box.classList.contains("scroll")) {
      const so = $<HTMLElement>(".opt.sel", box)!, top = so.offsetTop, bot = top + so.offsetHeight;
      if (top < box.scrollTop + box.clientHeight * 0.25 || bot > box.scrollTop + box.clientHeight * 0.75) box.scrollTo({ top: top - box.clientHeight / 2 + so.offsetHeight / 2, behavior: "smooth" });
    }
    const d = $("#desc"); if (d) d.textContent = descFor();
  }
  function toggle(l: string, i: number) {
    const o = $(`.list[data-l="${l}"] .opt[data-t="${i}"]`, pane)!;
    let on: boolean;
    if (l === "sel" || l === "win") { const P = l === "win" ? winApps() : props(); S.sel[P[i].key] = S.sel[P[i].key] === false; on = S.sel[P[i].key] !== false; }
    else { S.use[i] = !S.use[i]; on = S.use[i]; }
    o.classList.toggle("on", on); o.setAttribute("aria-checked", String(on));
  }
  pane.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const o = t.closest(".opt");
    if (o) { const l = o.closest(".list")!.getAttribute("data-l")!; if (o.hasAttribute("data-t")) toggle(l, +o.getAttribute("data-t")!); else pick(l, +o.getAttribute("data-i")!); return; }
    const sw = t.closest(".sw");
    if (sw) {
      S.accent = +sw.getAttribute("data-c")!; applyAccent();
      $$(".sw", pane).forEach((b) => b.setAttribute("aria-checked", String(b === sw)));
      $("#accn")!.textContent = ACCENTS[S.accent][0]; return;
    }
    const a = t.closest("[data-act]"); if (a) act(a.getAttribute("data-act")!);
  });

  function defaultSplit() {
    const d = disk(); if (!d?.windows) return;
    // Domyślnie połowa wolnego ponad minimum Windows, ale Shrimp co najmniej SHRIMP_MIN_GB.
    const w = Math.round(Math.max(d.windows.minGB, Math.min(d.windows.poolGB - SHRIMP_MIN_GB, d.windows.minGB + (d.windows.poolGB - d.windows.minGB) / 2)));
    S.win = w;
  }

  // --- przejścia ---
  async function guarded(fn: () => Promise<void>) {
    if (busy) return; busy = true;
    const b = $<HTMLButtonElement>(".btn", pane); if (b) b.disabled = true;
    try { await fn(); } finally { busy = false; const b2 = $<HTMLButtonElement>(".btn", pane); if (b2 && b2 === b) b2.disabled = false; }
  }
  function act(a: string) {
    const id = cur();
    if (a === "adv" || a === "hid") return go(step, 1);
    if (a === "nadv") return go(step, 2);
    if (a === "done" && id === "dysk" && S.enc === 1 && S.dp !== S.dp2) return openErr("dpass");
    if (a === "done" && id === "siec") {
      return guarded(async () => {
        await be.firstboot.setNetworkAdvanced({ ip: S.ip ? "manual" : "auto", dns: (["auto", "cloudflare", "google"] as const)[S.dns], proxy: S.proxy ? "auto" : "none" }).catch(() => {});
        go(step, 0);
      });
    }
    if (a === "done" || a === "cancel") return go(step, 0);
    if (a === "more") return go(step, 1);
    if (a === "skip") {
      if (id === "siec") S.online = false;
      if (id === "programy" && sub === 1) return go(step, 2);
      if (id === "programy" && sub === 0) return go(step + 1);
      return go(step + 1);
    }
    if (a === "hconnect") {
      return guarded(async () => {
        try { await be.firstboot.connectHidden(S.ssid.trim(), (["none", "wpa2", "wpa3"] as const)[S.hsec], S.hsec ? S.hpass : undefined); S.online = true; go(step + 1); }
        catch { openErr("wifi"); }
      });
    }
    // „next”
    if (id === "jezyk") {
      const l = LANGS[S.lang];
      be.install.setLanguage(l.locale).catch(() => {});
      const lc = l.locale.split(".")[0];
      const tz = REGS.findIndex((r) => r.tz === DEFAULT_TZ[lc]); if (tz >= 0) S.region = tz;
      const kb = KBS.findIndex((k) => k.keymap === (DEFAULT_KB[lc] || "us")); if (kb >= 0) S.kb = kb;
    }
    if (id === "konto") {
      if (!S.confirm) { S.confirm = true; const f2 = $("#f2")!; f2.hidden = false; f2.classList.add("rise"); $<HTMLInputElement>("#inPass2")!.focus(); syncAccount(); return; }
      if (S.pass !== S.pass2) return openErr("pass");
      return go(step + 1);
    }
    if (id === "dysk" && sub === 0 && beside() && pool() - S.win < SHRIMP_MIN_GB) return openErr("space");
    if (id === "podsumowanie") {
      return guarded(async () => {
        try { await be.install.check(plan()); go(step + 1); }
        catch (e) { openErr(e instanceof InstallError ? e.key : "install"); }
      });
    }
    if (id === "siec" && sub === 0) {
      const n = NETS[S.net]; if (!n) return go(step + 1);
      return guarded(async () => {
        try { await be.firstboot.connect(n.ssid, n.secure ? S.netPass : undefined); S.online = true; go(step + 1); }
        catch { openErr("wifi"); }
      });
    }
    if (id === "wyglad") {
      be.firstboot.setAppearance(S.theme === "dark" ? "prefer-dark" : "default", S.accent === null ? null : ACCENTS[S.accent][1]).catch(() => {});
      if (sub === 0) return go(step, 1);
    }
    if (id === "sterowniki") {
      if (sub === 0 && S.drv === 0 && hasNvidia()) return go(step, 1);
      be.firstboot.setDrivers({ install: S.drv === 0, nvidia: S.drv === 0 && hasNvidia() ? (S.nv === 0 ? "nvidia" : "open") : undefined }).catch(() => {});
    }
    if (id === "programy") {
      if (sub === 0) return go(step, winApps().length ? 1 : 2);
      if (sub === 1) return go(step, 2);
      if (sub === 2) {
        const any = [...winApps(), ...props()].some((p) => S.sel[p.key] !== false);
        return any ? go(step, 3) : go(step + 1);
      }
    }
    if (id === "restart") return restart();
    if (id === "gotowe") {
      const n = slides(beside()).length;
      if (sub === 0 || sub === n) return finish();
      return go(step, sub + 1);
    }
    go(step + 1);
  }
  function finish() {
    if (be.mode === "demo") { S.theme = "light"; S.accent = null; S.confirm = false; applyAccent(); go(0); return; }
    guarded(() => be.firstboot.finish());
  }
  $("#back")!.addEventListener("click", () => {
    const id = cur();
    if (sub > 0) {
      if (id === "programy" && sub === 2 && !winApps().length) return go(step, 0, true);
      return go(step, sub - 1, true);
    }
    // Wstecz na krok z podkrokami wraca do jego ostatniego podkroku, tak jak w makiecie wraca do początku kroku.
    go(step - 1);
  });
  $("#infoBtn")!.addEventListener("click", () => $("#infoPop")!.classList.toggle("show"));

  // --- okna błędów ---
  function openErr(k: ErrKey) {
    const e = ERR[k]; S.err = k;
    $("#dT")!.textContent = e.t;
    $("#dD")!.textContent = k === "wifi" && sub === 0 && NETS[S.net] ? `Sprawdź hasło sieci ${NETS[S.net].ssid} i spróbuj ponownie.` : e.d;
    $("#dP")!.textContent = e.p; $("#dS")!.textContent = e.s; $("#dS")!.hidden = !e.s;
    modal.hidden = false; $("#dP")!.focus();
  }
  function closeErr() { modal.hidden = true; S.err = null; }
  $("#dP")!.addEventListener("click", () => {
    const k = S.err; closeErr();
    if (k === "pass") { S.pass2 = ""; render(false); $<HTMLInputElement>("#inPass2")!.focus(); }
    else if (k === "dpass") { S.dp2 = ""; render(false); $<HTMLInputElement>("#inDp2")!.focus(); syncDisk(); }
    else if (k === "space") {
      if (cur() !== "dysk") return go(idx("dysk"));
      const r = $<HTMLInputElement>("#rng"); if (r) { defaultSplit(); r.value = String(S.win); updSplit(); r.focus(); }
    }
    else if (k === "install") go(step);
    else if (k === "wifi") { if (sub === 0) S.netPass = ""; else S.hpass = ""; render(false); $<HTMLInputElement>(sub === 0 ? "#inNet" : "#inHPass")?.focus(); }
    else if (k === "net") { S.online = true; go(step, 3); }
  });
  $("#dS")!.addEventListener("click", () => {
    const k = S.err; closeErr();
    if (k === "install") go(0);
    else if (k === "space") go(idx("dysk"));
    else if (k === "wifi") { S.online = false; go(step + 1); }
    else if (k === "net") go(step + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!modal.hidden) { closeErr(); return; } $("#infoPop")!.classList.remove("show"); }
    if (boot || !modal.hidden) return;
    const box = $(".list[data-l]", pane), l = box && box.getAttribute("data-l");
    const target = e.target as HTMLElement;
    if (l && SINGLE[l] && (e.key === "ArrowDown" || e.key === "ArrowUp") && !target.closest("input")) {
      e.preventDefault();
      const opts = $$(".opt", box!), c = opts.findIndex((o) => o.classList.contains("sel"));
      pick(l, (c + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length);
    } else if (e.key === "Enter" && !target.closest("button")) {
      const p = $<HTMLButtonElement>(".btn:not([disabled])", pane); if (p && !p.closest("[hidden]")) { e.preventDefault(); p.click(); }
    }
  });

  // --- start ---
  (async () => {
    const q = new URLSearchParams(location.search);
    if (be.mode !== "firstboot") {
      [LANGS, REGS, KBS, DISKS] = await Promise.all([be.install.languages(), be.install.regions(), be.install.keyboards(), be.install.disks()]);
      S.disk = Math.max(0, DISKS.findIndex((d) => d.windows));
      defaultSplit();
      const pl = LANGS.findIndex((l) => l.locale.startsWith("pl_")); if (pl >= 0) S.lang = pl;
      const plk = KBS.findIndex((k) => k.keymap === "pl"); if (plk >= 0) S.kb = plk;
    }
    if (be.mode !== "install") {
      [INFO, NETS] = await Promise.all([be.firstboot.info(), be.firstboot.networks().catch(() => [])]);
      S.online = INFO.wired || S.online;
      if (be.mode === "demo") { S.full = "Anna Kowalska"; S.user = "anna"; S.pass = S.pass2 = "shrimp2024"; S.netPass = "dom12345"; }
    }
    const h = parseInt(q.get("step") || location.hash.slice(1), 10);
    const s = parseInt(q.get("sub") || "0", 10);
    go(isNaN(h) ? (be.mode === "firstboot" ? FIRST_BOOT : 0) : h, s);
    if (q.get("err")) openErr(q.get("err") as ErrKey);
  })();
}
