import type { AiProvider } from "@/lib/settings";

export type AiConnectionStatus = "success" | "warning" | "error";

export type AiConnectionResult = {
  status: AiConnectionStatus;
  message: string;
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

function aiHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  }

  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

async function compactResponseText(response: Response) {
  const text = await response.text().catch(() => "");
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}
