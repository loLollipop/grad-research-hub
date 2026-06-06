import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

export const AI_PROVIDER_OPTIONS = ["openai", "anthropic", "custom"] as const;

export type AiProvider = (typeof AI_PROVIDER_OPTIONS)[number];

export type AiSettings = {
  provider: AiProvider;
  apiKeyConfigured: boolean;
  baseUrl: string;
  model: string;
  updatedAt: Date | null;
};

const AI_PROVIDER_KEY = "ai.provider";
const AI_API_KEY_KEY = "ai.apiKey";
const AI_BASE_URL_KEY = "ai.baseUrl";
const AI_MODEL_KEY = "ai.model";

export async function getAiSettings(): Promise<AiSettings> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [AI_PROVIDER_KEY, AI_API_KEY_KEY, AI_BASE_URL_KEY, AI_MODEL_KEY],
      },
    },
  });

  const settings = new Map(rows.map((row) => [row.key, row]));
  const provider = providerOrDefault(settings.get(AI_PROVIDER_KEY)?.value);
  const apiKey = await getAiApiKeyFromSettings(settings.get(AI_API_KEY_KEY)?.value);
  const baseUrl =
    settings.get(AI_BASE_URL_KEY)?.value ||
    process.env.AI_BASE_URL ||
    defaultBaseUrl(provider);
  const model =
    settings.get(AI_MODEL_KEY)?.value || process.env.AI_MODEL || defaultModel(provider);

  return {
    provider,
    apiKeyConfigured: Boolean(apiKey),
    baseUrl,
    model,
    updatedAt:
      rows
        .map((row) => row.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
  };
}

export async function getAiRuntimeConfig() {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [AI_PROVIDER_KEY, AI_API_KEY_KEY, AI_BASE_URL_KEY, AI_MODEL_KEY],
      },
    },
  });

  const settings = new Map(rows.map((row) => [row.key, row]));
  const provider = providerOrDefault(settings.get(AI_PROVIDER_KEY)?.value);
  const envKey =
    provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  const apiKey = (await getAiApiKeyFromSettings(settings.get(AI_API_KEY_KEY)?.value)) || envKey || "";

  return {
    provider,
    apiKey,
    baseUrl:
      settings.get(AI_BASE_URL_KEY)?.value ||
      process.env.AI_BASE_URL ||
      defaultBaseUrl(provider),
    model:
      settings.get(AI_MODEL_KEY)?.value || process.env.AI_MODEL || defaultModel(provider),
  };
}

export async function saveAiSettings(input: {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}) {
  const provider = providerOrDefault(input.provider);
  const writes = [
    upsertSetting(AI_PROVIDER_KEY, provider, false),
    upsertSetting(
      AI_BASE_URL_KEY,
      input.baseUrl.trim() || defaultBaseUrl(provider),
      false,
    ),
    upsertSetting(AI_MODEL_KEY, input.model.trim() || defaultModel(provider), false),
  ];

  const apiKey = input.apiKey.trim();
  if (apiKey === "CLEAR") {
    await Promise.all(writes);
    await prisma.appSetting.deleteMany({ where: { key: AI_API_KEY_KEY } });
    return;
  } else if (apiKey) {
    writes.push(upsertSetting(AI_API_KEY_KEY, encryptSecret(apiKey), true));
  }

  await Promise.all(writes);
}

function upsertSetting(key: string, value: string, secret: boolean) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, secret },
    update: { value, secret },
  });
}

async function getAiApiKeyFromSettings(value: string | undefined) {
  if (!value) {
    return "";
  }

  return decryptSecret(value);
}

function providerOrDefault(value: string | undefined): AiProvider {
  if (value === "anthropic" || value === "custom") {
    return value;
  }

  return "openai";
}

function defaultBaseUrl(provider: AiProvider) {
  if (provider === "anthropic") {
    return "https://api.anthropic.com";
  }

  return "https://api.openai.com/v1";
}

function defaultModel(provider: AiProvider) {
  if (provider === "anthropic") {
    return "claude-sonnet-4-5";
  }

  return "gpt-5-mini";
}

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "";
  if (!secret) {
    throw new Error("保存 AI Key 前需要配置 APP_ENCRYPTION_KEY。");
  }

  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  if (!value.startsWith("v1:")) {
    return value;
  }

  const [, iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) {
    return "";
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
