import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getLegalDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy | 365x100",
  description: "How 365x100 handles personal data during the private beta.",
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={getLegalDocument("privacy")} />;
}
