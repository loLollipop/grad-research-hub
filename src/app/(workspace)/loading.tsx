import { GraduationCap } from "lucide-react";

export default function WorkspaceLoading() {
  return (
    <div className="grid gap-6">
      <div className="cockpit-hero flex flex-col gap-3 rounded-2xl border border-border/65 p-5 shadow-[0_14px_34px_rgba(27,42,56,0.045)] md:flex-row md:items-end md:justify-between">
        <div className="grid gap-2">
          <div className="skeleton-block h-3 w-20" />
          <div className="skeleton-block h-8 w-44" />
          <div className="skeleton-block h-4 w-[min(520px,72vw)]" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-block h-9 w-24 rounded-lg" />
          <div className="skeleton-block h-9 w-28 rounded-lg" />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="workbench-card rounded-xl border p-4">
            <div className="flex gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#eef6f4] text-primary">
                <GraduationCap className="size-4 opacity-50" />
              </div>
              <div className="grid flex-1 gap-2">
                <div className="skeleton-block h-3 w-16" />
                <div className="skeleton-block h-6 w-20" />
                <div className="skeleton-block h-3 w-full" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="workbench-card h-72 rounded-xl border p-4">
          <div className="skeleton-block mb-4 h-5 w-36" />
          <div className="grid h-52 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="skeleton-block h-3 w-20" />
                <div className="skeleton-block h-5 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="workbench-card h-72 rounded-xl border p-4">
          <div className="skeleton-block mb-4 h-5 w-32" />
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="soft-tile rounded-xl p-3">
                <div className="skeleton-block mb-2 h-4 w-28" />
                <div className="skeleton-block h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
