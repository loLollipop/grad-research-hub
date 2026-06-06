import { Badge } from "@/components/ui/badge";
import { parseTags } from "@/lib/format";

export function TagList({ value }: { value?: string | null }) {
  const tags = parseTags(value);

  if (!tags.length) {
    return <span className="text-xs text-muted-foreground">无标签</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="rounded-md px-1.5 py-0">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
