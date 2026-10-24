// Spoilers are written ||like this|| inside a write-up or a point, on a single line.
const spoilerPattern = /\|\|(.+?)\|\|/g;

// The link target that carries a spoiler through Markdown, where the review renders it as a chip.
export const spoilerHref = "#spoiler";

export type SpoilerPart = { text: string; spoiler: boolean };

// Splits plain text into runs, marking the hidden ones. Used for points, which are not Markdown.
export function splitSpoilers(text: string): SpoilerPart[] {
  const parts: SpoilerPart[] = [];
  let last = 0;
  for (const match of text.matchAll(spoilerPattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), spoiler: false });
    parts.push({ text: match[1], spoiler: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), spoiler: false });
  return parts;
}

// Rewrites spoilers in a Markdown write-up as links to spoilerHref, so the text inside keeps its
// formatting and the renderer can swap each link for a chip.
export function markdownSpoilers(text: string): string {
  return text.replace(
    spoilerPattern,
    (_, hidden: string) => `[${hidden.replace(/[[\]]/g, "\\$&")}](${spoilerHref})`,
  );
}
