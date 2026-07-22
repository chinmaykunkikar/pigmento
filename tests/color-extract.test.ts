import { describe, expect, it } from "vitest";
import { type ColorUsageHit, extractColors, extractFileColors } from "@/lib/indexer/color-extract";
import { createTestDb, seedAsset, seedSource } from "./helpers/test-db";

function extract(text: string, ext: string): ColorUsageHit[] {
  return extractFileColors(text, ext, 1, `fixture.${ext}`, `/tmp/fixture.${ext}`);
}

describe("color extraction — CSS grammar", () => {
  const css = [
    ".a { color: #402678; }",
    ".b { background: red; }",
    ":root { --brand: #3f2678; }",
    ".c { color: var(--brand); }",
    ".d { font-family: Georgia, serif; }",
    "#face { color: #1c7a74; }",
  ].join("\n");
  const hits = extract(css, "css");
  const at = (line: number) => hits.filter((h) => h.line === line);

  it("extracts a hex literal as css-decl with the property as contextDetail", () => {
    const h = at(1)[0];
    expect(h?.contextKind).toBe("css-decl");
    expect(h?.contextDetail).toBe("color");
    expect(h?.normalizedValue).toBe("#402678");
  });

  it("extracts a named color only in a color-bearing declaration value", () => {
    const h = at(2)[0];
    expect(h?.contextKind).toBe("css-decl");
    expect(h?.normalizedValue).toBe("#ff0000");
    expect(h?.rawToken).toBe("red");
  });

  it("tags a custom-property definition as css-var-def", () => {
    const h = at(3)[0];
    expect(h?.contextKind).toBe("css-var-def");
    expect(h?.contextDetail).toBe("--brand");
    expect(h?.normalizedValue).toBe("#3f2678");
  });

  it("captures a var() reference site with a null normalized color", () => {
    const h = at(4)[0];
    expect(h?.contextKind).toBe("css-var-ref");
    expect(h?.contextDetail).toBe("--brand");
    expect(h?.normalizedValue).toBeNull();
  });

  it("does not treat font-family identifiers as named colors", () => {
    expect(at(5)).toHaveLength(0);
  });

  it("ignores id selectors that are not declaration values", () => {
    const declHit = at(6).find((h) => h.contextKind === "css-decl");
    expect(declHit?.normalizedValue).toBe("#1c7a74");
    expect(at(6).every((h) => h.contextKind === "css-decl")).toBe(true);
  });
});

describe("color extraction — JS/JSX grammar", () => {
  it("extracts hex string literals as js-literal", () => {
    const h = extract('const c = "#402678";', "ts")[0];
    expect(h?.contextKind).toBe("js-literal");
    expect(h?.normalizedValue).toBe("#402678");
  });

  it("named-color guard: bare color words in JS are not extracted", () => {
    expect(extract('const status = "red";', "ts")).toHaveLength(0);
  });

  it("extracts a Tailwind arbitrary value without double-counting the inner hex", () => {
    const hits = extract('<div className="bg-[#402678] text-red-500" />', "tsx");
    const arb = hits.filter((h) => h.contextKind === "tailwind-arbitrary");
    const named = hits.filter((h) => h.contextKind === "tailwind-named");
    expect(hits.filter((h) => h.contextKind === "js-literal")).toHaveLength(0);
    expect(arb).toHaveLength(1);
    expect(arb[0]?.normalizedValue).toBe("#402678");
    expect(arb[0]?.contextDetail).toBe("bg");
    expect(named).toHaveLength(1);
    expect(named[0]?.normalizedValue).toBeNull();
  });
});

describe("color extraction — false-positive mitigation", () => {
  it("rejects hex-like non-colors of invalid length (commit SHAs)", () => {
    expect(extract('const sha = "#abc1234";', "ts")).toHaveLength(0);
  });

  it("skips colors inside comments", () => {
    expect(extract("const x = 1; // color: #ffffff", "ts")).toHaveLength(0);
  });

  it("skips minified files with an overlong line", () => {
    const long = `.a{color:#402678}${" ".repeat(60_000)}`;
    expect(extract(long, "css")).toHaveLength(0);
  });

  it("skips prose/data grammars entirely", () => {
    expect(extract("the color is #402678 and red", "md")).toHaveLength(0);
    expect(extract('{ "primary": "#402678" }', "json")).toHaveLength(0);
  });
});

describe("color extraction — SVG literalColors ingestion", () => {
  it("emits svg-attr rows from assets.literalColors with a null line", async () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      const asset = seedAsset(t.db, sourceId, {
        name: "logo.svg",
        relPath: "icons/logo.svg",
        literalColors: JSON.stringify(["#402678", "rgb(255, 0, 0)"]),
      });
      const hits = await extractColors({
        sourceId,
        codeRoots: ["/nonexistent-pika-dir"],
        ignore: [],
        assets: [asset],
      });
      const svg = hits.filter((h) => h.contextKind === "svg-attr");
      expect(svg).toHaveLength(2);
      expect(svg.every((h) => h.line === null)).toBe(true);
      expect(svg.map((h) => h.normalizedValue).sort()).toEqual(["#402678", "#ff0000"]);
    } finally {
      t.cleanup();
    }
  });
});
