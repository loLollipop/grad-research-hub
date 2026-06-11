import { CheckCircle2 } from "lucide-react";

const labels: Record<string, string> = {
  admin: "事务",
  dataset: "数据来源",
  experiment: "实验",
  note: "笔记",
  paper: "文献",
  result: "结果证据",
  task: "任务",
};

export function CaptureNotice({ kind }: { kind?: string }) {
  if (!kind) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/92 px-3 py-2 text-xs text-emerald-900">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">已收进{labels[kind] ?? "记录"}</p>
        </div>
      </div>
    </div>
  );
}
