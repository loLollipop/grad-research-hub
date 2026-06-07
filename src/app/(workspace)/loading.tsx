import { GraduationCap } from "lucide-react";

export default function WorkspaceLoading() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-2">
          <div className="h-3 w-20 rounded-md bg-[#dfe8e1]" />
          <div className="h-8 w-44 rounded-md bg-[#d5e1d8]" />
          <div className="h-4 w-[min(520px,72vw)] rounded-md bg-[#edf1eb]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-[#edf1eb]" />
          <div className="h-9 w-28 rounded-lg bg-[#dfe8e1]" />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-white/95 p-4">
            <div className="flex gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#eef4ef] text-[#1f3d33]">
                <GraduationCap className="size-4 opacity-50" />
              </div>
              <div className="grid flex-1 gap-2">
                <div className="h-3 w-16 rounded-md bg-[#edf1eb]" />
                <div className="h-6 w-20 rounded-md bg-[#dfe8e1]" />
                <div className="h-3 w-full rounded-md bg-[#f1f2ec]" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="h-72 rounded-lg border bg-white/95 p-4">
          <div className="mb-4 h-5 w-36 rounded-md bg-[#dfe8e1]" />
          <div className="grid h-52 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-3 w-20 rounded-md bg-[#edf1eb]" />
                <div className="h-5 flex-1 rounded-md bg-[#eef4ef]" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-72 rounded-lg border bg-[#fbfcfd] p-4">
          <div className="mb-4 h-5 w-32 rounded-md bg-[#dfe8e1]" />
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-lg border bg-white/70 p-3">
                <div className="mb-2 h-4 w-28 rounded-md bg-[#dfe8e1]" />
                <div className="h-3 w-full rounded-md bg-[#edf1eb]" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
