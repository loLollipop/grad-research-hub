import { tagsToString } from "@/lib/format";
import {
  getZoteroRuntimeConfig,
  getZoteroSettings,
  getZoteroSyncCursor,
  saveZoteroSyncCursor,
} from "@/lib/settings";

const ZOTERO_API_BASE = "https://api.zotero.org";

type ZoteroCreator = {
  firstName?: string;
  lastName?: string;
  name?: string;
};

type ZoteroTag = {
  tag?: string;
};

type ZoteroItemData = {
  key: string;
  itemType?: string;
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  abstractNote?: string;
  publicationTitle?: string;
  conferenceName?: string;
  proceedingsTitle?: string;
  journalAbbreviation?: string;
  DOI?: string;
  url?: string;
  archiveID?: string;
  libraryCatalog?: string;
  collections?: string[];
  tags?: ZoteroTag[];
};

type ZoteroItem = {
  key: string;
  data: ZoteroItemData;
};

type ZoteroCollection = {
  key: string;
  data?: {
    name?: string;
  };
};

export type ZoteroPaper = {
  title: string;
  authors: string;
  year?: number;
  abstract?: string;
  journal?: string;
  doi?: string;
  arxivId?: string;
  zoteroKey: string;
  category: string;
  externalUrl?: string;
  tags: string;
  lastSyncedAt: Date;
};

export type ZoteroConfigStatus = {
  ready: boolean;
  libraryId: string;
  libraryType: "user" | "group";
  collectionKey: string;
  hasApiKey: boolean;
  syncLimit: number;
};

export type ZoteroConnectionResult = {
  ok: boolean;
  message: string;
};

export type ZoteroSyncSummary = {
  cursorUpdatedAt: Date | null;
  fetchedItems: number;
  incremental: boolean;
  importedPapers: number;
  libraryVersion: number | null;
  requestedLimit: number;
  sinceVersion: number | null;
  scopeLabel: string;
  totalResults: number | null;
  hasMore: boolean;
};

export type ZoteroSyncResult = {
  papers: ZoteroPaper[];
  summary: ZoteroSyncSummary;
};

export async function getZoteroConfigStatus(): Promise<ZoteroConfigStatus> {
  const settings = await getZoteroSettings();

  return {
    ready: settings.ready,
    libraryId: settings.libraryId,
    libraryType: settings.libraryType,
    collectionKey: settings.collectionKey,
    hasApiKey: settings.apiKeyConfigured,
    syncLimit: settings.syncLimit,
  };
}

export async function fetchZoteroPapers(): Promise<ZoteroSyncResult> {
  const config = await getZoteroRuntimeConfig();
  const apiKey = config.apiKey;

  if (!config.ready || !apiKey) {
    throw new Error("Zotero 尚未配置：需要 ZOTERO_API_KEY 和 ZOTERO_LIBRARY_ID。");
  }

  const cursor = await getZoteroSyncCursor(config);
  const [itemResult, collectionNames] = await Promise.all([
    fetchZoteroItems(config, apiKey, cursor.version),
    fetchZoteroCollectionNames(config, apiKey),
  ]);
  const syncedAt = new Date();
  const papers = itemResult.items
    .map((item) => mapZoteroItemToPaper(item, syncedAt, collectionNames))
    .filter((paper): paper is ZoteroPaper => Boolean(paper));
  const scopeLabel = config.collectionKey
    ? collectionNames.get(config.collectionKey) ?? config.collectionKey
    : "库内顶层文献";
  const hasMore =
    itemResult.totalResults !== null
      ? itemResult.totalResults > itemResult.items.length
      : itemResult.items.length >= itemResult.requestedLimit;

  if (itemResult.libraryVersion && !hasMore) {
    await saveZoteroSyncCursor(config, itemResult.libraryVersion);
  }

  return {
    papers,
    summary: {
      cursorUpdatedAt: cursor.updatedAt,
      fetchedItems: itemResult.items.length,
      incremental: Boolean(cursor.version),
      importedPapers: papers.length,
      libraryVersion: itemResult.libraryVersion,
      requestedLimit: itemResult.requestedLimit,
      sinceVersion: cursor.version,
      scopeLabel,
      totalResults: itemResult.totalResults,
      hasMore,
    },
  };
}

