import {
  findDeclRegions,
  type Grammar,
  prefixOf,
  type RawStyleHit,
  type StyleContextKind,
  type StyleFileHit,
  scanFileText,
  walkStyleFiles,
} from "./style-walk";
import { normalizeByAxis, normalizeFamily, type TypeAxis } from "./type-normalize";

export type TypeUsageHit = StyleFileHit & { sourceId: number; kind: "type" };

// Longhand type properties only (font shorthand descoped — its grammar needs a
// real tokenizer). camelCase forms cover JS style objects; findDeclRegions is
// property-aware, so a bare "16px" string is never extracted (codex C5).
const AXIS_BY_PROP: Record<string, TypeAxis> = {
  "font-size": "size",
  fontsize: "size",
  "font-family": "family",
  fontfamily: "family",
  "font-weight": "weight",
  fontweight: "weight",
  "line-height": "line-height",
  lineheight: "line-height",
};

function axisForProp(prop: string): TypeAxis | null {
  return AXIS_BY_PROP[prop.toLowerCase()] ?? null;
}

const VAR_RE = /var\(\s*(--[A-Za-z0-9_-]+)[^)]*\)/;
const TW_SIZE_RE = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g;
const TW_FAMILY_RE = /\bfont-(?:sans|serif|mono)\b/g;
const TW_WEIGHT_RE =
  /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g;
const TW_LH_RE = /\bleading-(?:none|tight|snug|normal|relaxed|loose|\d+)\b/g;

function firstToken(value: string): string {
  const tok = value.trim().split(/[\s;!,]/)[0] ?? "";
  return tok.replace(/^['"]|['"]$/g, "");
}

// A font-family value is only a literal declaration when the value position holds
// an actual family, not an expression it can equally hold. In JS/TS a real family
// is a string literal (`fontFamily: "Inter"`); a bare identifier chain
// (`theme.typography.fontFamily`), a type annotation (`fontFamily: string`), or a
// template with interpolation is not. In CSS/SCSS a bareword stack is legal, but a
// `$scss-var`, a `var()`/`#{}` interpolation, or any function call is not. Guards
// the family list against the real-repo garbage the dogfood gate surfaced.
function isLiteralFamily(raw: string, grammar: Grammar): boolean {
  if (!raw) return false;
  if (grammar === "js") return /^["']/.test(raw);
  return !raw.startsWith("$") && !/[(){}]/.test(raw);
}

function scanTypeLine(line: string, grammar: Grammar): RawStyleHit[] {
  const hits: RawStyleHit[] = [];
  const regions = findDeclRegions(line);

  if (grammar !== "css") {
    const tw: [RegExp, TypeAxis][] = [
      [TW_SIZE_RE, "size"],
      [TW_FAMILY_RE, "family"],
      [TW_WEIGHT_RE, "weight"],
      [TW_LH_RE, "line-height"],
    ];
    for (const [re, axis] of tw) {
      for (const m of line.matchAll(re)) {
        hits.push({
          rawToken: m[0],
          col: m.index ?? 0,
          contextKind: "tailwind-named",
          contextDetail: prefixOf(m[0]),
          normalizedValue: null,
          alpha: null,
          axis,
        });
      }
    }
  }

  for (const r of regions) {
    const axis = axisForProp(r.prop);
    if (!axis) continue;
    const value = line.slice(r.start, r.end);
    const ctx: StyleContextKind = grammar === "js" ? "js-literal" : "css-decl";

    const varM = value.match(VAR_RE);
    if (varM) {
      hits.push({
        rawToken: varM[0],
        col: r.start + (varM.index ?? 0),
        contextKind: "css-var-ref",
        contextDetail: varM[1] ?? null,
        normalizedValue: null,
        alpha: null,
        axis,
      });
      continue;
    }

    if (axis === "family") {
      const raw = value.replace(/\/\*[\s\S]*$/, "").trim();
      if (!isLiteralFamily(raw, grammar)) continue;
      const norm = normalizeFamily(raw);
      if (!norm) continue;
      hits.push({
        rawToken: raw,
        col: r.start + (value.length - value.trimStart().length),
        contextKind: ctx,
        contextDetail: r.prop,
        normalizedValue: norm.stack,
        alpha: null,
        axis,
      });
      continue;
    }

    const tok = firstToken(value);
    if (!tok) continue;
    hits.push({
      rawToken: tok,
      col: r.start + Math.max(0, value.indexOf(tok)),
      contextKind: ctx,
      contextDetail: r.prop,
      normalizedValue: normalizeByAxis(axis, tok),
      alpha: null,
      axis,
    });
  }

  return hits;
}

export function extractFileType(
  text: string,
  ext: string,
  sourceId: number,
  relPath: string,
  absPath: string,
): TypeUsageHit[] {
  return scanFileText(text, ext, relPath, absPath, scanTypeLine).map((h) => ({
    ...h,
    sourceId,
    kind: "type" as const,
  }));
}

type ExtractOpts = {
  sourceId: number;
  codeRoots: string[];
  ignore: string[];
};

export async function extractTypography(opts: ExtractOpts): Promise<TypeUsageHit[]> {
  const walked = await walkStyleFiles(opts.codeRoots, opts.ignore, scanTypeLine);
  return walked.map((h) => ({ ...h, sourceId: opts.sourceId, kind: "type" as const }));
}
