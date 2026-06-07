import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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
const ACCESS_PASSWORD_HASH_KEY = "access.passwordHash";
const ZOTERO_API_KEY_KEY = "zotero.apiKey";
const ZOTERO_LIBRARY_ID_KEY = "zotero.libraryId";
const ZOTERO_LIBRARY_TYPE_KEY = "zotero.libraryType";
const ZOTERO_COLLECTION_KEY = "zotero.collectionKey";
const ZOTERO_SYNC_LIMIT_KEY = "zotero.syncLimit";
const PASSWORD_HASH_ITERATIONS = 210_000;

export type AccessSettings = {
  configured: boolean;
  source: "settings" | "env" | "missing";
  updatedAt: Date | null;
};

export type ZoteroSettings = {
  ready: boolean;
  libraryId: string;
  libraryType: "user" | "group";
  collectionKey: string;
  syncLimit: number;
  apiKeyConfigured: boolean;
  updatedAt: Date | null;
};

export type ZoteroRuntimeConfig = ZoteroSettings & {
  apiKey: string;
};

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

export async function getAccessSettings(): Promise<AccessSettings> {
  const row = await prisma.appSetting.findUnique({
    where: { key: ACCESS_PASSWORD_HASH_KEY },
  });

  if (row?.value) {
    return {
      configured: true,
      source: "settings",
      updatedAt: row.updatedAt,
    };
  }

  if (process.env.APP_PASSWORD?.trim()) {
    return {
      configured: true,
      source: "env",
      updatedAt: null,
    };
  }

  return {
    configured: false,
    source: "missing",
    updatedAt: null,
  };
}

export async function verifyAccessPasswordInput(password: string) {
  const row = await prisma.appSetting.findUnique({
    where: { key: ACCESS_PASSWORD_HASH_KEY },
  });

  if (row?.value) {
    return verifyPasswordHash(password, row.value);
  }

  const expected = process.env.APP_PASSWORD?.trim();
  return Boolean(expected && constantTimeTextEqual(password, expected));
}

export async function saveAccessPassword(password: string) {
  await upsertSetting(ACCESS_PASSWORD_HASH_KEY, hashPassword(password), true);
}

export async function getZoteroSettings(): Promise<ZoteroSettings> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          ZOTERO_API_KEY_KEY,
          ZOTERO_LIBRARY_ID_KEY,
          ZOTERO_LIBRARY_TYPE_KEY,
          ZOTERO_COLLECTION_KEY,
          ZOTERO_SYNC_LIMIT_KEY,
        ],
      },
    },
  });
  const settings = new Map(rows.map((row) => [row.key, row]));
  const apiKey = await readSecretSetting(settings.get(ZOTERO_API_KEY_KEY)?.value);
  const libraryId =
    settings.get(ZOTERO_LIBRARY_ID_KEY)?.value || process.env.ZOTERO_LIBRARY_ID?.trim() || "";
  const storedLibraryType = settings.get(ZOTERO_LIBRARY_TYPE_KEY)?.value;
  const libraryType =
    storedLibraryType === "group" || storedLibraryType === "user"
      ? storedLibraryType
      : process.env.ZOTERO_LIBRARY_TYPE === "group"
        ? "group"
        : "user";
  const collectionKey =
    settings.get(ZOTERO_COLLECTION_KEY)?.value ||
    process.env.ZOTERO_COLLECTION_KEY?.trim() ||
    "";
  const syncLimit = numberOrDefault(
    settings.get(ZOTERO_SYNC_LIMIT_KEY)?.value || process.env.ZOTERO_SYNC_LIMIT,
    100,
  );
  const apiKeyConfigured = Boolean(apiKey || process.env.ZOTERO_API_KEY?.trim());

  return {
    ready: Boolean(libraryId && apiKeyConfigured),
    libraryId,
    libraryType,
    collectionKey,
    syncLimit,
    apiKeyConfigured,
    updatedAt:
      rows
        .map((row) => row.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
  };
}

export async function getZoteroRuntimeConfig(): Promise<ZoteroRuntimeConfig> {
  const settings = await getZoteroSettings();
  const storedKeyRow = await prisma.appSetting.findUnique({
    where: { key: ZOTERO_API_KEY_KEY },
  });
  const apiKey =
    (await readSecretSetting(storedKeyRow?.value)) || process.env.ZOTERO_API_KEY?.trim() || "";

  return {
    ...settings,
    apiKey,
    ready: Boolean(settings.libraryId && apiKey),
  };
}

export async function saveZoteroSettings(input: {
  apiKey: string;
  libraryId: string;
  libraryType: "user" | "group";
  collectionKey: string;
  syncLimit: number;
}) {
  const writes = [
    upsertSetting(ZOTERO_LIBRARY_ID_KEY, input.libraryId.trim(), false),
    upsertSetting(ZOTERO_LIBRARY_TYPE_KEY, input.libraryType, false),
    upsertSetting(ZOTERO_COLLECTION_KEY, input.collectionKey.trim(), false),
    upsertSetting(ZOTERO_SYNC_LIMIT_KEY, String(input.syncLimit), false),
  ];

  const apiKey = input.apiKey.trim();
  if (apiKey === "CLEAR") {
    await Promise.all(writes);
    await prisma.appSetting.deleteMany({ where: { key: ZOTERO_API_KEY_KEY } });
    return;
  }

  if (apiKey) {
    writes.push(upsertSetting(ZOTERO_API_KEY_KEY, encryptSecret(apiKey), true));
  }

  await Promise.all(writes);
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
  return readSecretSetting(value);
}

async function readSecretSetting(value: string | undefined) {
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

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 32, "sha256").toString(
    "base64url",
  );

  return `pbkdf2:v1:${PASSWORD_HASH_ITERATIONS}:${salt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string) {
  const [algorithm, version, iterations, salt, hash] = stored.split(":");
  if (algorithm !== "pbkdf2" || version !== "v1" || !iterations || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = pbkdf2Sync(password, salt, Number(iterations), expected.length, "sha256");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function constantTimeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function numberOrDefault(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
