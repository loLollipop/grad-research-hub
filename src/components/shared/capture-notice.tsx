import { CheckCircle2 } from "lucide-react";

const labels: Record<string, string> = {
  admin: "事务",
  experiment: "实验",
  note: "笔记",
  paper: "文献",
  task: "任务",
};

export function CaptureNotice({ kind }: { kind?: string }) {
  if (!kind) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/92 px-4 py-3 text-sm text-emerald-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">快速捕捉已收好</p>
          <p className="mt-1 leading-6">
            已创建{labels[kind] ?? "记录"}，后续可以在当前页面继续补全细节。
          </p>
        </div>
      </div>
    </div>
  );
}
