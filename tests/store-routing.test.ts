import { describe, expect, it } from "vitest";
import { useExplorerStore } from "@/lib/store";

describe("overview → clusters routing", () => {
  it("applies the promised clusters tab instead of silently dropping it", () => {
    const store = useExplorerStore.getState();
    expect(useExplorerStore.getState().clustersMode).toBe("exact");

    store.setClustersMode("near");
    store.setView("clusters", { manual: true });
    expect(useExplorerStore.getState().view).toBe("clusters");
    expect(useExplorerStore.getState().clustersMode).toBe("near");

    store.setClustersMode("name");
    expect(useExplorerStore.getState().clustersMode).toBe("name");
  });

  it("switching views leaves the clusters tab choice intact", () => {
    const store = useExplorerStore.getState();
    store.setClustersMode("near");
    store.setView("grid", { manual: true });
    store.setView("clusters", { manual: true });
    expect(useExplorerStore.getState().clustersMode).toBe("near");
  });
});
