import { describe, expect, it } from "vitest";
import { formatDeDatumZeit } from "./lage-utils";

describe("formatDeDatumZeit", () => {
  it("gibt — für null zurück", () => {
    expect(formatDeDatumZeit(null)).toBe("—");
  });

  it("formatiert ein ISO-Datum im de-DE-Schema", () => {
    const out = formatDeDatumZeit("2026-05-25T14:30:00Z");
    expect(out).toMatch(/^\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2}$/);
  });

  it("löst Sommerzeit auf Europe/Berlin auf (UTC+2)", () => {
    // 25. Mai = MESZ = UTC+2
    expect(formatDeDatumZeit("2026-05-25T14:30:00Z")).toBe("25.05.2026, 16:30");
  });

  it("löst Winterzeit auf Europe/Berlin auf (UTC+1)", () => {
    // 25. Januar = MEZ = UTC+1
    expect(formatDeDatumZeit("2026-01-25T14:30:00Z")).toBe("25.01.2026, 15:30");
  });
});
