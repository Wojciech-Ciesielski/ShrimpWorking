import { describe, expect, it } from "vitest";
import { GiB, dur, fmtGB, fmtSize, hostMessage, phaseFrac, phaseText, remaining, space } from "./logic";
import { load } from "./i18n";

const en = load(["en-US"]);
const pl = load(["pl-PL"]);
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("formatowanie", () => {
  it("rozmiary nośników jak w Eksploratorze", () => {
    expect(n(fmtGB(pl, 32e9))).toBe("29,8 GB");
    expect(n(fmtGB(en, 32e9))).toBe("29.8 GB");
    expect(n(fmtGB(pl, 500e9))).toBe("466 GB");
    expect(n(fmtGB(pl, 1e12))).toBe("931 GB");
    expect(n(fmtGB(pl, 2e12))).toBe("1,8 TB");
    expect(n(fmtGB(pl, 1024 * GiB))).toBe("1 TB");
  });
  it("małe pliki w MB", () => {
    expect(n(fmtSize(pl, 2 * 1024 ** 2))).toBe("2 MB");
    expect(n(fmtSize(pl, 100))).toBe("1 MB");
    expect(n(fmtSize(pl, 3.2 * GiB))).toBe("3,2 GB");
  });
  it("czas", () => {
    expect(dur(pl, 30)).toBe("mniej niż minuta");
    expect(dur(en, 70)).toBe("about 1 minute");
    expect(dur(pl, 720)).toBe("około 12 minut");
    expect(dur(en, 720)).toBe("about 12 minutes");
  });
  it("jednostki w języku interfejsu", () => {
    expect(n(fmtGB(load(["ru"]), 32e9))).toBe("29,8 ГБ");
  });
});

describe("miejsce na nośniku", () => {
  it("liczy wolne i brakujące miejsce", () => {
    const s = space(pl, 29.8 * GiB, 3.1 * GiB, 19.6 * GiB);
    expect(s.over).toBe(false);
    expect(n(s.text)).toBe("Wolne 7,1 GB z 29,8 GB");
    const o = space(pl, 14.4 * GiB, 3.1 * GiB, 12 * GiB);
    expect(o.over).toBe(true);
    expect(n(o.text)).toBe("Brakuje 0,7 GB");
    expect(n(space(en, 14.4 * GiB, 3.1 * GiB, 12 * GiB).text)).toBe("0.7 GB short");
    expect(o.filesPct).toBeCloseTo(((14.4 - 3.1) / 14.4) * 100);
  });
});

describe("postęp", () => {
  const sizes = { shrimp: 3.1 * GiB, files: 19.6 * GiB };
  it("opisy faz jak w makiecie", () => {
    const p = { phase: 1 as const, done: 1.2 * GiB, total: 3.1 * GiB, speed: 14 * 1024 ** 2 };
    expect(n(phaseText(pl, 1, p, sizes, false))).toBe("1,2 z 3,1 GB · 14 MB/s · zostało około 2 minuty");
    expect(n(phaseText(pl, 2, p, sizes, false))).toBe("Zajmie około 1 minuta");
    expect(n(phaseText(pl, 3, p, sizes, false))).toBe("19,6 GB · zajmie około 6 minut");
    expect(n(phaseText(pl, 1, null, sizes, true))).toBe("Pobrano 3,1 GB");
    expect(n(phaseText(pl, 3, null, sizes, true))).toBe("Skopiowano 19,6 GB");
    expect(phaseText(pl, 3, null, { ...sizes, files: 0 }, false)).toBe("Nic do skopiowania");
    expect(n(phaseText(en, 1, p, sizes, false))).toBe("1.2 of 3.1 GB · 14 MB/s · about 2 minutes left");
  });
  it("paski i pozostały czas", () => {
    const p = { phase: 2 as const, done: 1, total: 4, speed: 0 };
    expect(phaseFrac(1, p, false)).toBe(1);
    expect(phaseFrac(2, p, false)).toBe(0.25);
    expect(phaseFrac(3, p, false)).toBe(0);
    expect(remaining({ phase: 3, done: 0, total: 40 * 1024 ** 2, speed: 40 * 1024 ** 2 }, sizes)).toBeCloseTo(1);
  });
});

describe("komunikaty programu", () => {
  it("kody tłumaczy, nieznany tekst zostawia", () => {
    expect(hostMessage(en, "connect")).toBe("Can't connect to the download server.");
    expect(hostMessage(pl, "http:404")).toBe("Serwer pobierania odpowiedział kodem 404.");
    expect(hostMessage(en, "Błąd 5: odmowa dostępu")).toBe("Błąd 5: odmowa dostępu");
  });
});
