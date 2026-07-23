import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRootOf } from "./repo";

const START = "<!-- pigmento:start -->";
const END = "<!-- pigmento:end -->";

const BLOCK = `${START}
## Design ground truth (pigmento)
Before writing colors, typography, or icons, consult the pigmento MCP server for this repo:
- resolve_token_for_value — snap a raw color to the nearest existing token
- find_similar_asset — check whether an icon/image already exists before adding one
- list_drift — near-miss colors/type already in the codebase
- get_palette / get_typography_scale — the design system derived from the code

CLI: \`pigmento context\` (digest), \`pigmento check --json\` (advisory drift).
${END}`;

export function renderBlock(): string {
  return BLOCK;
}

// Idempotent: replace an existing marker block in place, else append. Re-running
// produces a byte-identical file.
export function upsertBlock(content: string): string {
  const s = content.indexOf(START);
  const e = content.indexOf(END);
  if (s !== -1 && e !== -1 && e > s) {
    return content.slice(0, s) + BLOCK + content.slice(e + END.length);
  }
  const sep = content.length === 0 ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  return `${content}${sep}${BLOCK}\n`;
}

export function runInit(cwd: string = process.cwd()): { written: string[] } {
  const root = repoRootOf(cwd);
  const present = ["CLAUDE.md", "AGENTS.md"].map((f) => join(root, f)).filter((p) => existsSync(p));
  const targets = present.length > 0 ? present : [join(root, "AGENTS.md")];
  const written: string[] = [];
  for (const path of targets) {
    const cur = existsSync(path) ? readFileSync(path, "utf8") : "";
    const next = upsertBlock(cur);
    if (next !== cur) writeFileSync(path, next);
    written.push(path);
  }
  return { written };
}
