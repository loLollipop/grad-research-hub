import type { Paper } from "@prisma/client";

import { parseTags } from "@/lib/format";

type BibtexPaper = Pick<
  Paper,
  | "title"
  | "authors"
  | "year"
  | "journal"
  | "doi"
  | "arxivId"
  | "bibtexKey"
  | "externalUrl"
  | "abstract"
  | "notes"
>;

function sanitizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function escapeBibtex(value: string) {
  return value.replace(/\\/g, "\\textbackslash{}").replace(/[{}]/g, (match) => `\\${match}`);
}

function field(name: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  return `  ${name} = {${escapeBibtex(String(value).trim())}}`;
}

export function paperToBibtex(paper: BibtexPaper) {
  const authors = parseTags(paper.authors).join(" and ");
  const key =
    paper.bibtexKey ||
    [authors.split(" ")[0], paper.year, sanitizeKey(paper.title)].filter(Boolean).join("-");
  const entryType = paper.journal || paper.doi ? "article" : "misc";
  const url = paper.externalUrl || (paper.arxivId ? `https://arxiv.org/abs/${paper.arxivId}` : null);

  const fields = [
    field("title", paper.title),
    field("author", authors),
    field("year", paper.year),
    field("journal", paper.journal),
    field("doi", paper.doi),
    field("eprint", paper.arxivId),
    field("archivePrefix", paper.arxivId ? "arXiv" : null),
    field("url", url),
    field("abstract", paper.abstract),
    field("note", paper.notes),
  ].filter(Boolean);

  return `@${entryType}{${sanitizeKey(key) || "paper"},\n${fields.join(",\n")}\n}`;
}

export function papersToBibtex(papers: BibtexPaper[]) {
  return papers.map(paperToBibtex).join("\n\n");
}
