import type { AiProvider } from "@/lib/settings";

export type AiConnectionStatus = "success" | "warning" | "error";

export type AiConnectionResult = {
  status: AiConnectionStatus;
  message: string;
};

export type AiDraftResult = {
  configured: boolean;
  mode: "live" | "placeholder";
  provider: AiProvider;
  summary: string;
  suggestedActions: string[];
};

export async function checkAiConnection(input: {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<AiConnectionResult> {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();

  if (!apiKey) {
    return {
      status: "error",
      message: "AI Key 还没有配置。请粘贴 Key，或先保存已有配置后再测试。",
    };
  }

  if (!model) {
    return {
      status: "error",
      message: "模型名不能为空。请填写当前网关支持的模型名。",
    };
  }

  let endpoint: URL;
  try {
    endpoint = aiModelsEndpoint(input.baseUrl, input.provider);
  } catch {
    return {
      status: "error",
      message: "Base URL 不是合法 URL。请检查是否包含 https://。",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: aiHeaders(input.provider, apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (response.ok) {
      return {
        status: "success",
        message: `AI 连接测试通过：已连到 ${endpoint.hostname}，当前模型配置为 ${model}。`,
      };
    }

    if (response.status === 404) {
      return {
        status: "warning",
        message:
          "AI 服务可达，但 /models 探测端点不可用。部分中转网关会这样，聊天接口后续仍可能可用。",
      };
    }

    if (response.status === 429) {
      return {
        status: "warning",
        message: "AI 服务可达，但当前被限流。稍后再试，或检查套餐/额度。",
      };
    }

    const body = await compactResponseText(response);
    return {
      status: "error",
      message: `AI 连接失败：${response.status} ${response.statusText}${body ? `，${body}` : ""}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `AI 连接失败：${error.message}`
          : "AI 连接失败：网络不可达或请求超时。",
    };
  }
}

export async function createAiDraft(input: {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}): Promise<AiDraftResult> {
  const apiKey = input.apiKey.trim();
  const prompt = input.prompt.trim();
  const model = input.model.trim();

  if (!apiKey) {
    return {
      configured: false,
      mode: "placeholder",
      provider: input.provider,
      summary: "当前未配置模型 API Key。可以在设置中心填写 Key、Base URL 和模型名。",
      suggestedActions: [
        "先到设置中心保存 AI Key。",
        "只粘贴已经脱敏的研究材料。",
        "配置完成后回到这里生成组会、复盘、阅读或写作草稿。",
      ],
    };
  }

  if (!model) {
    throw new Error("模型名不能为空。请到设置中心填写当前网关支持的模型名。");
  }

  const endpoint = aiChatEndpoint(input.baseUrl, input.provider);
  const response =
    input.provider === "anthropic"
      ? await callAnthropicMessages(endpoint, apiKey, model, prompt)
      : await callOpenAiCompatibleChat(endpoint, apiKey, model, prompt);

  return {
    configured: true,
    mode: "live",
    provider: input.provider,
    summary: response.text,
    suggestedActions: [
      "核对事实、引用和结论，不要直接复制进论文或周报。",
      "把可用段落保存到笔记页，继续补证据和链接。",
      response.usage ? `模型用量：${response.usage}` : `调用端点：${endpoint.hostname}`,
    ],
  };
}

function aiModelsEndpoint(baseUrl: string, provider: AiProvider) {
  const base = new URL(baseUrl.trim());
  const normalizedPath = base.pathname.replace(/\/+$/, "");
  const path =
    provider === "anthropic" && normalizedPath === ""
      ? "/v1/models"
      : normalizedPath.endsWith("/models")
        ? normalizedPath
        : `${normalizedPath || ""}/models`;

  return new URL(path, base.origin);
}

function aiChatEndpoint(baseUrl: string, provider: AiProvider) {
  const base = new URL(baseUrl.trim());
  const normalizedPath = base.pathname.replace(/\/+$/, "");
  const path =
    provider === "anthropic"
      ? normalizedPath.endsWith("/messages")
        ? normalizedPath
        : `${normalizedPath || "/v1"}/messages`
      : normalizedPath.endsWith("/chat/completions")
        ? normalizedPath
        : `${normalizedPath || "/v1"}/chat/completions`;

  return new URL(path, base.origin);
}

function aiHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function compactResponseText(response: Response) {
  const text = await response.text().catch(() => "");
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function callOpenAiCompatibleChat(
  endpoint: URL,
  apiKey: string,
  model: string,
  prompt: string,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: aiHeaders("openai", apiKey),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: researchDraftSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await compactResponseText(response);
    throw new Error(`AI 草稿生成失败：${response.status} ${response.statusText}${body ? `，${body}` : ""}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: {
      completion_tokens?: number;
      output_tokens?: number;
      prompt_tokens?: number;
      total_tokens?: number;
    };
  };
  const text = openAiContentText(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("AI 返回为空。可以换一个模型，或把输入材料写得更具体。");
  }

  return {
    text,
    usage: usageText(payload.usage),
  };
}

async function callAnthropicMessages(
  endpoint: URL,
  apiKey: string,
  model: string,
  prompt: string,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: aiHeaders("anthropic", apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: researchDraftSystemPrompt(),
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await compactResponseText(response);
    throw new Error(`AI 草稿生成失败：${response.status} ${response.statusText}${body ? `，${body}` : ""}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ text?: string; type?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  const text = (payload.content ?? [])
    .map((part) => (part.type === "text" ? part.text?.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
  if (!text) {
    throw new Error("AI 返回为空。可以换一个模型，或把输入材料写得更具体。");
  }

  return {
    text,
    usage: payload.usage
      ? `输入 ${payload.usage.input_tokens ?? 0} / 输出 ${payload.usage.output_tokens ?? 0} tokens`
      : "",
  };
}

function openAiContentText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String(part.text ?? "");
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function usageText(
  usage:
    | {
        completion_tokens?: number;
        output_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
      }
    | undefined,
) {
  if (!usage) return "";

  const output = usage.completion_tokens ?? usage.output_tokens ?? 0;
  return `输入 ${usage.prompt_tokens ?? 0} / 输出 ${output} / 总计 ${usage.total_tokens ?? 0} tokens`;
}

function researchDraftSystemPrompt() {
  return [
    "你是研途 Hub 的科研草稿助手，服务理工科研究生。",
    "只根据用户提供的材料整理结构化草稿，不编造事实、数据、引用或结论。",
    "输出中文，保持简洁、可执行，优先给组会、实验复盘、阅读卡片和写作润色可用的内容。",
    "如果材料不足，明确列出需要用户补充的信息。",
  ].join("\n");
}
