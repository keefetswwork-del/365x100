import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getLegalDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Use | 365x100",
  description: "Terms governing the 365x100 private beta.",
};

export default function TermsPage() {
  return <LegalDocumentPage document={getLegalDocument("terms")} />;
}
