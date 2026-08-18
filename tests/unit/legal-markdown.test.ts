import { expect, test } from "@playwright/test";

import { getLegalDocument } from "../../lib/legal-content";
import { parseLegalMarkdown, type LegalBlock, type LegalInline } from "../../lib/legal-markdown";

function documentText(blocks: LegalBlock[]): string {
  return blocks.map((block) => {
    if (block.kind === "heading") return block.text;
    const groups = block.kind === "list" ? block.items : [block.content];
    return groups.flatMap((tokens) => tokens.map((token) => token.text)).join(" ");
  }).join(" ");
}

function documentLinks(blocks: LegalBlock[]): Extract<LegalInline, { kind: "link" }>[] {
  return blocks.flatMap((block) => {
    if (block.kind === "heading") return [];
    const groups = block.kind === "list" ? block.items : [block.content];
    return groups.flatMap((tokens) => tokens.filter(
      (token): token is Extract<LegalInline, { kind: "link" }> => token.kind === "link",
    ));
  });
}

test("loads both complete legal documents from their Markdown sources", () => {
  const privacy = getLegalDocument("privacy");
  const terms = getLegalDocument("terms");

  expect(privacy.title).toBe("365x100 Privacy Policy");
  expect(terms.title).toBe("365x100 Private Beta Terms of Use");
  expect(privacy.effectiveDate).toBe("18 August 2026");
  expect(terms.effectiveDate).toBe("17 August 2026");
  expect(privacy.sections).toHaveLength(13);
  expect(terms.sections).toHaveLength(13);
  expect(privacy.sections[0].text).toBe("1. Who may use the beta");
  expect(terms.sections[12].text).toBe("13. Contact");
});

test("discloses private photo processing without claiming AI analysis", () => {
  const privacy = getLegalDocument("privacy");
  const text = documentText(privacy.blocks);
  expect(text).toContain("removes embedded metadata");
  expect(text).toContain("Photographs are not analysed by artificial intelligence");
  expect(text).toContain("short-lived access links");
});

test("publishes the corrected infrastructure and deletion wording", () => {
  const privacyText = documentText(getLegalDocument("privacy").blocks);

  expect(privacyText).toContain("primary production database is hosted by Supabase in Sydney, Australia");
  expect(privacyText).toContain("global content-delivery network");
  expect(privacyText).toContain("Search phrases are processed to return matching entries");
  expect(privacyText).not.toContain("Deleting an entry");
  expect(privacyText).not.toContain("delete entries");
});

test("allows only internal and email links in legal content", () => {
  const links = [
    ...documentLinks(getLegalDocument("privacy").blocks),
    ...documentLinks(getLegalDocument("terms").blocks),
  ];

  expect(links.some((link) => link.href === "/privacy")).toBe(true);
  expect(links.some((link) => link.href === "mailto:hello@365x100.com")).toBe(true);
  expect(links.every((link) => link.href.startsWith("/") || link.href.startsWith("mailto:"))).toBe(true);
});

test("rejects unsafe, malformed and structurally incomplete legal Markdown", () => {
  const valid = "# Policy\n\n**Effective date: 17 August 2026**\n\n## 1. First\n\nSafe text.";

  expect(() => parseLegalMarkdown(valid.replace("Safe text.", "[Unsafe](javascript:alert(1))"))).toThrow("unsafe legal-document link");
  expect(() => parseLegalMarkdown(valid.replace("Safe text.", "<script>alert(1)</script>"))).toThrow("raw HTML");
  expect(() => parseLegalMarkdown(valid.replace("**Effective date: 17 August 2026**\n\n", ""))).toThrow("effective date");
  expect(() => parseLegalMarkdown(valid.replace("## 1. First", "## 2. Second"))).toThrow("numbered sequentially");
});
