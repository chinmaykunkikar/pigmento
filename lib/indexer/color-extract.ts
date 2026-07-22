import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import fg from "fast-glob";
import pLimit from "p-limit";
import type { Asset } from "../db/schema";
import { normalizeColor } from "./color-normalize";
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

export type ColorUsageHit = {
  sourceId: number;
  kind: "color";
  normalizedColor: string | null;
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

// md/mdx/json/yml are deliberately excluded: prose floods on bare color words,
// and JSON/YAML color literals (design-token files) are a documented v1 gap.
const STYLE_GLOB = "**/*.{css,scss,sass,less,styl,ts,tsx,js,jsx,mjs,cjs,vue,svelte,astro,html,htm}";

const SKIP_FILE_RE = /(?:\.min\.(?:css|js)|\.bundle\.js|\.d\.ts)$/i;
const MAX_FILE = 2_000_000;
const MAX_LINE = 50_000;

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const FUNC_RE = /\b(?:rgba?|hsla?|hwb|okl(?:ab|ch)|lab|lch)\(\s*[^)]*\)/gi;
const VAR_RE = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)/g;
const WORD_RE = /\b[a-zA-Z]+\b/g;
const TW_PREFIX =
  "bg|text|border|fill|stroke|ring|from|via|to|shadow|outline|decoration|accent|caret|divide|placeholder";
const TW_ARBITRARY_RE = new RegExp(`\\b(?:${TW_PREFIX})-\\[([^\\]]+)\\]`, "g");
const TW_FAMILY =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const TW_NAMED_RE = new RegExp(
  `\\b(?:${TW_PREFIX})-(?:(?:${TW_FAMILY})-(?:50|100|200|300|400|500|600|700|800|900|950)|black|white)\\b`,
  "g",
);

// A declaration starts at a `{`, `;`, or line start, then `prop:`. Its value
// region runs to the next `;`/`{`/`}`. This finds declarations anywhere on a
// line, so single-line rules (`.a { color: #fff }`) work like multi-line ones,
// and selectors/at-rules (no `prop: value` region) contribute nothing.
const DECL_START_RE = /(?:^|[{};])\s*(--[A-Za-z0-9_-]+|[A-Za-z][A-Za-z-]*)\s*:/g;

const COLOR_PROPERTIES = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-block-color",
  "border-inline-color",
  "outline",
  "outline-color",
  "fill",
  "stroke",
  "box-shadow",
  "text-shadow",
  "caret-color",
  "accent-color",
  "text-decoration",
  "text-decoration-color",
  "column-rule",
  "column-rule-color",
  "stop-color",
  "flood-color",
  "lighting-color",
]);

// keywords culori parses as colors but that are really CSS keywords, not palette
const SKIP_WORDS = new Set([
  "transparent",
  "currentcolor",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
]);

type Grammar = "css" | "js" | "markup";

