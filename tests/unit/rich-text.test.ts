import { expect, test } from "@playwright/test";

import {
  isSafeLink,
  plainTextFromRichDocument,
  richDocumentsEqual,
  sanitizeRichEntryDocument,
  sanitizeRichStyle,
} from "../../lib/rich-text";

function documentWith(child: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    editorState: {
      root: {
        children: [child],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  };
}

test("accepts the supported versioned editor shape", () => {
  const document = documentWith({
    children: [{ detail: 0, format: 1, mode: "normal", style: "color: #18332e", text: "A memory", type: "text", version: 1 }],
    direction: null,
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
  });
  expect(sanitizeRichEntryDocument(document)).not.toBeNull();
  expect(plainTextFromRichDocument(document)).toBe("A memory");
});

test("keeps only curated inline styles", () => {
  expect(sanitizeRichStyle("color: #18332e; position: fixed; font-size: 99px; background-color: #fde1d8")).toBe(
    "color: #18332e;background-color: #fde1d8;",
  );
});

test("rejects unsupported document versions, nodes and unsafe links", () => {
  expect(sanitizeRichEntryDocument({ schemaVersion: 2, editorState: { root: {} } })).toBeNull();
  expect(sanitizeRichEntryDocument(documentWith({ type: "image", version: 1 }))).toBeNull();
  expect(isSafeLink("javascript:alert(1)")).toBe(false);
  expect(isSafeLink("https://365x100.com/about")).toBe(true);
});

test("compares database-reordered rich documents semantically", () => {
  const left = sanitizeRichEntryDocument(documentWith({ type: "paragraph", version: 1, children: [] }));
  const right = sanitizeRichEntryDocument({
    editorState: {
      root: {
        version: 1,
        type: "root",
        indent: 0,
        format: "",
        direction: null,
        children: [{ version: 1, type: "paragraph", children: [] }],
      },
    },
    schemaVersion: 1,
  });
  expect(richDocumentsEqual(left, right)).toBe(true);
});
