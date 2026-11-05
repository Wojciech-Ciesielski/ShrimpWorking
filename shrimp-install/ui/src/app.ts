// Shrimp Install: ekrany z makiety (mockups/shrimp-install.html) sterowane przez Backend.
import type { Backend, Device, Failure, Folder, FolderKey, Info, Picked, Progress } from "./backend/types";
import { deviceLabel, dur, fmtSize, phaseFrac, phaseText, remaining, space } from "./logic";

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const FOLDER_UI: Record<FolderKey, [string, string]> = {
  documents: ["Dokumenty", "#f-document"],
  pictures: ["Zdjęcia", "#f-image"],
  desktop: ["Pulpit", "#f-desktop"],
  music: ["Muzyka", "#f-music_note_1"],
  videos: ["Filmy", "#f-video"],
  downloads: ["Pobrane", "#f-arrow_download"],
};

const FAIL: Record<Failure["kind"], [string, string]> = {
  offline: ["Brak połączenia z internetem", "<b>Nie udało się pobrać Shrimp.</b> Sprawdź połączenie z internetem i spróbuj ponownie."],
  verify: ["Pobrany obraz jest uszkodzony", "<b>Pobrany obraz nie przeszedł weryfikacji.</b> Spróbuj ponownie."],
  space: ["Za mało miejsca na dysku", "<b>Za mało miejsca na dysku.</b> Zwolnij miejsce i spróbuj ponownie."],
  write: ["Nie udało się zapisać nośnika", "<b>Nie udało się zapisać nośnika.</b> Podłącz go ponownie albo wybierz inny."],
  device: ["Nośnik został odłączony", "<b>Nośnik został odłączony.</b> Podłącz go ponownie i spróbuj jeszcze raz."],
  copy: ["Nie udało się skopiować plików", "<b>Nie udało się skopiować plików.</b>"],
  other: ["Coś poszło nie tak", "<b>Coś poszło nie tak.</b>"],
};

export type Route =
  | "start" | "nosnik" | "nosnik-lista" | "nosnik-info" | "brak-nosnika" | "za-maly"
  | "pliki" | "pliki-reczny" | "postep" | "brak-internetu" | "gotowe";

export class App {
  private info!: Info;
  private devices: Device[] = [];
  private sel: number | null = null;
  private folders: (Folder & { on: boolean })[] = [];
  private touched = false;
  private mode: "auto" | "manual" = "auto";
  private picked: Picked[] = [];
  private cur: Progress | null = null;
  private finished = false;
  private failed: Failure | null = null;
  private running = false;
  private closeAfterCancel = false;
  private screen = "start";

  constructor(private be: Backend, private preview = false) {}

  async init(first: Route = "start") {
    this.info = await this.be.info();
    this.folders = this.info.folders.map((f) => ({ ...f, on: false }));
    this.defaults();
    $("#bitlocker").hidden = !this.info.bitlocker;
    this.be.onDevices((d) => { this.devices = d; this.pickDevice(); this.drawCb(); });
    this.be.onFolders((f) => {
      this.folders = f.map((x) => ({ ...x, on: this.folders.find((o) => o.key === x.key)?.on ?? false }));
      if (!this.touched) this.defaults();
      if (this.screen === "pliki") this.drawFolders();
    });
    this.be.onBitLocker((on) => { $("#bitlocker").hidden = !on; });
    this.be.onCloseRequest(() => { if (this.running) { this.closeAfterCancel = true; this.openDlg(); } });
    this.wire();
    this.go(first);
  }

  // ---------- nośnik ----------
  private fits = (d: Device) => d.size >= this.info.minSize;
  private pickDevice() {
    if (this.sel !== null && this.devices.some((d) => d.id === this.sel && this.fits(d))) return;
    this.sel = this.devices.find(this.fits)?.id ?? null;
  }
  private get device() { return this.devices.find((d) => d.id === this.sel) || null; }

