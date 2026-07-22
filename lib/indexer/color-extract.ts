import type { Asset } from "../db/schema";
import { normalizeColor } from "./color-normalize";
import {
  declKind,
  findDeclRegions,
  type Grammar,
  inConsumed,
  prefixOf,
  type Range,
  type RawStyleHit,
  regionAt,
  type StyleFileHit,
  scanFileText,
  walkStyleFiles,
} from "./style-walk";

export type { StyleContextKind } from "./style-walk";

export type ColorUsageHit = StyleFileHit & { sourceId: number; kind: "color" };

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

function isColorProp(prop: string): boolean {
  return prop.startsWith("--") || COLOR_PROPERTIES.has(prop.toLowerCase());
}

function scanColorLine(line: string, grammar: Grammar): RawStyleHit[] {
  const hits: RawStyleHit[] = [];
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
        normalizedValue: norm.color,
        alpha: norm.alpha,
        axis: null,
      });
    }
    for (const m of line.matchAll(TW_NAMED_RE)) {
      const start = m.index ?? 0;
      hits.push({
        rawToken: m[0],
        col: start,
        contextKind: "tailwind-named",
        contextDetail: prefixOf(m[0]),
        normalizedValue: null,
        alpha: null,
        axis: null,
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
      normalizedValue: null,
      alpha: null,
      axis: null,
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
        normalizedValue: norm.color,
        alpha: norm.alpha,
        axis: null,
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
      normalizedValue: norm.color,
      alpha: norm.alpha,
      axis: null,
    });
  }

  return hits;
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
        normalizedValue: norm?.color ?? null,
        axis: null,
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
  return scanFileText(text, ext, relPath, absPath, scanColorLine).map((h) => ({
    ...h,
    sourceId,
    kind: "color" as const,
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
  const walked = await walkStyleFiles(codeRoots, ignore, scanColorLine);
  return [
    ...svgHits(assets, sourceId),
    ...walked.map((h) => ({ ...h, sourceId, kind: "color" as const })),
  ];
}
