import { Badge } from "@/components/ui/badge";
import { priorityLabel, statusLabel } from "@/lib/format";

const statusTone: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  running: "border-teal-200 bg-teal-50 text-teal-700",
  doing: "border-teal-200 bg-teal-50 text-teal-700",
  completed: "border-slate-200 bg-slate-50 text-slate-700",
  done: "border-slate-200 bg-slate-50 text-slate-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

export function StatusBadge({
  value,
  kind = "status",
}: {
  value: string;
  kind?: "status" | "priority";
}) {
  return (
    <Badge
      variant="outline"
      className={`rounded-md px-2 ${statusTone[value] ?? "border-stone-200 bg-stone-50 text-stone-700"}`}
    >
      {kind === "priority" ? priorityLabel(value) : statusLabel(value)}
    </Badge>
  );
}
