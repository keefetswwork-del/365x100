import { getCSSFromStyleObject } from "@lexical/selection";
import { getStyleObjectFromCSS } from "lexical";

import type { Json } from "@/lib/database.types";

export const RICH_ENTRY_SCHEMA_VERSION = 1 as const;
export const MAX_RICH_ENTRY_BYTES = 1_000_000;

const ALLOWED_NODE_TYPES = new Set([
  "heading",
  "linebreak",
  "link",
  "list",
  "listitem",
  "paragraph",
  "quote",
  "root",
  "tab",
  "text",
]);

const ALLOWED_STYLES: Record<string, Set<string>> = {
  "background-color": new Set(["#fde1d8", "#f8edb8", "#dcebdc", "#dce9f5"]),
  color: new Set(["#18332e", "#7d3025", "#24513f", "#304f73"]),
  "font-family": new Set(["var(--font-newsreader)", "var(--font-manrope)"]),
  "font-size": new Set(["0.85em", "1em", "1.2em"]),
};

export interface RichEntryDocument {
  schemaVersion: typeof RICH_ENTRY_SCHEMA_VERSION;
  editorState: {
    root: Record<string, Json | undefined>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedNodeTree(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string" || !ALLOWED_NODE_TYPES.has(value.type)) {
    return false;
  }
  if (value.type === "link" && (typeof value.url !== "string" || !isSafeLink(value.url))) {
    return false;
  }
  return !Array.isArray(value.children) || value.children.every(isSupportedNodeTree);
}

export function sanitizeRichStyle(style: string): string {
  const safeStyles = Object.fromEntries(
    Object.entries(getStyleObjectFromCSS(style)).filter(
      ([property, value]) => ALLOWED_STYLES[property]?.has(value),
    ),
  );
  return getCSSFromStyleObject(safeStyles);
}

export function isSafeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeNode(value: unknown): Record<string, Json | undefined> | null {
  if (!isRecord(value) || typeof value.type !== "string" || !ALLOWED_NODE_TYPES.has(value.type)) {
    return null;
  }

  const node = { ...value } as Record<string, unknown>;
  if (typeof node.style === "string") {
    node.style = sanitizeRichStyle(node.style);
  }
  if (node.type === "link" && (typeof node.url !== "string" || !isSafeLink(node.url))) {
    return null;
  }
  if (Array.isArray(node.children)) {
    node.children = node.children.map(sanitizeNode).filter((child) => child !== null);
  }

  return node as Record<string, Json | undefined>;
}

export function sanitizeRichEntryDocument(value: unknown): RichEntryDocument | null {
  if (!isRecord(value) || value.schemaVersion !== RICH_ENTRY_SCHEMA_VERSION || !isRecord(value.editorState)) {
    return null;
  }
  if (!isSupportedNodeTree(value.editorState.root)) {
    return null;
  }
  const root = sanitizeNode(value.editorState.root);
  if (!root || root.type !== "root") {
    return null;
  }

  const document: RichEntryDocument = {
    schemaVersion: RICH_ENTRY_SCHEMA_VERSION,
    editorState: { root },
  };
  return JSON.stringify(document).length <= MAX_RICH_ENTRY_BYTES ? document : null;
}

function nodePlainText(node: Record<string, Json | undefined>): string {
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "linebreak") return "\n";
  if (node.type === "tab") return "\t";
  const children = Array.isArray(node.children)
    ? node.children.filter(isRecord).map((child) => nodePlainText(child as Record<string, Json | undefined>))
    : [];
  if (node.type === "root") return children.join("\n\n");
  if (node.type === "list") return children.join("\n");
  return children.join("");
}

export function plainTextFromRichDocument(value: unknown): string | null {
  const document = sanitizeRichEntryDocument(value);
  return document ? nodePlainText(document.editorState.root) : null;
}

export function richDocumentsEqual(
  left: RichEntryDocument | null,
  right: RichEntryDocument | null,
): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function asDatabaseJson(document: RichEntryDocument | null): Json | null {
  return document as unknown as Json | null;
}
