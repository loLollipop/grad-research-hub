import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiDraft } from "@/lib/ai";
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
  const prompt = parsed.data.prompt;

  try {
    const draft = await createAiDraft({ ...runtime, prompt });
    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI 草稿生成失败。请检查 Key、Base URL、模型名或网关状态。",
      },
      { status: 502 },
    );
  }
}
