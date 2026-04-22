const PATH_RE = /<path\b[^>]*\bd\s*=\s*["']([^"']*)["']/gi;
const CMD_RE = /[MLHVCSQTAZ]/gi;
const VIEWBOX_RE = /\bviewBox\s*=\s*["']([^"']+)["']/i;
const FILL_RE = /\bfill\s*=\s*["']([^"']+)["']/gi;
const STROKE_RE = /\bstroke-width\s*=\s*["']([^"']+)["']/gi;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi;

export type SvgStats = {
  viewBox: string | null;
  pathsCount: number;
  commandsCount: number;
  hasFill: boolean;
  strokeWidths: string[];
  literalColors: string[];
};

export function parseSvg(text: string): SvgStats {
  const paths = Array.from(text.matchAll(PATH_RE));
  const pathsCount = paths.length;
  let commandsCount = 0;
  for (const p of paths) {
    commandsCount += (p[1]?.match(CMD_RE) ?? []).length;
  }
  const viewBox = text.match(VIEWBOX_RE)?.[1] ?? null;

  const fills = Array.from(text.matchAll(FILL_RE))
    .map((m) => m[1])
    .filter((v): v is string => !!v && v !== "none");
  const hasFill = fills.length > 0;

  const strokeWidths = Array.from(
    new Set(
      Array.from(text.matchAll(STROKE_RE))
        .map((m) => m[1])
        .filter((v): v is string => !!v),
    ),
  );

  const hex = Array.from(new Set(text.match(HEX_RE)?.map((s) => s.toLowerCase()) ?? []));
  const rgb = Array.from(new Set(text.match(RGB_RE) ?? []));
  const literalColors = [...hex, ...rgb];

  return { viewBox, pathsCount, commandsCount, hasFill, strokeWidths, literalColors };
}
