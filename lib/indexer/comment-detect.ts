export type CommentSyntax = "js" | "html" | "yaml" | "mixed" | "none";

export function syntaxFor(ext: string): CommentSyntax {
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "css":
    case "scss":
    case "sass":
    case "less":
    case "styl":
      return "js";
    case "html":
    case "htm":
    case "md":
    case "mdx":
      return "html";
    case "vue":
    case "svelte":
    case "astro":
      return "mixed";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "none";
  }
}

export type BlockState = { inJsBlock: boolean; inHtmlBlock: boolean };

export function initialBlockState(): BlockState {
  return { inJsBlock: false, inHtmlBlock: false };
}

export type CommentResult = { commented: boolean; state: BlockState };

export function classifyLine(
  line: string,
  matchIndex: number,
  syntax: CommentSyntax,
  prev: BlockState,
): CommentResult {
  if (syntax === "none") return { commented: false, state: prev };

  const state: BlockState = { ...prev };
  const trimmed = line.trimStart();
  const leading = line.length - trimmed.length;

  if (syntax === "yaml") {
    const hashIdx = line.indexOf("#");
    const commented = hashIdx !== -1 && hashIdx <= matchIndex;
    return { commented, state };
  }

  const checkJs = syntax === "js" || syntax === "mixed";
  const checkHtml = syntax === "html" || syntax === "mixed";

  let commented = false;

  if (checkJs && state.inJsBlock) commented = true;
  if (checkHtml && state.inHtmlBlock) commented = true;

  if (!commented && checkJs) {
    const slashIdx = line.indexOf("//");
    if (slashIdx !== -1 && slashIdx <= matchIndex && !insideString(line, slashIdx)) {
      commented = true;
    }
    if (!commented && trimmed.startsWith("*") && !trimmed.startsWith("*/")) {
      commented = true;
    }
    if (!commented) {
      const blockOpen = line.lastIndexOf("/*", matchIndex);
      if (blockOpen !== -1) {
        const blockCloseBeforeMatch = line.indexOf("*/", blockOpen);
        if (blockCloseBeforeMatch === -1 || blockCloseBeforeMatch > matchIndex) {
          commented = true;
        }
      }
    }
  }

  if (!commented && checkHtml) {
    const htmlOpen = line.lastIndexOf("<!--", matchIndex);
    if (htmlOpen !== -1) {
      const htmlCloseBeforeMatch = line.indexOf("-->", htmlOpen);
      if (htmlCloseBeforeMatch === -1 || htmlCloseBeforeMatch > matchIndex) {
        commented = true;
      }
    }
  }

  if (checkJs) {
    const opens = countOccurrences(line, "/*");
    const closes = countOccurrences(line, "*/");
    if (opens > closes) state.inJsBlock = true;
    else if (closes > opens) state.inJsBlock = false;
  }
  if (checkHtml) {
    const opens = countOccurrences(line, "<!--");
    const closes = countOccurrences(line, "-->");
    if (opens > closes) state.inHtmlBlock = true;
    else if (closes > opens) state.inHtmlBlock = false;
  }

  void leading;
  return { commented, state };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    n++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return n;
}

function insideString(line: string, idx: number): boolean {
  let quote: '"' | "'" | "`" | null = null;
  for (let i = 0; i < idx; i++) {
    const ch = line[i];
    if (!ch) continue;
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    }
  }
  return quote !== null;
}
