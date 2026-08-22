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

test("keeps sparse entries short without padding them into an essay", () => {
  const sparseSources = [{ content: "I got the email. It was good.", date: "2026-07-03", ref: "opaque-entry-ref", title: "Email" }];
  const prompt = JSON.stringify(buildEditorialRequest(sparseSources, "hashed-safety-id", "full"));

  expect(prompt).toContain("short, proportionate chapter");
  expect(prompt).toContain("Do not pad sparse source material");
  expect(prompt).toContain("Tell the story of what happened rather than summarising what happened");
  expect(prompt).not.toContain("lead essay");
  expect(prompt).not.toContain("closing insight");
});

test("uses a proportional, detail-preserving length for a source-rich month", () => {
  const julySources = [{ content: Array.from({ length: 1_000 }, (_, index) => `word${index}`).join(" "), date: "2026-07-03", ref: "opaque-entry-ref", title: "July" }];
  const request = buildEditorialRequest(julySources, "hashed-safety-id", "full");
  const prompt = JSON.stringify(request);
  const review = Array.from({ length: 650 }, () => "word").join(" ");
  const editorial: EditorialDocument = { moments: [], quotations: [], review, themes: [], title: "July", version: 1 };

  expect(prompt).toContain("650-950 word chapter");
  expect(prompt).toContain("specific scenes, conversations, places, decisions, frustrations, small wins, and observations");
  expect(prompt).toContain("Preserve the writer's voice");
  expect(prompt).toContain("Preserve emotional progression");
  expect(prompt).toContain("empty arrays for themes, moments, and quotations");
  expect(prompt).toContain("em dashes or double hyphens");
  expect(validateEditorial(editorial, julySources)).toEqual(editorial);
  expect(validateEditorial({ ...editorial, review: Array.from({ length: 649 }, () => "short").join(" ") }, julySources)).toBeNull();
  expect(validateEditorial({ ...editorial, review: `${review}\u2014` }, julySources)).toBeNull();
});

test("directs entries from across the month into a continuous chronological chapter", () => {
  const monthSources = [
    { content: "My boss extended my probation. I was annoyed because I was still closing.", date: "2026-07-07", ref: "first", title: "Probation" },
    { content: "I closed another client. It made me feel better about where I stood.", date: "2026-07-15", ref: "second", title: "Client" },
    { content: "I went home for dinner again. I had been seeing more of my family this week.", date: "2026-07-28", ref: "third", title: "Dinner" },
  ];
  const prompt = JSON.stringify(buildEditorialRequest(monthSources, "hashed-safety-id", "full"));

  expect(prompt).toContain("broadly in chronological order");
  expect(prompt).toContain("natural transitions");
  expect(prompt).toContain("recurring people, goals, problems, and situations carry forward");
  expect(prompt).toContain("Do not write a recap, executive summary, thematic synthesis, or generic month overview");
  expect(prompt).toContain("Never invent or embellish facts");
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
  const request = buildEditorialSynthesisRequest([draft], sources, "hashed-safety-id", "full");
  expect(request).toMatchObject({ max_output_tokens: MAX_OUTPUT_TOKENS, store: false });
  expect(JSON.stringify(request)).toContain("The drafts are ordered chronologically");
  expect(JSON.stringify(request)).toContain("Tell the story of what happened rather than summarising what happened");
  expect(validateSynthesis(draft, sources, [draft])).toEqual(draft);
  expect(validateSynthesis({ ...draft, moments: [{ ...draft.moments[0], text: "A new claim." }] }, sources, [draft])).toBeNull();
  expect(estimateGenerationCostCeiling(sources)).toBeGreaterThan(0);
  expect(estimateGenerationCostCeiling(sources)).toBeLessThan(1);
});
