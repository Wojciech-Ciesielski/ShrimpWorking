import { describe, expect, it } from "vitest";
import { GiB, dur, fmtGB, fmtSize, phaseFrac, phaseText, remaining, space } from "./logic";

describe("formatowanie", () => {
  it("rozmiary nośników jak w Eksploratorze", () => {
    expect(fmtGB(32e9)).toBe("29,8 GB");
    expect(fmtGB(500e9)).toBe("466 GB");
    expect(fmtGB(1e12)).toBe("931 GB");
    expect(fmtGB(2e12)).toBe("1,8 TB");
    expect(fmtGB(1024 * GiB)).toBe("1 TB");
  });
  it("małe pliki w MB", () => {
    expect(fmtSize(2 * 1024 ** 2)).toBe("2 MB");
    expect(fmtSize(100)).toBe("1 MB");
    expect(fmtSize(3.2 * GiB)).toBe("3,2 GB");
  });
  it("czas", () => {
    expect(dur(30)).toBe("mniej niż minuta");
    expect(dur(70)).toBe("około minuty");
    expect(dur(720)).toBe("około 12 min");
  });
});

describe("miejsce na nośniku", () => {
  it("liczy wolne i brakujące miejsce", () => {
    const s = space(29.8 * GiB, 3.1 * GiB, 19.6 * GiB);
    expect(s.over).toBe(false);
    expect(s.text).toBe("Wolne 7,1 GB z 29,8 GB");
    const o = space(14.4 * GiB, 3.1 * GiB, 12 * GiB);
    expect(o.over).toBe(true);
    expect(o.text).toBe("Brakuje 0,7 GB");
    expect(o.filesPct).toBeCloseTo(((14.4 - 3.1) / 14.4) * 100);
  });
});

describe("postęp", () => {
  const sizes = { shrimp: 3.1 * GiB, files: 19.6 * GiB };
  it("opisy faz jak w makiecie", () => {
    const p = { phase: 1 as const, done: 1.2 * GiB, total: 3.1 * GiB, speed: 14 * 1024 ** 2 };
    expect(phaseText(1, p, sizes, false)).toBe("1,2 z 3,1 GB · 14 MB/s · zostało około 2 min");
    expect(phaseText(2, p, sizes, false)).toBe("Zajmie około minuty");
    expect(phaseText(3, p, sizes, false)).toBe("19,6 GB · zajmie około 6 min");
    expect(phaseText(1, null, sizes, true)).toBe("Pobrano 3,1 GB");
    expect(phaseText(3, null, sizes, true)).toBe("Skopiowano 19,6 GB");
    expect(phaseText(3, null, { ...sizes, files: 0 }, false)).toBe("Nic do skopiowania");
  });
  it("paski i pozostały czas", () => {
    const p = { phase: 2 as const, done: 1, total: 4, speed: 0 };
    expect(phaseFrac(1, p, false)).toBe(1);
    expect(phaseFrac(2, p, false)).toBe(0.25);
    expect(phaseFrac(3, p, false)).toBe(0);
    expect(remaining({ phase: 3, done: 0, total: 40 * 1024 ** 2, speed: 40 * 1024 ** 2 }, sizes)).toBeCloseTo(1);
  });
});
