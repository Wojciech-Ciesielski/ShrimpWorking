import { describe, expect, it } from "vitest";
import { helpUrl } from "../../../site/help";

describe("strony pomocy", () => {
  it("bez adresu strony zwracają null (ikona zostaje samą podpowiedzią)", () => {
    expect(helpUrl("iso", "pl", "install", "")).toBeNull();
  });
  it("składają adres z tematu, języka i programu", () => {
    expect(helpUrl("iso", "pl", "install", "https://example.org/help/")).toBe("https://example.org/help/download-iso?lang=pl&from=install");
    expect(helpUrl("nvidia", "pt-BR", "setup", "https://example.org")).toBe("https://example.org/nvidia-driver?lang=pt-BR&from=setup");
  });
  it("odrzucają nieznany temat i adresy inne niż https", () => {
    expect(helpUrl("nie-ma", "pl", "install", "https://example.org")).toBeNull();
    for (const b of ["http://example.org", "javascript:alert(1)", "https://exa mple.org", "https://a.org/?x=1", "file:///c:/"]) expect(helpUrl("iso", "pl", "install", b), b).toBeNull();
  });
});
