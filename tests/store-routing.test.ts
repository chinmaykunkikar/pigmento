import { describe, expect, it } from "vitest";
import { useExplorerStore } from "@/lib/store";

describe("images sub-view routing", () => {
  it("applies the promised clusters tab instead of silently dropping it", () => {
    const store = useExplorerStore.getState();
    expect(useExplorerStore.getState().clustersMode).toBe("exact");

    store.setClustersMode("near");
    store.setImagesView("clusters");
    expect(useExplorerStore.getState().imagesView).toBe("clusters");
    expect(useExplorerStore.getState().clustersMode).toBe("near");

    store.setClustersMode("name");
    expect(useExplorerStore.getState().clustersMode).toBe("name");
  });

  it("switching sub-views leaves the clusters tab choice intact", () => {
    const store = useExplorerStore.getState();
    store.setClustersMode("near");
    store.setImagesView("grid");
    store.setImagesView("clusters");
    expect(useExplorerStore.getState().clustersMode).toBe("near");
  });

  it("switching a sub-view marks navigation manual so a re-index does not yank the user", () => {
    useExplorerStore.setState({ navManuallySet: false });
    useExplorerStore.getState().setImagesView("match");
    expect(useExplorerStore.getState().navManuallySet).toBe(true);
  });
});
