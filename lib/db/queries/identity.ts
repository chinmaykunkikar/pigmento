import type { Db } from "../client";
import {
  type BrandColor,
  type CoverageReport,
  derivePalette,
  getColorStats,
  listColorDrift,
} from "./colors";
import { getOverviewCounts } from "./overview";
import {
  deriveFamilies,
  deriveSizeScale,
  deriveWeights,
  getTypographyStats,
  listTypeDrift,
  type TypeCoverage,
} from "./typography";

export type DesignIdentity = {
  palette: BrandColor[];
  colors: {
    coverage: CoverageReport;
    distinctColors: number;
    driftCount: number;
  };
  typography: {
    coverage: TypeCoverage;
    familyCount: number;
    sizeCount: number;
    weightCount: number;
    driftCount: number;
  };
  images: {
    totalAssets: number;
    duplicateGroups: number;
    unusedAssets: number;
    clusters: number;
  };
};

const HERO_PALETTE_SIZE = 10;

// One read for the overview home: the brand palette hero plus each kind's headline
// metrics, composed from the same derivations the (future) kind views use.
export function getDesignIdentity(db: Db, sourceId: number): DesignIdentity {
  const colorStats = getColorStats(db, sourceId);
  const typeStats = getTypographyStats(db, sourceId);
  const counts = getOverviewCounts(db, sourceId);

  return {
    palette: derivePalette(colorStats, HERO_PALETTE_SIZE),
    colors: {
      coverage: colorStats.coverage,
      distinctColors: colorStats.perColor.length,
      driftCount: listColorDrift(db, sourceId).length,
    },
    typography: {
      coverage: typeStats.coverage,
      familyCount: deriveFamilies(typeStats).length,
      sizeCount: deriveSizeScale(typeStats).length,
      weightCount: deriveWeights(typeStats).length,
      driftCount: listTypeDrift(db, sourceId).length,
    },
    images: {
      totalAssets: counts.totalAssets,
      duplicateGroups: counts.duplicateGroups,
      unusedAssets: counts.unusedAssets,
      clusters: counts.nearMatchClusters + counts.nameClusters,
    },
  };
}
