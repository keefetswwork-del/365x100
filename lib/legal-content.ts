import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseLegalMarkdown, type LegalDocument } from "@/lib/legal-markdown";

export type LegalDocumentId = "privacy" | "terms";

const legalFiles: Record<LegalDocumentId, string> = {
  privacy: "privacy-policy.md",
  terms: "terms-of-use.md",
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  const fileName = legalFiles[id];
  const filePath = join(process.cwd(), "content", "legal", fileName);
  const markdown = readFileSync(filePath, "utf8");
  return parseLegalMarkdown(markdown, fileName);
}