async function fetchZoteroItems(
  config: {
    collectionKey: string;
    libraryId: string;
    libraryType: "user" | "group";
    syncLimit: number;
  },
  apiKey: string,
  sinceVersion: number | null,
) {
  const pageSize = 100;
  const target = Math.min(Math.max(config.syncLimit, 1), 500);
  const items: ZoteroItem[] = [];
  let totalResults: number | null = null;
  let libraryVersion: number | null = null;

  for (let start = 0; start < target; start += pageSize) {
    const url = zoteroItemsUrl(config);
    url.searchParams.set("format", "json");
    url.searchParams.set("include", "data");
    url.searchParams.set("limit", String(Math.min(pageSize, target - start)));
    url.searchParams.set("start", String(start));
    if (sinceVersion) {
      url.searchParams.set("since", String(sinceVersion));
    }

    const response = await fetch(url, {
      headers: zoteroHeaders(apiKey),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(zoteroHttpErrorMessage(response.status, response.statusText));
    }

    const totalHeader = response.headers.get("Total-Results");
    if (totalHeader && totalResults === null) {
      const parsed = Number(totalHeader);
      totalResults = Number.isFinite(parsed) ? parsed : null;
    }

    const libraryVersionHeader = response.headers.get("Last-Modified-Version");
    if (libraryVersionHeader) {
      const parsed = Number(libraryVersionHeader);
      if (Number.isInteger(parsed) && parsed > 0) {
        libraryVersion = Math.max(libraryVersion ?? 0, parsed);
      }
    }

    const page = (await response.json()) as ZoteroItem[];
    items.push(...page);

    if (page.length < Math.min(pageSize, target - start)) {
      break;
    }
  }

  return {
    items,
    libraryVersion,
    requestedLimit: target,
    totalResults,
  };
}

export async function checkZoteroConnection(input: {
  apiKey: string;
  libraryId: string;
  libraryType: "user" | "group";
  collectionKey: string;
  syncLimit: number;
}): Promise<ZoteroConnectionResult> {
  const apiKey = input.apiKey.trim();
  const libraryId = input.libraryId.trim();

  if (!apiKey || !libraryId) {
    return {
      ok: false,
      message: "Zotero 需要 API Key 和 Library ID。可以先粘贴 Key，再点测试。",
    };
  }

  const url = zoteroItemsUrl({ ...input, libraryId });
  url.searchParams.set("format", "json");
  url.searchParams.set("include", "data");
  url.searchParams.set("limit", String(Math.min(Math.max(input.syncLimit, 1), 10)));

  try {
    const response = await fetch(url, {
      headers: zoteroHeaders(apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: zoteroHttpErrorMessage(response.status, response.statusText),
      };
    }

    const totalHeader = response.headers.get("Total-Results");
    const totalResults = totalHeader && Number.isFinite(Number(totalHeader)) ? Number(totalHeader) : null;
    const items = (await response.json()) as ZoteroItem[];
    const readableItems = items
      .map((item) => mapZoteroItemToPaper(item, new Date(), new Map()))
      .filter(Boolean).length;

    return {
      ok: true,
      message:
        readableItems > 0
          ? `Zotero 连接正常，测试读取到 ${readableItems} 条文献${totalResults !== null ? `，当前范围共 ${totalResults} 条` : ""}。`
          : "Zotero 连接正常，但这个范围暂时没有可同步文献。可以检查 Collection Key 或同步数量。",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Zotero 连接失败：${error.message}`
          : "Zotero 连接失败：网络不可达或请求超时。",
    };
  }
}

function zoteroHttpErrorMessage(status: number, statusText: string) {
  if (status === 400) {
    return "Zotero 请求格式不正确。请检查 Collection Key 是否完整，Library Type 是否选对。";
  }

  if (status === 401 || status === 403) {
    return "Zotero 权限不足。请确认 API Key 允许读取当前个人库/群组库。";
  }

  if (status === 404) {
    return "Zotero 没有找到这个库或集合。请检查 Library ID、库类型和 Collection Key。";
  }

  if (status === 429) {
    return "Zotero 请求过于频繁。请稍等一会儿再同步。";
  }

  return `Zotero 同步失败：${status} ${statusText}`;
}

function zoteroItemsUrl(config: {
  libraryType: "user" | "group";
  libraryId: string;
  collectionKey: string;
}) {
  const librarySegment = config.libraryType === "group" ? "groups" : "users";
  const basePath = `${ZOTERO_API_BASE}/${librarySegment}/${config.libraryId}`;

  return new URL(
    config.collectionKey
      ? `${basePath}/collections/${config.collectionKey}/items/top`
      : `${basePath}/items/top`,
  );
}

async function fetchZoteroCollectionNames(
  config: {
    libraryType: "user" | "group";
    libraryId: string;
  },
  apiKey: string,
) {
  const librarySegment = config.libraryType === "group" ? "groups" : "users";
  const url = new URL(`${ZOTERO_API_BASE}/${librarySegment}/${config.libraryId}/collections`);
  url.searchParams.set("format", "json");
  url.searchParams.set("include", "data");
  url.searchParams.set("limit", "100");

  try {
    const response = await fetch(url, {
      headers: zoteroHeaders(apiKey),
      cache: "no-store",
    });

    if (!response.ok) return new Map<string, string>();

    const collections = (await response.json()) as ZoteroCollection[];
    return new Map(
      collections
        .map((collection) => [collection.key, collection.data?.name?.trim()] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])),
    );
  } catch {
    return new Map<string, string>();
  }
}

function zoteroHeaders(apiKey: string) {
  return {
    "Zotero-API-Key": apiKey,
    "Zotero-API-Version": "3",
  };
}

function mapZoteroItemToPaper(
  item: ZoteroItem,
  syncedAt: Date,
  collectionNames: Map<string, string>,
): ZoteroPaper | null {
  const data = item.data;
  const title = data.title?.trim();

  if (!title || data.itemType === "attachment" || data.itemType === "note") {
    return null;
  }

  const tags = (data.tags ?? [])
    .map((tag) => tag.tag?.trim())
    .filter((tag): tag is string => Boolean(tag));

  return {
    title,
    authors: tagsToString(formatCreators(data.creators ?? [])),
    year: yearFromDate(data.date),
    abstract: textOrUndefined(data.abstractNote),
    journal: textOrUndefined(
      data.publicationTitle ??
        data.conferenceName ??
        data.proceedingsTitle ??
        data.journalAbbreviation ??
        data.libraryCatalog,
    ),
    doi: textOrUndefined(data.DOI),
    arxivId: arxivFromArchiveId(data.archiveID),
    zoteroKey: data.key ?? item.key,
    category: collectionLabel(data.collections, collectionNames, data.itemType),
    externalUrl: textOrUndefined(data.url),
    tags: tagsToString(tags),
    lastSyncedAt: syncedAt,
  };
}

function collectionLabel(
  collections: string[] | undefined,
  collectionNames: Map<string, string>,
  fallback: string | undefined,
) {
  const collectionKey = collections?.[0];
  if (collectionKey) {
    return collectionNames.get(collectionKey) ?? collectionKey;
  }

  return fallback ?? "zotero";
}

function formatCreators(creators: ZoteroCreator[]) {
  return creators
    .map((creator) => {
      if (creator.name) {
        return creator.name;
      }

      return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
    })
    .map((name) => name.trim())
    .filter(Boolean);
}

function yearFromDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function arxivFromArchiveId(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const cleaned = value.replace(/^arXiv:/i, "").trim();
  return cleaned.length ? cleaned : undefined;
}

function textOrUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : undefined;
}