function grammarFor(ext: string): Grammar | null {
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

function isColorProp(prop: string): boolean {
  return prop.startsWith("--") || COLOR_PROPERTIES.has(prop.toLowerCase());
}

function prefixOf(twClass: string): string {
  return twClass.split("-")[0] ?? twClass;
}

type Range = readonly [number, number];

function inConsumed(ranges: Range[], start: number): boolean {
  return ranges.some(([s, e]) => start >= s && start < e);
}

type RawHit = {
  rawToken: string;
  col: number;
  contextKind: StyleContextKind;
  contextDetail: string | null;
  normalizedColor: string | null;
  alpha: number | null;
};

type DeclRegion = { prop: string; start: number; end: number };

function findDeclRegions(line: string): DeclRegion[] {
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

function regionAt(regions: DeclRegion[], idx: number): DeclRegion | null {
  for (const r of regions) if (idx >= r.start && idx < r.end) return r;
  return null;
}

function declKind(prop: string): StyleContextKind {
  return prop.startsWith("--") ? "css-var-def" : "css-decl";
}

function scanLine(line: string, grammar: Grammar): RawHit[] {
  const hits: RawHit[] = [];
  const consumed: Range[] = [];
  const regions = grammar === "js" ? [] : findDeclRegions(line);

  if (grammar !== "css") {
    for (const m of line.matchAll(TW_ARBITRARY_RE)) {
      const norm = normalizeColor(m[1] ?? "");
      if (!norm) continue;
      const start = m.index ?? 0;
      consumed.push([start, start + m[0].length]);
      hits.push({
        rawToken: m[0],
        col: start,
        contextKind: "tailwind-arbitrary",
        contextDetail: prefixOf(m[0]),
        normalizedColor: norm.color,
        alpha: norm.alpha,
      });
    }
    for (const m of line.matchAll(TW_NAMED_RE)) {
      const start = m.index ?? 0;
      hits.push({
        rawToken: m[0],
        col: start,
        contextKind: "tailwind-named",
        contextDetail: prefixOf(m[0]),
        normalizedColor: null,
        alpha: null,
      });
    }
  }

  for (const m of line.matchAll(VAR_RE)) {
    const start = m.index ?? 0;
    if (grammar === "css" && !regionAt(regions, start)) continue;
    consumed.push([start, start + m[0].length]);
    hits.push({
      rawToken: m[0],
      col: start,
      contextKind: "css-var-ref",
      contextDetail: m[1] ?? null,
      normalizedColor: null,
      alpha: null,
    });
  }

  for (const re of [HEX_RE, FUNC_RE]) {
    for (const m of line.matchAll(re)) {
      const start = m.index ?? 0;
      if (inConsumed(consumed, start)) continue;
      const region = regionAt(regions, start);
      if (grammar === "css" && !region) continue;
      const norm = normalizeColor(m[0]);
      if (!norm) continue;
      consumed.push([start, start + m[0].length]);
      hits.push({
        rawToken: m[0],
        col: start,
        contextKind: region ? declKind(region.prop) : "js-literal",
        contextDetail: region?.prop ?? null,
        normalizedColor: norm.color,
        alpha: norm.alpha,
      });
    }
  }

  for (const m of line.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    if (inConsumed(consumed, start)) continue;
    const region = regionAt(regions, start);
    if (!region || !isColorProp(region.prop)) continue;
    const word = m[0];
    if (SKIP_WORDS.has(word.toLowerCase())) continue;
    const norm = normalizeColor(word);
    if (!norm) continue;
    hits.push({
      rawToken: word,
      col: start,
      contextKind: declKind(region.prop),
      contextDetail: region.prop,
      normalizedColor: norm.color,
      alpha: norm.alpha,
    });
  }

  return hits;
}

function shouldSkipFile(text: string, relPath: string): boolean {
  if (text.length > MAX_FILE || SKIP_FILE_RE.test(relPath)) return true;
  return text.split("\n").some((l) => l.length > MAX_LINE);
}

function scanText(
  text: string,
  grammar: Grammar,
  ext: string,
): Omit<ColorUsageHit, "sourceId" | "kind" | "relPath" | "absPath">[] {
  const syntax = syntaxFor(ext);
  let block = initialBlockState();
  let offset = 0;
  const out: Omit<ColorUsageHit, "sourceId" | "kind" | "relPath" | "absPath">[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const h of scanLine(line, grammar)) {
      if (classifyLine(line, h.col, syntax, block).commented) continue;
      const startOffset = offset + h.col;
      out.push({
        normalizedColor: h.normalizedColor,
        alpha: h.alpha,
        rawToken: h.rawToken,
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

function svgHits(assets: Asset[], sourceId: number): ColorUsageHit[] {
  const out: ColorUsageHit[] = [];
  for (const a of assets) {
    if (!a.literalColors) continue;
    let colors: string[];
    try {
      colors = JSON.parse(a.literalColors);
    } catch {
      continue;
    }
    for (const raw of colors) {
      const norm = normalizeColor(raw);
      out.push({
        sourceId,
        kind: "color",
        normalizedColor: norm?.color ?? null,
        alpha: norm?.alpha ?? null,
        rawToken: raw,
        relPath: a.relPath,
        absPath: a.absPath,
        line: null,
        col: null,
        startOffset: null,
        endOffset: null,
        snippet: null,
        contextKind: "svg-attr",
        contextDetail: null,
      });
    }
  }
  return out;
}

export function extractFileColors(
  text: string,
  ext: string,
  sourceId: number,
  relPath: string,
  absPath: string,
): ColorUsageHit[] {
  const grammar = grammarFor(ext);
  if (!grammar || !text || shouldSkipFile(text, relPath)) return [];
  return scanText(text, grammar, ext).map((h) => ({
    ...h,
    sourceId,
    kind: "color" as const,
    relPath,
    absPath,
  }));
}

type ExtractOpts = {
  sourceId: number;
  codeRoots: string[];
  ignore: string[];
  assets: Asset[];
};

export async function extractColors(opts: ExtractOpts): Promise<ColorUsageHit[]> {
  const { sourceId, codeRoots, ignore, assets } = opts;
  const out: ColorUsageHit[] = svgHits(assets, sourceId);
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
          for (const h of extractFileColors(text, ext, sourceId, relPath, file)) out.push(h);
        }),
      ),
    );
  }

  return out;
}
