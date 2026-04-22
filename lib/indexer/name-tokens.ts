const STOPWORDS = new Set([
  "icon",
  "ic",
  "img",
  "image",
  "asset",
  "logo",
  "pic",
  "filled",
  "fill",
  "outline",
  "outlined",
  "solid",
  "stroke",
  "regular",
  "bold",
  "light",
  "thin",
  "duotone",
  "twotone",
  "sm",
  "md",
  "lg",
  "xl",
  "xxs",
  "xs",
  "xxl",
  "small",
  "medium",
  "large",
  "circle",
  "square",
  "rounded",
  "round",
  "sharp",
  "active",
  "inactive",
  "disabled",
  "hover",
  "pressed",
  "default",
  "primary",
  "secondary",
  "tertiary",
  "red",
  "green",
  "blue",
  "yellow",
  "black",
  "white",
  "gray",
  "grey",
  "orange",
  "purple",
  "pink",
  "brown",
  "cyan",
  "magenta",
  "dark",
  "color",
  "colored",
  "mono",
  "monochrome",
  "colour",
  "padded",
  "padding",
  "margin",
  "new",
  "old",
  "legacy",
  "v1",
  "v2",
  "v3",
  "bg",
  "fg",
  "alt",
  "copy",
  "vertical",
  "horizontal",
  "left",
  "right",
  "top",
  "bottom",
  "up",
  "down",
  "primary",
  "secondary",
]);

const PIXEL_SIZES = new Set(
  [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 128, 256].map(String),
);

export function tokenize(stem: string): Set<string> {
  const parts = stem
    .toLowerCase()
    .split(/[-_\s.]+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    if (STOPWORDS.has(p)) continue;
    if (PIXEL_SIZES.has(p)) continue;
    if (p.length < 3) continue;
    if (/^\d+$/.test(p)) continue;
    out.add(p);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

export function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const t of a) if (b.has(t)) out.push(t);
  return out;
}
