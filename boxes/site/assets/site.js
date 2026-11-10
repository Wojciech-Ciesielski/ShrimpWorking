// Strona Shrimp: język (pl/en), odsłanianie przy przewijaniu i odpowiedź przycisku pobierania.
// Bez bibliotek. Strona działa też bez JS (wtedy po polsku i bez animacji przewijania).
// Teksty: krótkie wspólne napisy mają klucz data-t (słownik T poniżej); tytuł i opis strony mają
// wersję angielską w atrybucie data-en; dłuższe treści (strony pomocy) mają oba języki w HTML
// w blokach data-l="pl" / data-l="en", które przełącza sam CSS według <html lang>.
(() => {
  const T = {
    en: {
      "nav.help": "Help", "nav.up": "Back to top", "skip": "Skip to content",
      "hero.lead": "Linux that works from the very first start.",
      "hero.more": "How it works",
      "dl.label": "Download Shrimp Install", "dl.going": "Downloading…",
      "dl.os": "Windows 10 and 11", "dl.ver": "Shrimp Beta 3.1",
      "w.t": "Turn it on. It works.",
      "w.s": "A calm system that looks after itself.",
      "p1.t": "Ready right away", "p1.d": "No setup marathon, no hunting for guides.",
      "p2.t": "Your things come along", "p2.d": "Files and settings from Windows move over by themselves.",
      "p3.t": "Picture and sound without trouble", "p3.d": "Movies, music and games work from day one.",
      "p4.t": "Everything can be undone", "p4.d": "Something went wrong? Go back to when it worked.",
      "p5.t": "Updates that don't interrupt", "p5.d": "They install when you restart, not in the middle of your work.",
      "p6.t": "One calm look", "p6.d": "Every screen looks like it was made by one hand.",
      "lap.k": "See how it looks",
      "tab.0": "Desktop", "tab.1": "Installer", "tab.2": "Apps", "tabs.aria": "Screens",
      "md.files": "Files",
      "mi.step": "Step 2 of 3", "mi.t": "Choose a drive", "mi.a": "USB stick", "mi.b": "SD card", "mi.c": "External drive", "mi.next": "Next",
      "ma.t": "Discover", "ma.i": "Installed", "ma.q": "Search apps", "ma.get": "Get",
      "iso.aria": "Download the ISO image", "menu.aria": "Menu", "menu.iso": "ISO image", "alt.mb": "Mont Blanc",
      "iso.title": "The ISO image is coming soon.",
      "iso.lead": "For most people Shrimp Install is the easiest way: it downloads and verifies the system for you. The ISO image will appear here when public downloads open.",
      "iso.cta": "Get Shrimp Install",
      "end.title": "It all starts with one file.",
      "back": "Back to the home page",
      "wait.title": "Shrimp Install is almost here.",
      "wait.lead": "Shrimp Beta 3.1 is in closed testing. The download will start from this address as soon as it opens.",
      "nf.title": "Nothing here.",
      "nf.lead": "This address doesn't lead anywhere. The home page has everything you need.",
      "help.all": "All help topics", "help.before": "Before installing", "help.after": "After installing",
    },
  };
  const HTML_KEYS = new Set([]);
  const nodes = [...document.querySelectorAll("[data-t]")];
  const pl = new Map(nodes.map((n) => [n, n.innerHTML]));
  // etykiety dla czytników ekranu (aria-label) z kluczem w data-t-aria
  const aria = [...document.querySelectorAll("[data-t-aria]")].map((n) => ({ n, pl: n.getAttribute("aria-label") }));
  // tytuł, opis i inne pojedyncze teksty z wersją angielską w data-en (meta: atrybut content)
  const alt = [...document.querySelectorAll("[data-en]")].map((n) => {
    const attr = n.tagName === "META" ? "content" : null;
    return { n, attr, pl: attr ? n.getAttribute(attr) : n.textContent };
  });

  const store = {
    get() { try { return localStorage.getItem("lang"); } catch { return null; } },
    set(v) { try { localStorage.setItem("lang", v); } catch {} },
  };

  function pick() {
    const q = new URLSearchParams(location.search).get("lang");
    if (q) return q.toLowerCase().startsWith("pl") ? "pl" : "en";
    const s = store.get();
    if (s === "pl" || s === "en") return s;
    return (navigator.languages || [navigator.language || "pl"]).some((l) => /^pl\b/i.test(l)) ? "pl" : "en";
  }

  function apply(lang) {
    const d = T[lang];
    document.documentElement.lang = lang;
    for (const n of nodes) {
      const k = n.dataset.t;
      const v = d ? d[k] : pl.get(n);
      if (v == null) continue;
      if (!d || HTML_KEYS.has(k)) n.innerHTML = v; else n.textContent = v;
    }
    for (const { n, pl: v0 } of aria) {
      const v = d ? d[n.dataset.tAria] : v0;
      if (v != null) n.setAttribute("aria-label", v);
    }
    for (const { n, attr, pl: v0 } of alt) {
      const v = d ? n.dataset.en : v0;
      if (attr) n.setAttribute(attr, v); else n.textContent = v;
    }
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  }

  apply(pick());
  for (const b of document.querySelectorAll("[data-lang]")) {
    b.addEventListener("click", () => { store.set(b.dataset.lang); apply(b.dataset.lang); });
  }

  // odsłanianie przy przewijaniu
  const rev = document.querySelectorAll(".reveal, .mark");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    rev.forEach((n) => io.observe(n));
  } else rev.forEach((n) => n.classList.add("in"));

  // linia pod paskiem po przewinięciu
  const top = document.getElementById("top");
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // menu: otwiera się z trzech kresek, zamyka Esc, kliknięciem linku albo ponownym kliknięciem kresek
  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");
  if (burger && menu) {
    const set = (open) => {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.documentElement.style.overflow = open ? "hidden" : "";
      if (open) menu.querySelector("a")?.focus({ preventScroll: true }); else if (menu.contains(document.activeElement)) burger.focus();
    };
    burger.addEventListener("click", () => set(!menu.classList.contains("open")));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) set(false); });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  }

  // laptop: klapa otwiera się razem z przewijaniem, potem na ekranie zmieniają się: pulpit, instalator, aplikacje
  const wrap = document.getElementById("lap");
  if (wrap) {
    const stage = wrap.querySelector(".stage");
    const laptop = wrap.querySelector(".laptop");
    const tabs = [...wrap.querySelectorAll(".tabs button")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const OPEN = 0.42; // część przewijania, w której klapa się otwiera
    let manual = 0;
    const show = (i) => {
      laptop.dataset.s = String(i);
      tabs.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    };
    const update = () => {
      if (reduce) { stage.style.setProperty("--o", "1"); show(manual); return; }
      const r = wrap.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      const t = Math.min(1, p / OPEN);
      stage.style.setProperty("--o", (t * t * (3 - 2 * t)).toFixed(3));
      show(p < OPEN + 0.04 ? 0 : Math.min(2, Math.floor(((p - OPEN - 0.04) / (1 - OPEN - 0.04)) * 3)));
    };
    tabs.forEach((b, i) => b.addEventListener("click", () => {
      if (reduce) { manual = i; update(); return; }
      const span = wrap.offsetHeight - innerHeight;
      const p = i === 0 ? OPEN : OPEN + 0.04 + ((i + 0.5) / 3) * (1 - OPEN - 0.04);
      scrollTo({ top: wrap.getBoundingClientRect().top + scrollY + span * p, behavior: "smooth" });
    }));
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
  }

  // przycisk pobierania: fala od miejsca kliknięcia i „Pobieranie…”; samo pobieranie idzie zwykłym linkiem
  for (const a of document.querySelectorAll("[data-dl]")) {
    a.addEventListener("click", (ev) => {
      const r = a.getBoundingClientRect();
      const w = document.createElement("i");
      w.className = "wave";
      w.style.left = `${(ev.clientX || r.left + r.width / 2) - r.left}px`;
      w.style.top = `${(ev.clientY || r.top + r.height / 2) - r.top}px`;
      a.append(w);
      w.addEventListener("animationend", () => w.remove());
      a.classList.add("going");
      clearTimeout(a._t);
      a._t = setTimeout(() => a.classList.remove("going"), 2600);
    });
  }

  for (const y of document.querySelectorAll("[data-year]")) y.textContent = String(new Date().getFullYear());
})();
