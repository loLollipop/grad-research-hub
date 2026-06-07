import { KeyRound, ServerCog, Sparkles } from "lucide-react";

import { AiWorkbench } from "@/components/ai/ai-workbench";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function AiPage() {
  const openaiReady = Boolean(process.env.OPENAI_API_KEY);
  const anthropicReady = Boolean(process.env.ANTHROPIC_API_KEY);

  const pipeline = [
    "读取近期待办、实验、文献和笔记摘要",
    "生成周报、组会提纲或下一步实验建议",
    "由用户确认后写回笔记或任务",
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="AI"
        title="AI 助手"
        description="先保留服务端接口和试验台；API Key、Base URL 和模型名在设置中心维护。"
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              助手试验台
            </CardTitle>
            <CardDescription>用于验证 `/api/ai` 的请求结构，后续可替换为真实模型调用。</CardDescription>
          </CardHeader>
          <CardContent>
            <AiWorkbench />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" />
                API Key 状态
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <EnvRow label="OPENAI_API_KEY" ready={openaiReady} />
              <EnvRow label="ANTHROPIC_API_KEY" ready={anthropicReady} />
              <p className="pt-2 text-xs leading-5 text-muted-foreground">
                首版不会把密钥暴露到浏览器。真实调用应只放在服务端 route handler 或
                Server Action 中，并为请求增加速率限制。
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ServerCog className="size-4" />
                计划中的工作流
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {pipeline.map((item, index) => (
                <div key={item} className="grid grid-cols-[2rem_1fr] items-start gap-2 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-md bg-[#eef4ef] font-medium text-[#1f3d33]">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-muted-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function EnvRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="font-mono text-xs">{label}</span>
      <span
        className={
          ready
            ? "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
            : "rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600"
        }
      >
        {ready ? "已配置" : "未配置"}
      </span>
    </div>
  );
}
