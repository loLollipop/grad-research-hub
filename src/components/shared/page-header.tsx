export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
