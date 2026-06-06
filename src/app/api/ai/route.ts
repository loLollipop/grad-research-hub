import { NextResponse } from "next/server";
import { z } from "zod";

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

  const configured = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const prompt = parsed.data.prompt;

  return NextResponse.json({
    mode: "placeholder",
    configured,
    summary: configured
      ? "已检测到服务端 API Key。MVP 暂未接入真实模型调用，这里预留给后续 LLM、RAG 或 Zotero 同步工作流。"
      : "当前未配置模型 API Key。接口已工作，但只返回占位结果，方便先完成产品骨架和权限边界。",
    suggestedActions: [
      `收到请求：${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`,
      "后续可以把最近实验、未完成任务和文献笔记作为上下文注入。",
      "建议先支持周报提纲、实验复盘、论文阅读卡片三类低风险功能。",
    ],
  });
}
