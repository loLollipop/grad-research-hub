import { NextResponse } from "next/server";
import { z } from "zod";

import { getAiRuntimeConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

const aiRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
  context: z
    .object({
      page: z.string().optional(),
      selectedIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = aiRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请求格式不正确，请提供 prompt。" }, { status: 400 });
  }

  const runtime = await getAiRuntimeConfig();
  const configured = Boolean(runtime.apiKey);
  const prompt = parsed.data.prompt;

  return NextResponse.json({
    mode: "placeholder",
    configured,
    summary: configured
      ? `已读取设置中心的 ${runtime.provider} 配置：${runtime.model}。MVP 暂未接入真实模型调用，这里预留给后续 LLM、RAG 或 Zotero 同步工作流。`
      : "当前未配置模型 API Key。可以在设置中心填写 Key、Base URL 和模型名。",
    suggestedActions: [
      `收到请求：${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`,
      `当前 Base URL：${runtime.baseUrl}`,
      "后续可以把最近实验、未完成任务和文献笔记作为上下文注入。",
      "建议先支持周报提纲、实验复盘、论文阅读卡片三类低风险功能。",
    ],
  });
}
