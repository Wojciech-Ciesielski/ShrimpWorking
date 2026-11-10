// Laptop 3D na stronie głównej: własny model (aluminiowa obudowa, klapa na zawiasie, klawiatura z osobnych klawiszy,
// gładzik), narysowany w three.js. Ekran to tekstura rysowana na canvasie: pulpit, instalator i sklep z aplikacjami
// (makiety, nie zrzuty ekranu). Ładowany dopiero, gdy użytkownik zbliża się do sekcji (assets/site.js).
// API: const api = await createLaptop(canvas); api.set(o, ekran) — o: 0 = zamknięty … 1 = otwarty, ekran: 0 | 1 | 2.
import * as THREE from "./vendor/three.module.min.js";

// wymiary modelu (jednostki umowne, 1 ≈ 10 cm)
const W = 3.2, DEPTH = 2.2, BASE_H = 0.1, LID_T = 0.075, LID_H = 2.2;
const SW = 3.04, SH = 1.9, SCREEN_Y = 1.07;
const OPEN_EXTRA = 0.27; // klapa odchyla się o tyle radianów za pionem

const STR = {
  pl: { files: "Pliki", step: "Krok 2 z 3", title: "Wybierz nośnik", a: "Pendrive", b: "Karta SD", c: "Dysk zewnętrzny", next: "Dalej", discover: "Odkrywaj", installed: "Zainstalowane", search: "Szukaj aplikacji", get: "Pobierz" },
  en: { files: "Files", step: "Step 2 of 3", title: "Choose a drive", a: "USB stick", b: "SD card", c: "External drive", next: "Next", discover: "Discover", installed: "Installed", search: "Search apps", get: "Get" },
};

const smooth = (x) => x * x * (3 - 2 * x);

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Zaokrąglona płyta w, h, z grubością d (z od 0 do d), ze ściętymi krawędziami. */
function slab(w, h, d, r, bevel) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, h - 2 * bevel, Math.max(0.002, r - bevel)), {
    depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24,
  });
  g.translate(0, 0, bevel);
  return g;
}

function studioEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x08080a);
  const softbox = (w, h, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); sc.add(m);
  };
  softbox(12, 7, 5, [0, 9, 2]);
  softbox(3, 9, 3.2, [-9, 3, 3]);
  softbox(3, 9, 3.2, [9, 3, 3]);
  softbox(12, 3, 1.6, [0, 2, 11]);
  softbox(9, 4, 1.8, [0, 4, -10]);
  const tex = pm.fromScene(sc, 0.03).texture;
  pm.dispose();
  return tex;
}

