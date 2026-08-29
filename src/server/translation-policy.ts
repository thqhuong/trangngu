const superscriptDigits: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

function normalizeMusicText(value: string): string {
  return Array.from(value.normalize("NFKC"), (character) => superscriptDigits[character] ?? character)
    .join("")
    .replaceAll("♭", "b")
    .replaceAll("♯", "#")
    .trim();
}

const root = String.raw`[A-G](?:#{1,2}|b{1,2})?`;
const quality = String.raw`(?:maj|min|dim|aug|sus|add|m|M|Δ|ø|o|°)?`;
const extension = String.raw`(?:\d+)?`;
const alteration = String.raw`(?:\((?:[#b]?\d+|sus\d+|add\d+)(?:[,/ ](?:[#b]?\d+|sus\d+|add\d+))*\))*`;
const bass = String.raw`(?:\/${root})?`;
const chordPattern = new RegExp(`^${root}${quality}${extension}${alteration}${bass}$`);

export function isMusicChordSymbol(value: string): boolean {
  const normalized = normalizeMusicText(value).replaceAll(" ", "");
  return normalized.length > 0 && normalized.length <= 40 && chordPattern.test(normalized);
}

export function shouldPreserveWithoutTranslation(value: string): boolean {
  const normalized = normalizeMusicText(value);
  if (!normalized) return true;
  if (/^[\d\s.,:;|/()#-]+$/u.test(normalized)) return true;
  const tokens = normalized.split(/[\s,;|]+/u).filter(Boolean);
  return tokens.length > 0 && tokens.length <= 24 && tokens.every(isMusicChordSymbol);
}
