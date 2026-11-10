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
      "how.kicker": "Three steps",
      "how.title": "From Windows to Shrimp without hunting for instructions.",
      "s1.t": "Download Shrimp Install", "s1.p": "A small Windows app. It downloads and verifies Shrimp for you.",
      "s2.t": "Plug in a drive", "s2.p": "16 GB or more. Your files and Windows settings come along with Shrimp.",
      "s3.t": "Restart", "s3.p": "The computer starts from the drive on its own. Setup guides you through the rest.",
      "f1": "<b>NVIDIA drivers</b> right after installation.",
      "f2": "<b>Movies and music</b> without hunting for codecs.",
      "f3": "<b>One look</b> across every app.",
      "f4": "<b>Your apps</b> matched to the ones you had on Windows.",
      "apps.kicker": "Included",
      "apps.title": "A calm system that looks after itself.",
      "a1": "Apps from one place, installed in one click.",
      "a2": "Restore the system to the moment everything worked.",
      "a3": "Updates that don't interrupt your work.",
      "end.title": "It all starts with one file.",
      "back": "Back to the home page",
      "wait.title": "Shrimp Install is almost here.",
      "wait.lead": "Shrimp Beta 3.1 is in closed testing. The download will start from this address as soon as it opens.",
      "nf.title": "Nothing here.",
      "nf.lead": "This address doesn't lead anywhere. The home page has everything you need.",
      "help.all": "All help topics", "help.before": "Before installing", "help.after": "After installing",
    },
  };
  const HTML_KEYS = new Set(["f1", "f2", "f3", "f4"]);
  const nodes = [...document.querySelectorAll("[data-t]")];
  const pl = new Map(nodes.map((n) => [n, n.innerHTML]));
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
