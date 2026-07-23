import { describe, expect, it } from "vitest";
import { extractFileType, type TypeUsageHit } from "@/lib/indexer/type-extract";

function extract(text: string, ext: string): TypeUsageHit[] {
  return extractFileType(text, ext, 1, `fixture.${ext}`, `/tmp/fixture.${ext}`);
}

describe("type extraction — CSS longhand", () => {
  const css = [
    ".a { font-size: 13px; }",
    ".b { font-size: 0.8125rem; }",
    '.c { font-family: "Inter", sans-serif; }',
    ".d { font-weight: bold; }",
    ".e { line-height: 1.5; }",
    ".f { font-size: var(--fs); }",
    ".g { font-size: 50%; }",
  ].join("\n");
  const hits = extract(css, "css");
  const at = (line: number) => hits.filter((h) => h.line === line);

  it("normalizes px and rem sizes to the same 16px-root value", () => {
    expect(at(1)[0]).toMatchObject({
      axis: "size",
      normalizedValue: "13",
      contextKind: "css-decl",
    });
    expect(at(2)[0]?.normalizedValue).toBe("13");
  });

  it("normalizes a font-family stack", () => {
    expect(at(3)[0]).toMatchObject({ axis: "family", normalizedValue: "inter, sans-serif" });
  });

  it("maps weight keywords to numbers and keeps unitless line-height as a ratio", () => {
    expect(at(4)[0]).toMatchObject({ axis: "weight", normalizedValue: "700" });
    expect(at(5)[0]).toMatchObject({ axis: "line-height", normalizedValue: "1.5" });
  });

  it("captures a var() reference with the axis known from the property", () => {
    expect(at(6)[0]).toMatchObject({
      axis: "size",
      contextKind: "css-var-ref",
      contextDetail: "--fs",
      normalizedValue: null,
    });
  });

  it("records an unresolvable unit as a raw usage with null normalized value", () => {
    expect(at(7)[0]).toMatchObject({ axis: "size", normalizedValue: null, rawToken: "50%" });
  });
});

describe("type extraction — JS is property-aware", () => {
  it("extracts type from style-object keys but not bare strings", () => {
    const obj = extract('const s = { fontSize: "16px", fontWeight: 600 };', "ts");
    expect(obj.find((h) => h.axis === "size")).toMatchObject({
      normalizedValue: "16",
      contextKind: "js-literal",
    });
    expect(obj.find((h) => h.axis === "weight")?.normalizedValue).toBe("600");
    expect(extract('const label = "16px is big";', "ts")).toHaveLength(0);
  });
});

describe("type extraction — family literal guard (dogfood gate)", () => {
  const families = (text: string, ext: string) =>
    extract(text, ext).filter((h) => h.axis === "family" && h.contextKind !== "tailwind-named");

  it("rejects JS expressions, type annotations, and template fragments as families", () => {
    expect(families("const s = { fontFamily: theme.typography.fontFamily };", "ts")).toHaveLength(
      0,
    );
    expect(families("const s = { fontFamily: t.typography.fontFamily };", "ts")).toHaveLength(0);
    expect(families("interface S { fontFamily: string }", "ts")).toHaveLength(0);
    expect(families("const s = { fontFamily: `var(${x})` };", "ts")).toHaveLength(0);
  });

  it("keeps a real quoted JS family", () => {
    expect(families('const s = { fontFamily: "Roboto, sans-serif" };', "ts")[0]).toMatchObject({
      normalizedValue: "roboto, sans-serif",
    });
  });

  it("rejects SCSS $vars and var()/interpolation in font-family", () => {
    expect(families(".a { font-family: $font-family-base; }", "scss")).toHaveLength(0);
    expect(families(".a { font-family: var(--#{$prefix}-font); }", "scss")).toHaveLength(0);
  });

  it("strips a trailing rtl comment from a CSS family stack", () => {
    const hits = families(
      ".a { font-family: Playfair Display, serif /*rtl:Amiri, serif*/; }",
      "css",
    );
    expect(hits[0]?.normalizedValue).toBe("playfair display, serif");
  });
});

describe("type extraction — test files and fixtures are skipped (dogfood gate)", () => {
  const css = ".a { font-size: 13px; font-family: Inter, sans-serif; }";
  it("extracts from a normal file but not from test/spec/fixture paths", () => {
    expect(
      extractFileType(css, "css", 1, "app/base.css", "/tmp/app/base.css").length,
    ).toBeGreaterThan(0);
    expect(extractFileType(css, "css", 1, "src/theme.spec.css", "/tmp/x")).toHaveLength(0);
    expect(extractFileType(css, "ts", 1, "src/__tests__/theme.ts", "/tmp/x")).toHaveLength(0);
    expect(extractFileType(css, "scss", 1, "tests/unit/_colors.scss", "/tmp/x")).toHaveLength(0);
  });
});

describe("type extraction — Tailwind type utilities", () => {
  it("tags text-size / font-weight / font-family / leading, not color utilities", () => {
    const hits = extract(
      '<p className="text-sm font-bold font-sans leading-6 text-red-500" />',
      "tsx",
    );
    const byAxis = (a: string) =>
      hits.filter((h) => h.axis === a && h.contextKind === "tailwind-named");
    expect(byAxis("size").map((h) => h.rawToken)).toEqual(["text-sm"]);
    expect(byAxis("weight").map((h) => h.rawToken)).toEqual(["font-bold"]);
    expect(byAxis("family").map((h) => h.rawToken)).toEqual(["font-sans"]);
    expect(byAxis("line-height").map((h) => h.rawToken)).toEqual(["leading-6"]);
    expect(hits.every((h) => h.normalizedValue === null)).toBe(true);
  });
});
