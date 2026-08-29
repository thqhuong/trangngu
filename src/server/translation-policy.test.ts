import { describe, expect, it } from "vitest";
import { isMusicChordSymbol, shouldPreserveWithoutTranslation } from "./translation-policy.js";

describe("translation policy", () => {
  it.each([
    "Bbmaj7",
    "E♭m7(b5)",
    "Db7(#11)",
    "F(sus4)",
    "Ab/Bb",
    "G°7",
  ])("recognizes musical chord notation: %s", (value) => {
    expect(isMusicChordSymbol(value)).toBe(true);
    expect(shouldPreserveWithoutTranslation(value)).toBe(true);
  });

  it("preserves chord rows and page-number noise without hiding prose", () => {
    expect(shouldPreserveWithoutTranslation("Dbm7 Dbm7 Gb7 F(sus4)")).toBe(true);
    expect(shouldPreserveWithoutTranslation("157")).toBe(true);
    expect(shouldPreserveWithoutTranslation("오른쪽은 Db메이저키에서 주로 사용되는 모달인터체인지 코드보이싱입니다.")).toBe(false);
    expect(shouldPreserveWithoutTranslation("Modal Interchange Db")).toBe(false);
  });
});
