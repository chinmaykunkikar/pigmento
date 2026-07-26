import { Palette } from "@/components/icons";
import { KindPlaceholder } from "@/components/KindPlaceholder";

export default function ColorsPage() {
  return (
    <KindPlaceholder
      icon={<Palette size={18} strokeWidth={1.5} />}
      title="Colors"
      blurb="The palette browser is being built. Your colors and drift are already indexed and answerable through the MCP tools and CLI."
    />
  );
}
