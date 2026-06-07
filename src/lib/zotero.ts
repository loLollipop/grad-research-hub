import { tagsToString } from "@/lib/format";
import { getZoteroRuntimeConfig, getZoteroSettings } from "@/lib/settings";

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
};

export async function getZoteroConfigStatus(): Promise<ZoteroConfigStatus> {
  const settings = await getZoteroSettings();

  return {
    ready: settings.ready,
    libraryId: settings.libraryId,
    libraryType: settings.libraryType,
    collectionKey: settings.collectionKey,
    hasApiKey: settings.apiKeyConfigured,
  };
}

export async function fetchZoteroPapers(): Promise<ZoteroPaper[]> {
  const config = await getZoteroRuntimeConfig();
  const apiKey = config.apiKey;

  if (!config.ready || !apiKey) {
    throw new Error("Zotero 尚未配置：需要 ZOTERO_API_KEY 和 ZOTERO_LIBRARY_ID。");
  }

  const librarySegment = config.libraryType === "group" ? "groups" : "users";
  const basePath = `${ZOTERO_API_BASE}/${librarySegment}/${config.libraryId}`;
  const url = new URL(
    config.collectionKey
      ? `${basePath}/collections/${config.collectionKey}/items/top`
      : `${basePath}/items/top`,
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("include", "data");
  url.searchParams.set("limit", String(config.syncLimit));

  const response = await fetch(url, {
    headers: {
      "Zotero-API-Key": apiKey,
      "Zotero-API-Version": "3",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Zotero 同步失败：${response.status} ${response.statusText}`);
  }

  const items = (await response.json()) as ZoteroItem[];
  const syncedAt = new Date();

  return items
    .map((item) => mapZoteroItemToPaper(item, syncedAt))
    .filter((paper): paper is ZoteroPaper => Boolean(paper));
}

function mapZoteroItemToPaper(
  item: ZoteroItem,
  syncedAt: Date,
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
    category: data.collections?.[0] ?? data.itemType ?? "zotero",
    externalUrl: textOrUndefined(data.url),
    tags: tagsToString(tags),
    lastSyncedAt: syncedAt,
  };
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
