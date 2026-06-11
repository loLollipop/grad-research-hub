import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/85 bg-white/58 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
        className,
      )}
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#eef6f4] text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
