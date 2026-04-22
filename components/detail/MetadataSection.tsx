"use client";

import type { Asset } from "@/lib/db/schema";
import { formatBytes, relativeTime } from "@/lib/time";
import { MetaRow } from "./MetaRow";
import { Section } from "./Section";

type Props = { asset: Asset };

export function MetadataSection({ asset }: Props) {
  const dims =
    asset.width && asset.height
      ? asset.viewBox
        ? `${asset.width} × ${asset.height} · viewBox ${asset.viewBox}`
        : `${asset.width} × ${asset.height}`
      : "—";

  const filesize = `${formatBytes(asset.size)} (${asset.size.toLocaleString()} bytes)`;
  const sha1 = `sha1:${asset.sha1.slice(0, 7)}…${asset.sha1.slice(-6)}`;
  const sha1Title = `sha1:${asset.sha1}`;

  const fill = asset.ext === "svg" ? (asset.hasFill ? "Yes" : "No (stroke only)") : "—";

  let strokes = "—";
  if (asset.ext === "svg") {
    const widths: string[] = asset.strokeWidths ? JSON.parse(asset.strokeWidths) : [];
    const paths = asset.pathsCount ?? 0;
    if (widths.length > 0) {
      strokes = `${widths.join(", ")} · ${paths} path${paths === 1 ? "" : "s"}`;
    } else if (paths > 0) {
      strokes = `${paths} path${paths === 1 ? "" : "s"}`;
    }
  }

  const modifiedDate = new Date(asset.mtime).toISOString();
  const modified = `${relativeTime(modifiedDate)}${asset.author ? ` · ${asset.author}` : ""}`;

  return (
    <Section title="Metadata">
      <MetaRow k="Path" v={asset.relPath} mono copy={asset.relPath} />
      <MetaRow k="Dimensions" v={dims} />
      <MetaRow k="Filesize" v={filesize} />
      <MetaRow k="Content hash">
        <span className="truncate font-mono text-[11px] text-text" title={sha1Title}>
          {sha1}
        </span>
      </MetaRow>
      <MetaRow k="Category" v={asset.category} pill />
      {asset.ext === "svg" ? <MetaRow k="Has fill" v={fill} /> : null}
      {asset.ext === "svg" ? <MetaRow k="Strokes" v={strokes} /> : null}
      <MetaRow k="Modified" v={modified} />
    </Section>
  );
}
