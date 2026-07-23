import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import fg from "fast-glob";
import pLimit from "p-limit";
import { classifyLine, initialBlockState, syntaxFor } from "./comment-detect";

export type StyleContextKind =
  | "css-decl"
  | "css-var-def"
  | "css-var-ref"
  | "tailwind-arbitrary"
  | "tailwind-named"
  | "js-literal"
  | "svg-attr"
  | "other";

export type Grammar = "css" | "js" | "markup";

// md/mdx/json/yml are deliberately excluded: prose floods on bare words, and
// JSON/YAML literals (design-token files) are a documented v1 gap.
export const STYLE_GLOB =
  "**/*.{css,scss,sass,less,styl,ts,tsx,js,jsx,mjs,cjs,vue,svelte,astro,html,htm}";

const SKIP_FILE_RE = /(?:\.min\.(?:css|js)|\.bundle\.js|\.d\.ts)$/i;
// Colors/type in test files and fixtures are throwaway (a sanitizer spec's fake
// palette, a snapshot's inline styles), never real design usage — the dogfood
// gate saw them pollute drift. Skip them for style extraction.
const TEST_FILE_RE =
  /\.(?:test|spec|stories)\.\w+$|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|tests?|fixtures?)\//i;
const MAX_FILE = 2_000_000;
const MAX_LINE = 50_000;

export function grammarFor(ext: string): Grammar | null {
  switch (ext) {
    case "css":
    case "scss":
    case "sass":
    case "less":
    case "styl":
      return "css";
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "js";
    case "vue":
    case "svelte":
    case "astro":
    case "html":
    case "htm":
      return "markup";
    default:
      return null;
  }
}

export function shouldSkipFile(text: string, relPath: string): boolean {
  if (text.length > MAX_FILE || SKIP_FILE_RE.test(relPath) || TEST_FILE_RE.test(relPath))
    return true;
  return text.split("\n").some((l) => l.length > MAX_LINE);
}

export type Range = readonly [number, number];

export function inConsumed(ranges: Range[], start: number): boolean {
  return ranges.some(([s, e]) => start >= s && start < e);
}

// A declaration starts at a `{`, `;`, `,`, or line start, then `prop:`. Its
// value region runs to the next `;`/`{`/`}` (NOT `,`, so comma-bearing values
// like font stacks and rgba() stay whole). The `,` start boundary catches the
// 2nd+ key of a single-line style object (`{ fontSize: x, fontWeight: y }`);
// selectors/at-rules (no `prop: value`) contribute nothing.
const DECL_START_RE = /(?:^|[{};,])\s*(--[A-Za-z0-9_-]+|[A-Za-z][A-Za-z-]*)\s*:/g;

export type DeclRegion = { prop: string; start: number; end: number };

export function findDeclRegions(line: string): DeclRegion[] {
  const regions: DeclRegion[] = [];
  for (const m of line.matchAll(DECL_START_RE)) {
    const prop = m[1];
    if (!prop) continue;
    const start = (m.index ?? 0) + m[0].length;
    let end = line.length;
    for (let i = start; i < line.length; i++) {
      const ch = line[i];
      if (ch === ";" || ch === "{" || ch === "}") {
        end = i;
        break;
      }
    }
    regions.push({ prop, start, end });
  }
  return regions;
}

export function regionAt(regions: DeclRegion[], idx: number): DeclRegion | null {
  for (const r of regions) if (idx >= r.start && idx < r.end) return r;
  return null;
}

export function declKind(prop: string): StyleContextKind {
  return prop.startsWith("--") ? "css-var-def" : "css-decl";
}

export function prefixOf(twClass: string): string {
  return twClass.split("-")[0] ?? twClass;
}

// A per-line scanner returns raw hits (position + fields); the walker handles
// the file glob, comment filtering, and offset/snippet machinery once, so color
// and type extraction share the chassis and differ only in their scanner.
export type RawStyleHit = {
  rawToken: string;
  col: number;
  contextKind: StyleContextKind;
  contextDetail: string | null;
  normalizedValue: string | null;
  alpha: number | null;
  axis: string | null;
};

export type LineScanner = (line: string, grammar: Grammar) => RawStyleHit[];

export type StyleFileHit = {
  normalizedValue: string | null;
  axis: string | null;
  alpha: number | null;
  rawToken: string;
  relPath: string;
  absPath: string;
  line: number | null;
  col: number | null;
  startOffset: number | null;
  endOffset: number | null;
  snippet: string | null;
  contextKind: StyleContextKind;
  contextDetail: string | null;
};

export function scanFileText(
  text: string,
  ext: string,
  relPath: string,
  absPath: string,
  scan: LineScanner,
): StyleFileHit[] {
  const grammar = grammarFor(ext);
  if (!grammar || !text || shouldSkipFile(text, relPath)) return [];
  const syntax = syntaxFor(ext);
  let block = initialBlockState();
  let offset = 0;
  const out: StyleFileHit[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const h of scan(line, grammar)) {
      if (classifyLine(line, h.col, syntax, block).commented) continue;
      const startOffset = offset + h.col;
      out.push({
        normalizedValue: h.normalizedValue,
        axis: h.axis,
        alpha: h.alpha,
        rawToken: h.rawToken,
        relPath,
        absPath,
        line: i + 1,
        col: h.col,
        startOffset,
        endOffset: startOffset + h.rawToken.length,
        snippet: line.trim().slice(0, 200),
        contextKind: h.contextKind,
        contextDetail: h.contextDetail,
      });
    }
    block = classifyLine(line, line.length, syntax, block).state;
    offset += line.length + 1;
  }
  return out;
}

export async function walkStyleFiles(
  codeRoots: string[],
  ignore: string[],
  scan: LineScanner,
): Promise<StyleFileHit[]> {
  const out: StyleFileHit[] = [];
  const limit = pLimit(16);
  for (const root of codeRoots) {
    const files = await fg(STYLE_GLOB, {
      cwd: root,
      ignore,
      absolute: true,
      onlyFiles: true,
      dot: false,
      suppressErrors: true,
    });
    await Promise.all(
      files.map((file) =>
        limit(async () => {
          let text: string;
          try {
            text = await readFile(file, "utf8");
          } catch {
            return;
          }
          const relPath = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
          const ext = extname(file).slice(1).toLowerCase();
          for (const h of scanFileText(text, ext, relPath, file, scan)) out.push(h);
        }),
      ),
    );
  }
  return out;
}
