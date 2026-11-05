import { describe, expect, it } from "vitest";
import { slug, firstName, proposals, windowsList, mapWindowsApps } from "./logic";
import { configFromPlan, disksFromSystem, phaseOf } from "./backend/agama";
import type { InstallPlan } from "./backend/types";

describe("konto", () => {
  it("tworzy nazwę użytkownika bez polskich znaków", () => {
    expect(slug("Łukasz")).toBe("lukasz");
    expect(slug("Żaneta-Ćwik")).toBe("zanetacwik");
    expect(firstName("  Anna Kowalska ")).toBe("Anna");
  });
});

describe("programy", () => {
  const win = mapWindowsApps(["Microsoft Office", "Spotify", "Nieznany program"]);
  it("mapuje programy Windows na odpowiedniki i pomija nieznane", () => {
    expect(win.map((w) => w.id)).toEqual(["org.libreoffice.LibreOffice", "com.spotify.Client"]);
    expect(windowsList(win)[0].label).toContain("→");
    expect(windowsList(win)[1].label).toBe("Spotify");
  });
  it("proponuje maks. 5 programów na zmianę z kategorii, bez tych z Windows", () => {
    const p = proposals([true, false, false, false, true], win).map((x) => x.id);
    expect(p).toEqual(["org.videolan.VLC", "org.mozilla.Thunderbird"]);
    expect(proposals([true, true, true, true, true], null)).toHaveLength(5);
  });
});

const base: InstallPlan = {
  locale: "pl_PL.UTF-8", timezone: "Europe/Warsaw", keymap: "pl", place: "beside", windowsGB: 200,
  disk: { device: "/dev/nvme0n1", name: "SSD", sizeGB: 476, windows: { partition: "/dev/nvme0n1p3", minGB: 80, poolGB: 470 } },
  fullName: "Anna Kowalska", userName: "anna", password: "x",
};

describe("agama", () => {
  it("obok Windows: zmniejsza partycję Windows i generuje partycje Shrimp", () => {
    const c = configFromPlan(base) as any;
    expect(c.product).toEqual({ id: "Shrimp", mode: "immutable" });
    expect(c.storage.drives[0].partitions).toEqual([{ search: "/dev/nvme0n1p3", size: "200 GB" }, { generate: { partitions: "default" } }]);
  });
  it("zamiast Windows z szyfrowaniem: usuwa wszystko i szyfruje LUKS2", () => {
    const c = configFromPlan({ ...base, place: "replace", diskPassword: "tajne" }) as any;
    expect(c.storage.drives[0].partitions[0]).toEqual({ search: "*", delete: true });
    expect(c.storage.drives[0].partitions[1].generate.encryption).toEqual({ luks2: { password: "tajne" } });
  });
  it("odczytuje dysk z Windows i minimum z informacji o zmniejszaniu", () => {
    const d = disksFromSystem({
      storage: {
        candidateDrives: [1],
        devices: [{
          sid: 1, name: "/dev/sda", block: { size: 500e9 }, drive: { vendor: "WD", model: "Blue" },
          partitionTable: { unusedSlots: [{ start: 0, size: 10e9 }] },
          partitions: [
            { sid: 2, name: "/dev/sda1", block: { size: 1e8 }, filesystem: { type: "vfat" } },
            { sid: 3, name: "/dev/sda3", block: { size: 480e9, systems: ["Windows 11"], shrinking: { supported: true, minSize: 120.4e9 } }, filesystem: { type: "ntfs" } },
          ],
        }],
      },
    });
    expect(d).toEqual([{ device: "/dev/sda", name: "WD Blue", sizeGB: 500, windows: { partition: "/dev/sda3", minGB: 141, poolGB: 490 } }]);
  });
  it("tłumaczy postęp Agamy na fazy", () => {
    expect(phaseOf({ stage: "installing", progresses: [{ scope: "manager", index: 2, size: 4, step: "" }, { scope: "software", index: 5, size: 10, step: "" }] }))
      .toEqual({ percent: 37.5, phase: "Instalowanie systemu" });
  });
});