  private drawCb() {
    const cb = $<HTMLButtonElement>("#cb"), val = $("#cbVal"), note = $("#cbNote"), pop = $("#cbPop");
    const d = this.device, any = this.devices.length > 0;
    cb.disabled = !any;
    val.className = "cbv";
    note.textContent = "";
    if (d) val.textContent = deviceLabel(d);
    else if (any) {
      val.textContent = "Wybierz nośnik"; val.className = "cbv ph";
      note.textContent = "Ten nośnik jest za mały. Potrzeba co najmniej 16 GB.";
    } else {
      val.textContent = "Nie znaleziono nośnika"; val.className = "cbv ph";
      note.textContent = "Podłącz nośnik, a pojawi się tutaj.";
    }
    $("#cbScan").hidden = any;
    $<HTMLButtonElement>("#toFiles").disabled = !d;
    pop.innerHTML = this.devices.map((x) => {
      const dis = !this.fits(x);
      return `<button class="opt" type="button" role="option" data-id="${x.id}" aria-selected="${x.id === this.sel}"${dis ? ' aria-disabled="true"' : ""}>` +
        `<span class="n">${esc(x.name)} <span class="sz">· ${esc(deviceLabel(x).split(" · ").pop()!)}</span></span>` +
        (dis ? '<span class="d">Za mały</span>' : "") + "</button>";
    }).join("");
    if (!pop.hidden && !any) this.closePop(false);
    if (this.screen === "pliki") this.drawSpace();
  }
  private placePop() {
    const pop = $("#cbPop"), host = $(".win").getBoundingClientRect(), r = $("#cb").getBoundingClientRect();
    pop.style.width = r.width + "px";
    pop.style.left = r.left - host.left + "px";
    const h = pop.offsetHeight, below = host.bottom - r.bottom - 8;
    pop.style.top = (below >= h || r.top - host.top < h ? r.bottom - host.top + 4 : r.top - host.top - h - 4) + "px";
  }
  private openPop() {
    const cb = $<HTMLButtonElement>("#cb"), pop = $("#cbPop");
    if (cb.disabled || !this.devices.length) return;
    pop.hidden = false; cb.setAttribute("aria-expanded", "true"); this.placePop();
    ($('.opt[aria-selected="true"]', pop) || $(".opt:not([aria-disabled])", pop))?.focus();
  }
  private closePop(back: boolean) {
    $("#cbPop").hidden = true; $("#cb").setAttribute("aria-expanded", "false");
    if (back) $("#cb").focus();
  }

