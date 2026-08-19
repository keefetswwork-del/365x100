import type { Json } from "@/lib/database.types";
import type { RichEntryDocument } from "@/lib/rich-text";
import type { PublicationDocument } from "@/types/publication";

export interface PublicationSpan {
  bold: boolean;
  italic: boolean;
  link: string | null;
  strike: boolean;
  text: string;
  underline: boolean;
}

export interface PublicationBlock {
  align: "center" | "justify" | "left" | "right";
  kind: "heading" | "list-item" | "paragraph" | "quote";
  level: number;
  ordered: boolean;
  spans: PublicationSpan[];
}

export interface PublicationPageEntry {
  blocks: PublicationBlock[];
  content: string;
  date: string;
  mediaId: string | null;
  title: string;
  wordCount: number;
}

export interface PublicationPageModel {
  coverMediaId: string | null;
  editorial: PublicationDocument["editorial"];
  entries: PublicationPageEntry[];
  mode: "ai" | "original";
  periodEnd: string;
  periodStart: string;
  title: string;
  totalWords: number;
  writingDays: number;
}

function record(value: unknown): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null;
}

function alignment(value: Json | undefined): PublicationBlock["align"] {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function collectSpans(node: Record<string, Json | undefined>, link: string | null = null): PublicationSpan[] {
  if (node.type === "text") {
    const format = typeof node.format === "number" ? node.format : 0;
    return [{
      bold: Boolean(format & 1),
      italic: Boolean(format & 2),
      link,
      strike: Boolean(format & 4),
      text: typeof node.text === "string" ? node.text : "",
      underline: Boolean(format & 8),
    }];
  }
  if (node.type === "linebreak") {
    return [{ bold: false, italic: false, link: null, strike: false, text: "\n", underline: false }];
  }
  const nextLink = node.type === "link" && typeof node.url === "string" ? node.url : link;
  return Array.isArray(node.children)
    ? node.children.flatMap((child) => {
      const item = record(child);
      return item ? collectSpans(item, nextLink) : [];
    })
    : [];
}

function blocksFromNode(node: Record<string, Json | undefined>, level = 0, ordered = false): PublicationBlock[] {
  if (node.type === "root") {
    return Array.isArray(node.children)
      ? node.children.flatMap((child) => {
        const item = record(child);
        return item ? blocksFromNode(item) : [];
      })
      : [];
  }
  if (node.type === "list") {
    const listOrdered = node.listType === "number";
    return Array.isArray(node.children)
      ? node.children.flatMap((child) => {
        const item = record(child);
        return item ? blocksFromNode(item, level + 1, listOrdered) : [];
      })
      : [];
  }
  if (node.type === "listitem") {
    return [{ align: alignment(node.format), kind: "list-item", level, ordered, spans: collectSpans(node) }];
  }
  const kind = node.type === "heading" ? "heading" : node.type === "quote" ? "quote" : "paragraph";
  return [{ align: alignment(node.format), kind, level, ordered, spans: collectSpans(node) }];
}

export function richBlocks(document: RichEntryDocument | null, plainText: string): PublicationBlock[] {
  const root = document ? record(document.editorState.root) : null;
  const blocks = root ? blocksFromNode(root) : [];
  if (blocks.length) return blocks;
  return plainText.split(/\n{2,}/).map((text) => ({
    align: "left",
    kind: "paragraph",
    level: 0,
    ordered: false,
    spans: [{ bold: false, italic: false, link: null, strike: false, text, underline: false }],
  }));
}

export function buildPublicationPageModel(document: PublicationDocument): PublicationPageModel {
  const entries = document.entries.map((entry) => ({
    blocks: richBlocks(entry.richContent, entry.content),
    content: entry.content,
    date: entry.entryDate,
    mediaId: entry.media?.id ?? null,
    title: entry.title,
    wordCount: entry.wordCount,
  }));
  return {
    coverMediaId: document.publication.coverMediaId,
    editorial: document.editorial,
    entries,
    mode: document.publication.mode,
    periodEnd: document.publication.periodEnd,
    periodStart: document.publication.periodStart,
    title: document.publication.title,
    totalWords: entries.reduce((sum, entry) => sum + entry.wordCount, 0),
    writingDays: entries.filter((entry) => entry.content.trim()).length,
  };
}

export function displayPublicationDate(date: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
