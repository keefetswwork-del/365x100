"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

import type { Database } from "@/lib/database.types";
import { recordPublicationEvent } from "@/lib/publications";
import type { PublicationPageModel } from "@/lib/publication-document";
import type { PublicationDocument } from "@/types/publication";

export function PublicationPdfButton({ client, document, disabled, model }: {
  client: SupabaseClient<Database>;
  disabled: boolean;
  document: PublicationDocument;
  model: PublicationPageModel;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setWorking(true);
    setError("");
    try {
      const { downloadPublicationPdf } = await import("@/components/publication-pdf-document");
      await downloadPublicationPdf(client, document, model);
      void recordPublicationEvent(client, "pdf_downloaded", document.publication.id);
    } catch {
      setError("The PDF could not be prepared. Your chapter is still safe.");
    } finally {
      setWorking(false);
    }
  }
  return <div><button type="button" disabled={disabled || working} onClick={() => void download()} className="min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">{working ? "Preparing A5 PDF…" : "Download A5 PDF"}</button>{error && <p className="mt-2 text-sm text-red-900" role="alert">{error}</p>}</div>;
}
