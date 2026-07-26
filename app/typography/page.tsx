import { Type } from "@/components/icons";
import { KindPlaceholder } from "@/components/KindPlaceholder";

export default function TypographyPage() {
  return (
    <KindPlaceholder
      icon={<Type size={18} strokeWidth={1.5} />}
      title="Typography"
      blurb="The type specimen is being built. Your families, sizes, and weights are already indexed and answerable through the MCP tools and CLI."
    />
  );
}
