import { expect, test } from "@playwright/test";

import { buildPublicationPageModel, richBlocks } from "../../lib/publication-document";
import { parsePublicationLibrary, sanitizePublicationEditorial } from "../../lib/publications";
import type { RichEntryDocument } from "../../lib/rich-text";

test("parses eligible months without accepting journal content in library metadata", () => {
  const library = parsePublicationLibrary({
    aiEntitled: true,
    disclosureVersion: "2026-08-19",
    generationLimit: 1,
    sectionRegenerationLimit: 5,
    items: [{
      eligible: true,
      ended: true,
      entryCount: 12,
      monthEnd: "2026-07-31",
      monthStart: "2026-07-01",
      publication: null,
      words: 2400,
      writingDays: 10,
    }],
  });
  expect(library.aiEntitled).toBe(true);
  expect(library.items[0]).toMatchObject({ eligible: true, writingDays: 10 });
  expect(JSON.stringify(library)).not.toContain("journal content");
});

test("validates the versioned editorial structure", () => {
  expect(sanitizePublicationEditorial({
    moments: [{ date: "2026-07-03", sourceRef: "entry-3", text: "A remembered walk." }],
    quotations: [{ date: "2026-07-03", quote: "The rain arrived.", sourceRef: "entry-3" }],
    review: "A month shaped by small returns.",
    themes: ["home", "change"],
    title: "July, in motion",
    version: 1,
  })).not.toBeNull();
  expect(sanitizePublicationEditorial({ title: "Incomplete", version: 1 })).toBeNull();
});

test("converts supported rich formatting into the shared preview and PDF model", () => {
  const rich: RichEntryDocument = {
    schemaVersion: 1,
    editorState: { root: {
      children: [{ children: [{ format: 3, text: "Bold and italic", type: "text" }], format: "center", type: "paragraph" }],
      type: "root",
    } },
  };
  const blocks = richBlocks(rich, "Bold and italic");
  expect(blocks[0]).toMatchObject({ align: "center", kind: "paragraph" });
  expect(blocks[0].spans[0]).toMatchObject({ bold: true, italic: true, text: "Bold and italic" });

  const model = buildPublicationPageModel({
    editorial: null,
    entries: [{ content: "Bold and italic", entryDate: "2026-07-03", id: "entry", media: null, richContent: rich, title: "A title", version: 2, wordCount: 3 }],
    publication: {
      approvedVersionId: null, coverMediaId: null, coverSource: "default", coverUploadPath: null, currentDraftVersionId: null, generationCount: 0,
      id: "publication", mode: "original", periodEnd: "2026-07-31", periodStart: "2026-07-01",
      scope: "monthly", sectionRegenerationCount: 0, staleReason: null, state: "ready", title: "July", updatedAt: "2026-08-01T00:00:00Z",
    },
  });
  expect(model.entries[0].blocks).toEqual(blocks);
  expect(model.totalWords).toBe(3);
});