function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** Logo Shrimp jako maska (biały kształt na czarnym), do wypolerowanego znaku na klapie. */
async function logoMask() {
  try {
    const txt = await (await fetch("/assets/logo.svg")).text();
    const sym = txt.match(/<symbol[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/);
    if (!sym) return null;
    const [, vb, inner] = sym;
    const [, , vw, vh] = vb.split(/\s+/).map(Number);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${vw * 4}" height="${vh * 4}">${inner.replace(/currentColor/g, "#fff")}</svg>`;
    const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.round((512 * vh) / vw);
    const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return { tex: t, aspect: vw / vh };
  } catch { return null; }
}

export async function createLaptop(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const cam = new THREE.PerspectiveCamera(28, 1.6, 0.1, 60);
  scene.add(new THREE.DirectionalLight(0xffffff, 0.6).translateX(2).translateY(6).translateZ(5));

  // ----- materiały -----
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.34 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.7, roughness: 0.45 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0.1, roughness: 0.55 });
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.8 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd6d9de, metalness: 0.9, roughness: 0.22 });
  const blackGlass = new THREE.MeshStandardMaterial({ color: 0x030304, metalness: 0.3, roughness: 0.25 });

  const laptop = new THREE.Group();
  laptop.position.z = -DEPTH / 2; // środek podstawy w początku układu
  scene.add(laptop);

  // ----- podstawa -----
  const baseGeo = slab(W, DEPTH, BASE_H, 0.2, 0.026);
  baseGeo.rotateX(-Math.PI / 2); // kształt w płaszczyźnie XZ, grubość w górę
  const base = new THREE.Mesh(baseGeo, alu);
  base.position.z = DEPTH / 2;
  laptop.add(base);

  const deck = BASE_H + 0.0008;
  const well = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(2.86, 1.18, 0.06)), wellMat);
  well.rotation.x = -Math.PI / 2; well.position.set(0, deck, 0.72);
  laptop.add(well);

  // klawisze: rząd funkcyjny niższy, ostatni z długim spacją
  const rows = [
    { z: 0.22, d: 0.085, keys: Array(14).fill(1) },
    { z: 0.385, d: 0.16, keys: Array(14).fill(1) },
    { z: 0.57, d: 0.16, keys: [1.5, ...Array(12).fill(1), 1.5] },
    { z: 0.755, d: 0.16, keys: [1.7, ...Array(11).fill(1), 1.7] },
    { z: 0.94, d: 0.16, keys: [2.1, ...Array(10).fill(1), 2.1] },
    { z: 1.125, d: 0.16, keys: [1.1, 1, 1.1, 7.6, 1.1, 1, 1.1] },
  ];
  const pitch = 2.74 / 14;
  const keyList = [];
  for (const r of rows) {
    const total = r.keys.reduce((a, b) => a + b, 0);
    let x = -(total * pitch) / 2;
    for (const k of r.keys) { keyList.push({ x: x + (k * pitch) / 2, z: r.z, w: k * pitch - 0.022, d: r.d }); x += k * pitch; }
  }
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), keyMat, keyList.length);
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  keyList.forEach((k, i) => { p.set(k.x, deck + 0.011, k.z); sc.set(k.w, 0.022, k.d); m4.compose(p, q, sc); keys.setMatrixAt(i, m4); });
  laptop.add(keys);

  // gładzik: ciemniejsza szczelina i płyta
  const gap = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(1.26, 0.8, 0.06)), aluDark);
  gap.rotation.x = -Math.PI / 2; gap.position.set(0, deck, 1.66);
  laptop.add(gap);
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(1.2, 0.74, 0.05)), padMat);
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, deck + 0.0006, 1.66);
  laptop.add(pad);

  // zawias
  const hingeY = BASE_H + 0.03;
  const hingeBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, W * 0.86, 28).rotateZ(Math.PI / 2), aluDark);
  hingeBar.position.set(0, hingeY, 0.02);
  laptop.add(hingeBar);

  // ----- klapa -----
  const hinge = new THREE.Group(); // obrót wokół tylnej krawędzi podstawy
  hinge.position.set(0, hingeY, 0);
  laptop.add(hinge);
  const lidGeo = slab(W, LID_H, LID_T, 0.17, 0.026);
  lidGeo.translate(0, LID_H / 2, -LID_T); // ekran patrzy w +z, plecy w −z
  hinge.add(new THREE.Mesh(lidGeo, alu));

  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(SW + 0.035, SH + 0.035, 0.035)), blackGlass);
  bezel.position.set(0, SCREEN_Y, 0.0015);
  hinge.add(bezel);

  const sCanvas = document.createElement("canvas");
  sCanvas.width = 1920; sCanvas.height = 1200;
  const sTex = new THREE.CanvasTexture(sCanvas);
  sTex.colorSpace = THREE.SRGBColorSpace;
  sTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screenMat = new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  screen.position.set(0, SCREEN_Y, 0.003);
  hinge.add(screen);

  const cam3 = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), new THREE.MeshBasicMaterial({ color: 0x15161a }));
  cam3.position.set(0, LID_H - 0.09, 0.0025);
  hinge.add(cam3);

  const logo = await logoMask();
  if (logo) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 1, roughness: 0.12, alphaMap: logo.tex, transparent: true });
    const h = 0.42;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(h * logo.aspect, h), mat);
    mark.position.set(0, LID_H / 2, -LID_T - 0.002);
    mark.rotation.set(0, Math.PI, Math.PI); // czytelne z przodu przy zamkniętej klapie
    hinge.add(mark);
  }

  // ----- ekrany (canvas) -----
  const ctx = sCanvas.getContext("2d");
  const photo = await loadImage("/assets/mont-blanc.jpg");
  let lang = document.documentElement.lang === "en" ? "en" : "pl";
  let cur = 0, prev = 0, fade = 1, fadeRaf = 0;
  const FONT = '"Inter", "Noto Sans", system-ui, sans-serif';

  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  const txt = (c, s, x, y, size, weight, color, align = "left") => {
    c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle"; c.fillText(s, x, y);
  };
  const cover = (c, img, w, h, px, py) => {
    const k = Math.max(w / img.width, h / img.height);
    const iw = img.width * k, ih = img.height * k;
    c.drawImage(img, (w - iw) * px, (h - ih) * py, iw, ih);
  };

  function desktop(c, w, h) {
    const u = w / 100, S = STR[lang];
    if (photo) cover(c, photo, w, h, 0.42, 0.4); else { c.fillStyle = "#1f3a68"; c.fillRect(0, 0, w, h); }
    c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(0, 0, w, 3.4 * u);
    txt(c, "Shrimp", 1.8 * u, 1.7 * u, 1.25 * u, 600, "#fff");
    txt(c, "12:40", w - 1.8 * u, 1.7 * u, 1.2 * u, 600, "#fff", "right");
    // okno ze szkłem: rozmyty fragment tapety pod spodem
    const x = 11 * u, y = 18 * u, ww = 46 * u, hh = 31 * u;
    c.save(); rr(c, x, y, ww, hh, 1.2 * u); c.clip();
    if (photo && "filter" in c) { c.filter = `blur(${1.4 * u}px)`; cover(c, photo, w, h, 0.42, 0.4); c.filter = "none"; }
    c.fillStyle = "rgba(24,26,30,.74)"; c.fillRect(x, y, ww, hh);
    c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(x, y, 13 * u, hh);
    for (let i = 0; i < 4; i++) { c.fillStyle = i ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.42)"; rr(c, x + 1.5 * u, y + (2 + i * 2.1) * u, 10 * u, 1 * u, 0.5 * u); c.fill(); }
    txt(c, S.files, x + 15 * u, y + 2.4 * u, 1.25 * u, 600, "#fff");
    for (let i = 0; i < 6; i++) { c.fillStyle = "rgba(255,255,255,.13)"; rr(c, x + (15 + (i % 3) * 10.2) * u, y + (5 + Math.floor(i / 3) * 8.4) * u, 9.4 * u, 7.4 * u, 0.9 * u); c.fill(); }
    c.restore();
    // dok
    const dw = 5 * 5.6 * u + 2.8 * u, dx = (w - dw) / 2, dy = h - 7.2 * u;
    c.save(); rr(c, dx, dy, dw, 5.8 * u, 2.2 * u); c.fillStyle = "rgba(0,0,0,.42)"; c.fill(); c.restore();
    ["#f1f1f1", "#6aa7ff", "#ffb454", "#7ddc9a", "#c58bff"].forEach((col, i) => { c.fillStyle = col; rr(c, dx + 1.4 * u + i * 5.6 * u, dy + 0.8 * u, 4.2 * u, 4.2 * u, 1.1 * u); c.fill(); });
  }

  function installer(c, w, h) {
    const u = w / 100, S = STR[lang];
    c.fillStyle = "#0d0e10"; c.fillRect(0, 0, w, h);
    const cx = w / 2;
    txt(c, S.step, cx, 24 * u, 1.3 * u, 400, "#9a9ea5", "center");
    txt(c, S.title, cx, 29.5 * u, 3.9 * u, 600, "#fff", "center");
    [["a", "32 GB", true], ["b", "64 GB", false], ["c", "500 GB", false]].forEach(([k, size, sel], i) => {
      const rw = 44 * u, rx = cx - rw / 2, ry = (37 + i * 7.6) * u, rh = 6.4 * u;
      rr(c, rx, ry, rw, rh, 1.5 * u);
      if (sel) { c.fillStyle = "#fff"; c.fill(); } else { c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = Math.max(1, 0.12 * u); c.stroke(); }
      txt(c, S[k], rx + 2 * u, ry + rh / 2, 1.7 * u, 600, sel ? "#000" : "#fff");
      txt(c, size, rx + rw - 2 * u, ry + rh / 2, 1.3 * u, 400, sel ? "#555" : "#9a9ea5", "right");
    });
    const bw = 13 * u; rr(c, cx - bw / 2, 62 * u, bw, 5.4 * u, 2.7 * u); c.fillStyle = "#fff"; c.fill();
    txt(c, S.next, cx, 64.7 * u, 1.7 * u, 600, "#000", "center");
  }

  function apps(c, w, h) {
    const u = w / 100, S = STR[lang];
    c.fillStyle = "#101114"; c.fillRect(0, 0, w, h);
    txt(c, S.discover, 3.4 * u, 5 * u, 1.6 * u, 600, "#fff");
    txt(c, S.installed, 12 * u, 5 * u, 1.6 * u, 400, "#9a9ea5");
    rr(c, w - 31.4 * u, 2.6 * u, 28 * u, 4.8 * u, 2.4 * u); c.fillStyle = "rgba(255,255,255,.1)"; c.fill();
    txt(c, S.search, w - 29.4 * u, 5 * u, 1.35 * u, 400, "#9a9ea5");
    const hues = [210, 28, 140, 275, 350, 48, 185, 100];
    const cw = 21.6 * u, ch = 24 * u;
    hues.forEach((hue, i) => {
      const x = 3.2 * u + (i % 4) * (cw + 2 * u), y = 11 * u + Math.floor(i / 4) * (ch + 2 * u);
      rr(c, x, y, cw, ch, 1.6 * u); c.fillStyle = "rgba(255,255,255,.06)"; c.fill();
      rr(c, x + 1.8 * u, y + 1.8 * u, 6 * u, 6 * u, 1.5 * u); c.fillStyle = `hsl(${hue} 55% 58%)`; c.fill();
      rr(c, x + 1.8 * u, y + 10.4 * u, 15 * u, 1.1 * u, 0.55 * u); c.fillStyle = "rgba(255,255,255,.32)"; c.fill();
      rr(c, x + 1.8 * u, y + 12.6 * u, 9.5 * u, 1.1 * u, 0.55 * u); c.fillStyle = "rgba(255,255,255,.14)"; c.fill();
      const bw = S.get.length * 0.95 * u + 3.6 * u;
      rr(c, x + 1.8 * u, y + 17 * u, bw, 3.4 * u, 1.7 * u); c.fillStyle = "#fff"; c.fill();
      txt(c, S.get, x + 1.8 * u + bw / 2, y + 18.75 * u, 1.2 * u, 600, "#000", "center");
    });
  }

  const SCREENS = [desktop, installer, apps];
  function paint() {
    const w = sCanvas.width, h = sCanvas.height;
    ctx.globalAlpha = 1;
    SCREENS[fade < 1 ? prev : cur](ctx, w, h);
    if (fade < 1) { ctx.globalAlpha = fade; SCREENS[cur](ctx, w, h); ctx.globalAlpha = 1; }
    sTex.needsUpdate = true;
  }
  function setScreen(i) {
    if (i === cur) return;
    prev = cur; cur = i; fade = 0;
    cancelAnimationFrame(fadeRaf);
    const t0 = performance.now();
    const step = (t) => {
      fade = Math.min(1, (t - t0) / 550);
      paint(); render();
      if (fade < 1) fadeRaf = requestAnimationFrame(step);
    };
    fadeRaf = requestAnimationFrame(step);
  }

  // ----- kamera i animacja -----
  let o = 0, aspect = 1.6, dirty = true, raf = 0;
  const FIT = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const dirClosed = new THREE.Vector3(0, 0.66, 0.75).normalize();
  const dirOpen = new THREE.Vector3(0, 0.27, 0.96).normalize();
  const tgtClosed = new THREE.Vector3(0.45, 0.05, 0), tgtOpen = new THREE.Vector3(0, 0.95, -0.2);
  const dir = new THREE.Vector3(), tgt = new THREE.Vector3();

  function pose() {
    const e = o;
    hinge.rotation.x = Math.PI / 2 - e * (Math.PI / 2 + OPEN_EXTRA);
    laptop.rotation.y = (1 - e) * 0.42;
    screenMat.color.setScalar(0.12 + 0.88 * smooth(Math.min(1, e * 1.4)));
    dir.lerpVectors(dirClosed, dirOpen, e).normalize();
    tgt.lerpVectors(tgtClosed, tgtOpen, e);
    const fitW = (W * 1.2) / (FIT * aspect), fitH = (e < 0.5 ? 2.6 : 3.05) / FIT;
    const dist = Math.max(fitW, fitH) * (1 + (1 - e) * 0.1);
    cam.position.copy(tgt).addScaledVector(dir, dist);
    cam.lookAt(tgt);
  }

  function render() { pose(); renderer.render(scene, cam); dirty = false; }
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (dirty) render(); }); }

  function resize() {
    const host = canvas.parentElement;
    const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    aspect = w / h; cam.aspect = aspect; cam.updateProjectionMatrix();
    dirty = true; schedule();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  document.addEventListener("langchange", (e) => { lang = e.detail === "en" ? "en" : "pl"; paint(); dirty = true; schedule(); });
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());

  paint();
  try { await document.fonts.load('600 32px "Inter"'); paint(); } catch { /* bez fontu zostaje zapasowy */ }
  resize();

  return {
    set(nextO, screenIdx) {
      if (Math.abs(nextO - o) > 1e-4) { o = nextO; dirty = true; }
      setScreen(screenIdx);
      if (dirty) schedule();
    },
  };
}
