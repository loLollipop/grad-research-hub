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
    <div className="dashboard-hero flex flex-col gap-4 rounded-2xl border border-border/70 px-5 py-5 shadow-[0_14px_34px_rgba(34,48,71,0.06)] md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[1.85rem] font-semibold leading-tight tracking-tight text-[#172b44]">
          {title}
        </h1>
        <p className="sr-only">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