  // ---------- pliki ----------
  private freeForFiles() { return (this.device?.size ?? 0) - this.info.shrimpSize; }
  /** Domyślnie zaznaczone foldery, które się mieszczą (w kolejności). */
  private defaults() {
    let left = this.freeForFiles();
    if (!this.device) left = 28.7 * 1024 ** 3 - this.info.shrimpSize;
    for (const f of this.folders) {
      f.on = f.size !== null && f.size <= left;
      if (f.on) left -= f.size!;
    }
  }
  private used() {
    return this.mode === "auto"
      ? this.folders.reduce((a, f) => a + (f.on ? f.size || 0 : 0), 0)
      : this.picked.reduce((a, p) => a + p.size, 0);
  }
  private drawSpace() {
    const cap = this.device?.size ?? 0;
    const s = space(cap || 1, this.info.shrimpSize, this.used());
    $("#spShr").style.width = s.shrPct + "%";
    $("#spFiles").style.width = s.filesPct + "%";
    $("#spTxt").textContent = s.text;
    const counting = this.mode === "auto" && this.folders.some((f) => f.on && f.size === null);
    $<HTMLButtonElement>("#goBtn").disabled = !this.device || s.over || counting || (this.mode === "manual" && !this.picked.length);
  }
  private drawFolders() {
    const u = this.used(), free = this.freeForFiles();
    $("#folders").innerHTML = this.folders.map((f, i) => {
      const [name, ic] = FOLDER_UI[f.key];
      const blocked = !f.on && f.size !== null && u + f.size > free;
      const sz = f.size === null ? "Liczenie…" : blocked ? "Brak miejsca" : fmtSize(f.size);
      return `<button class="fol" type="button" role="switch" aria-checked="${f.on}" aria-label="Zachowaj: ${name}" data-i="${i}"${blocked || f.size === null ? " disabled" : ""}>` +
        `<svg class="i ck"><use href="${f.on ? "#f-checkmark_circle-filled" : "#f-circle"}"/></svg><span class="fi"><svg class="i"><use href="${ic}"/></svg></span>` +
        `<span class="fn">${name}</span><span class="fs">${sz}</span></button>`;
    }).join("");
    this.drawSpace();
  }
  private drawPicked() {
    $("#picked").innerHTML = this.picked.length
      ? this.picked.map((x, i) =>
        `<div class="row"><svg class="i lg"><use href="${x.kind === "folder" ? "#f-folder" : "#f-document"}"/></svg><div class="tx"><div class="tt">${esc(x.name)}</div></div>` +
        `<span class="sz2">${fmtSize(x.size)}</span><button class="link" type="button" data-rm="${i}" aria-label="Usuń: ${esc(x.name)}">Usuń</button></div>`).join("")
      : '<p class="empty">Nic jeszcze nie wybrano.</p>';
    this.drawSpace();
  }
  private setMode(m: "auto" | "manual", animate: boolean) {
    this.mode = m;
    $$(".mode").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === m)));
    $("#paneAuto").hidden = m !== "auto";
    $("#paneManual").hidden = m !== "manual";
    this.drawFolders(); this.drawPicked();
    if (animate) rise(m === "auto" ? $$(".fol") : $$("#paneManual .adds .btn, #picked .row, #picked .empty"));
  }
  private async add(kind: "folder" | "file") {
    const got = await this.be.pick(kind);
    const fresh = got.filter((g) => !this.picked.some((p) => p.path.toLowerCase() === g.path.toLowerCase()));
    if (!fresh.length) return;
    this.picked.push(...fresh);
    this.drawPicked();
    rise($$("#picked .row").slice(-fresh.length));
  }

  // ---------- postęp ----------
  private sizes() { return { shrimp: this.info.shrimpSize, files: this.used() }; }
  private drawRun() {
    const STI = { wait: "#f-circle", active: "#f-circle", done: "#f-checkmark_circle-filled", fail: "#f-error_circle" };
    const at = this.finished ? 4 : this.cur?.phase ?? 1;
    for (const n of [1, 2, 3] as const) {
      const el = $("#ph" + n);
      const st = this.failed?.phase === n ? "fail" : n < at ? "done" : n === at ? "active" : "wait";
      el.className = "row phase " + st;
      $(".st", el).innerHTML = `<svg class="i lg"><use href="${STI[st]}"/></svg>`;
      $("#b" + n).style.width = phaseFrac(n, this.cur, this.finished) * 100 + "%";
      $<HTMLElement>(".pb-wrap", el).style.display = st === "fail" ? "none" : "";
      $("#n" + n).textContent = st === "fail" ? FAIL[this.failed!.kind][0] : phaseText(n, this.cur, this.sizes(), this.finished);
    }
    const err = !!this.failed;
    $("#pgErr").hidden = !err; $("#pgInfo").hidden = err || this.finished;
    $("#retryBtn").hidden = !err; $("#nextBtn").hidden = err;
    $<HTMLButtonElement>("#nextBtn").disabled = !this.finished;
    $("#cancelBtn").hidden = this.finished;
    if (err) {
      const [, txt] = FAIL[this.failed!.kind];
      $("#pgErrTxt").innerHTML = txt + (this.failed!.message ? " " + esc(this.failed!.message) : "");
      $("#pgTitle").textContent = "Przygotowanie Shrimp";
      $("#pgSub").textContent = "Przygotowanie zostało wstrzymane.";
    } else if (this.finished) {
      $("#pgTitle").textContent = "Przygotowanie zakończone";
      $("#pgSub").textContent = "Wszystko zostało przygotowane.";
    } else {
      $("#pgTitle").textContent = "Przygotowanie Shrimp";
      const left = this.cur ? remaining(this.cur, this.sizes()) : remaining({ phase: 1, done: 0, total: this.info.shrimpSize, speed: 0 }, this.sizes());
      $("#pgSub").textContent = `Potrwa to jeszcze ${dur(left)}.`;
    }
  }
  private startRun() {
    this.cur = null; this.finished = false; this.failed = null; this.running = true;
    this.drawRun();
    const d = this.device!;
    this.be.start(
      { device: d.id, folders: this.mode === "auto" ? this.folders.filter((f) => f.on).map((f) => f.key) : [], paths: this.mode === "manual" ? this.picked.map((p) => p.path) : [] },
      {
        progress: (p) => { if (!this.running) return; this.cur = p; this.drawRun(); },
        fail: (f) => { this.running = false; this.failed = f; this.drawRun(); },
        done: () => { this.running = false; this.finished = true; this.drawRun(); if (!this.preview) this.go("gotowe"); },
      },
    );
  }

  // ---------- dialog ----------
  private openDlg() { $("#scrim").hidden = false; $("#dlgNo").focus(); }
  private closeDlg() { $("#scrim").hidden = true; $("#cancelBtn")?.focus(); this.closeAfterCancel = false; }

  // ---------- nawigacja ----------
  go(r: Route) {
    const ROUTES: Record<Route, [string, string?, string?]> = {
      start: ["start"], nosnik: ["nosnik"], "nosnik-lista": ["nosnik", "", "list"], "nosnik-info": ["nosnik", "", "tip"],
      "brak-nosnika": ["nosnik"], "za-maly": ["nosnik"],
      pliki: ["pliki", "auto"], "pliki-reczny": ["pliki", "manual"], postep: ["postep"], "brak-internetu": ["postep"], gotowe: ["gotowe"],
    };
    const [scr, variant, flag] = ROUTES[r] || ROUTES.start;
    this.screen = scr;
    $$<HTMLElement>(".screen").forEach((s) => (s.hidden = s.dataset.screen !== scr));
    const s = $(`.screen[data-screen="${scr}"]`);
    this.closePop(false);
    $("#hint").classList.toggle("show", flag === "tip");
    const lg = s.querySelector(".sh");
    if (lg) playIntro(lg as SVGElement);
    if (scr === "nosnik") {
      this.drawCb();
      if (flag === "list") requestAnimationFrame(() => { this.openPop(); $("#cb").focus(); });
    }
    if (scr === "pliki") this.setMode((variant as "auto" | "manual") || this.mode, false);
    if (scr === "postep" && !this.running && !this.finished && !this.failed) this.startRun();
    else if (scr === "postep") this.drawRun();
    $("#scrim").hidden = true;
    const scrEl = $(".scr", s);
    if (scrEl) scrEl.scrollTop = 0;
    riseScreen(s);
  }

  private wire() {
    document.addEventListener("click", (e) => {
      const g = (e.target as Element).closest<HTMLButtonElement>("[data-go]");
      if (g && !g.disabled) { e.preventDefault(); this.go(g.dataset.go as Route); }
    });
    // pasek tytułu: przeciąganie i przyciski okna
    $(".titlebar").addEventListener("mousedown", (e) => { if (e.button === 0 && !(e.target as Element).closest(".caps")) this.be.drag(); });
    $("#minBtn").addEventListener("click", () => this.be.minimize());
    $("#closeBtn").addEventListener("click", () => {
      if (this.running) { this.closeAfterCancel = true; this.openDlg(); } else this.be.close();
    });
    // nośnik
    const cb = $("#cb"), pop = $("#cbPop");
    cb.addEventListener("click", () => (pop.hidden ? this.openPop() : this.closePop(true)));
    cb.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); this.openPop(); } });
    pop.addEventListener("click", (e) => {
      const o = (e.target as Element).closest<HTMLElement>(".opt");
      if (!o || o.getAttribute("aria-disabled")) return;
      this.sel = +o.dataset.id!;
      if (!this.touched) this.defaults();
      this.drawCb(); this.closePop(true);
    });
    pop.addEventListener("keydown", (e) => {
      const opts = $$(".opt:not([aria-disabled])", pop), i = opts.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
      else if (e.key === "Escape") { e.preventDefault(); this.closePop(true); }
      else if (e.key === "Tab") this.closePop(false);
    });
    document.addEventListener("mousedown", (e) => {
      const t = e.target as Element;
      if (!pop.hidden && !t.closest("#cbPop") && !t.closest("#cb")) this.closePop(false);
    });
    // pliki
    $$(".mode").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-checked") !== "true") this.setMode(b.dataset.mode as "auto" | "manual", true);
    }));
    $("#folders").addEventListener("click", (e) => {
      const t = (e.target as Element).closest<HTMLButtonElement>(".fol");
      if (!t || t.disabled) return;
      const f = this.folders[+t.dataset.i!];
      f.on = !f.on; this.touched = true;
      this.drawFolders();
      $<HTMLButtonElement>(`.fol[data-i="${t.dataset.i}"]`)?.focus();
    });
    $("#addFolder").addEventListener("click", () => this.add("folder"));
    $("#addFile").addEventListener("click", () => this.add("file"));
    $("#picked").addEventListener("click", (e) => {
      const r = (e.target as Element).closest<HTMLElement>("[data-rm]");
      if (!r) return;
      this.picked.splice(+r.dataset.rm!, 1); this.drawPicked();
    });
    // postęp
    $("#cancelBtn").addEventListener("click", () => this.openDlg());
    $("#dlgNo").addEventListener("click", () => this.closeDlg());
    $("#dlgYes").addEventListener("click", async () => {
      const close = this.closeAfterCancel;
      $<HTMLButtonElement>("#dlgYes").disabled = true;
      this.running = false;
      await this.be.cancel();
      $<HTMLButtonElement>("#dlgYes").disabled = false;
      this.cur = null; this.failed = null; this.finished = false;
      if (close) this.be.close(); else this.go("nosnik");
    });
    $("#retryBtn").addEventListener("click", () => { this.failed = null; this.startRun(); riseScreen($('.screen[data-screen="postep"]')); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#scrim").hidden) this.closeDlg(); });
    // gotowe
    $("#laterBtn").addEventListener("click", () => this.be.later());
    $("#rebootBtn").addEventListener("click", async () => {
      const b = $<HTMLButtonElement>("#rebootBtn");
      b.disabled = true;
      try {
        await this.be.reboot();
      } catch (e) {
        $("#doneInfo").hidden = true;
        $("#rebootErr").hidden = false;
        $("#rebootErrTxt").innerHTML = `<b>Nie udało się ustawić startu z nośnika.</b> ${esc((e as Error).message)}`;
        b.disabled = false;
      }
    });
    // logo: mrugnięcie po kliknięciu
    $$<SVGElement & HTMLElement>(".sh").forEach((lg) => {
      lg.addEventListener("click", () => { lg.classList.remove("go"); void lg.getBoundingClientRect(); lg.classList.add("go"); });
      $(".lid", lg)?.addEventListener("animationend", (e) => { if ((e as AnimationEvent).animationName === "sh-wink-once") lg.classList.remove("go"); });
    });
  }

  /** Podgląd: stan ręcznego wyboru z makiety. */
  presetPicked(p: Picked[]) { this.picked = p.slice(); }
}

function playIntro(lg: SVGElement) {
  lg.classList.remove("play", "go");
  void lg.getBoundingClientRect();
  lg.classList.add("play");
}

/** Wejście elementów ekranu: unoszą się i powiększają kolejno co 70 ms. */
function rise(els: HTMLElement[]) {
  els.forEach((el, i) => {
    el.classList.remove("rise"); el.style.setProperty("--i", String(i));
    void el.offsetWidth; el.classList.add("rise");
  });
}
function riseScreen(s: HTMLElement) {
  const els = s.querySelector(".start-scr")
    ? $$("h1, .sub, .feat > div, .cmd > *", s)
    : $$(".scr > *, .cmd > *", s).filter((el) => !el.hidden);
  rise(els);
}
