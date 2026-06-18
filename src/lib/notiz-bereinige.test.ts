import { describe, expect, it } from "vitest";
import { bereinigeNotizInhalt, NOTIZ_MAX_LEN } from "./notiz-bereinige";

describe("bereinigeNotizInhalt", () => {
  it("gibt null für null/undefined zurück", () => {
    expect(bereinigeNotizInhalt(null)).toBeNull();
    expect(bereinigeNotizInhalt(undefined)).toBeNull();
  });

  it("gibt null für leeren oder reinen Whitespace-String zurück", () => {
    expect(bereinigeNotizInhalt("")).toBeNull();
    expect(bereinigeNotizInhalt("   ")).toBeNull();
    expect(bereinigeNotizInhalt("\n\t")).toBeNull();
  });

  it("trimmt den Inhalt", () => {
    expect(bereinigeNotizInhalt("  hallo  ")).toBe("hallo");
  });

  it("lässt Texte unter der Max-Länge unverändert", () => {
    expect(bereinigeNotizInhalt("abc")).toBe("abc");
  });

  it("schneidet Texte über der Max-Länge ab", () => {
    const lang = "x".repeat(NOTIZ_MAX_LEN + 50);
    const out = bereinigeNotizInhalt(lang);
    expect(out?.length).toBe(NOTIZ_MAX_LEN);
  });
});
