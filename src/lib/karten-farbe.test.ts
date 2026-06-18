import { describe, expect, it } from "vitest";
import { istKartenFarbe, KARTEN_FARBEN } from "./karten-farbe";

describe("istKartenFarbe", () => {
  it("erkennt alle bekannten Farben", () => {
    for (const f of KARTEN_FARBEN) {
      expect(istKartenFarbe(f)).toBe(true);
    }
  });

  it("lehnt unbekannte Strings ab", () => {
    expect(istKartenFarbe("schwarz")).toBe(false);
    expect(istKartenFarbe("")).toBe(false);
    expect(istKartenFarbe("ROT")).toBe(false);
  });

  it("lehnt Nicht-Strings ab", () => {
    expect(istKartenFarbe(null)).toBe(false);
    expect(istKartenFarbe(undefined)).toBe(false);
    expect(istKartenFarbe(123)).toBe(false);
    expect(istKartenFarbe({})).toBe(false);
  });
});
