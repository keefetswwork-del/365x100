import { expect, test } from "@playwright/test";

import {
  buildEditorialRequest,
  buildEditorialSynthesisRequest,
  estimateGenerationCostCeiling,
  MAX_OUTPUT_TOKENS,
  mergeEditorialSection,
  sourceChunks,
  validateEditorial,
  validateSynthesis,
  type EditorialDocument,
} from "../../supabase/functions/generate-publication/core";

const sources = [{ content: "The rain arrived while we walked home.", date: "2026-07-03", ref: "opaque-entry-ref", title: "Rain" }];

test("builds a store-false request containing only allowed source fields", () => {
  const request = buildEditorialRequest(sources, "hashed-safety-id", "full");
  const serialized = JSON.stringify(request);
  expect(request).toMatchObject({ max_output_tokens: MAX_OUTPUT_TOKENS, model: "gpt-5.6-terra", safety_identifier: "hashed-safety-id", store: false });
  expect(serialized).toContain("opaque-entry-ref");
  expect(serialized).not.toContain("photo");
  expect(serialized).not.toContain("email");
  expect(serialized).not.toContain("storagePath");
});

test("requests and validates a chapter-quality review for a source-rich month", () => {
  const julySources = [{ content: Array.from({ length: 639 }, (_, index) => `word${index}`).join(" "), date: "2026-07-03", ref: "opaque-entry-ref", title: "July" }];
  const request = buildEditorialRequest(julySources, "hashed-safety-id", "full");
  const prompt = JSON.stringify(request);
  const review = Array.from({ length: 500 }, () => "word").join(" ");
  const editorial: EditorialDocument = { moments: [], quotations: [], review, themes: [], title: "July", version: 1 };

  expect(prompt).toContain("500-700 word lead essay");
  expect(prompt).toContain("concrete detail from a dated source entry");
  expect(prompt).toContain("em dashes or double hyphens");
  expect(validateEditorial(editorial, julySources)).toEqual(editorial);
  expect(validateEditorial({ ...editorial, review: Array.from({ length: 499 }, () => "short").join(" ") }, julySources)).toBeNull();
  expect(validateEditorial({ ...editorial, review: `${review}\u2014` }, julySources)).toBeNull();
});

test("rejects invented moments and omits unsupported quotations", () => {
  expect(validateEditorial({ moments: [{ date: "2026-07-03", sourceRef: "unknown", text: "Invented" }], quotations: [], review: "Review", themes: [], title: "July", version: 1 }, sources)).toBeNull();
  expect(validateEditorial({ moments: [{ date: "2026-07-04", sourceRef: "opaque-entry-ref", text: "Wrong date" }], quotations: [], review: "Review", themes: [], title: "July", version: 1 }, sources)).toBeNull();
  expect(validateEditorial({ moments: [], quotations: [{ date: "2026-07-03", quote: "Words never written", sourceRef: "opaque-entry-ref" }], review: "Review", themes: [], title: "July", version: 1 }, sources)?.quotations).toEqual([]);
});

test("chunks only at entry boundaries and replaces one regenerated section", () => {
  expect(sourceChunks([...sources, { ...sources[0], content: "x".repeat(40), ref: "second" }], 50)).toHaveLength(2);
  const current: EditorialDocument = { moments: [], quotations: [], review: "Old", themes: ["old"], title: "Title", version: 1 };
  const incoming: EditorialDocument = { ...current, review: "New", themes: ["new"] };
  expect(mergeEditorialSection(current, incoming, "review")).toMatchObject({ review: "New", themes: ["old"] });
});

test("synthesizes large months without adding new sourced moments or uncontrolled cost", () => {
  const draft: EditorialDocument = {
    moments: [{ date: "2026-07-03", sourceRef: "opaque-entry-ref", text: "The walk home." }],
    quotations: [{ date: "2026-07-03", quote: "The rain arrived", sourceRef: "opaque-entry-ref" }],
    review: "Review",
    themes: ["rain"],
    title: "July",
    version: 1,
  };
  const request = buildEditorialSynthesisRequest([draft], "hashed-safety-id", "full");
  expect(request).toMatchObject({ max_output_tokens: MAX_OUTPUT_TOKENS, store: false });
  expect(validateSynthesis(draft, sources, [draft])).toEqual(draft);
  expect(validateSynthesis({ ...draft, moments: [{ ...draft.moments[0], text: "A new claim." }] }, sources, [draft])).toBeNull();
  expect(estimateGenerationCostCeiling(sources)).toBeGreaterThan(0);
  expect(estimateGenerationCostCeiling(sources)).toBeLessThan(1);
});
