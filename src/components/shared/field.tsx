import { Label } from "@/components/ui/label";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-[var(--workspace-ink-soft)]">{label}</Label>
      {children}
      {hint ? <p className="line-clamp-1 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
