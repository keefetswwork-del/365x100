"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { createMediaSignedUrl } from "@/lib/entry-media";
import type { Database } from "@/lib/database.types";
import type { EntryMedia } from "@/types/media";

interface PrivatePhotoProps {
  alt: string;
  client: SupabaseClient<Database>;
  className?: string;
  media: EntryMedia;
}

export function PrivatePhoto({ alt, client, className = "", media }: PrivatePhotoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!navigator.onLine) {
        if (active) setUnavailable(true);
        return;
      }
      try {
        const nextUrl = await createMediaSignedUrl(client, media);
        if (active) {
          setUrl(nextUrl);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      }
    };
    const handleRefresh = () => void refresh();
    const handleOffline = () => setUnavailable(true);
    queueMicrotask(handleRefresh);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    window.addEventListener("offline", handleOffline);
    const timer = window.setInterval(handleRefresh, 12 * 60 * 1000);
    return () => {
      active = false;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(timer);
    };
  }, [client, media]);

  if (!url || unavailable) {
    return <div className={`grid place-items-center bg-[var(--sage)]/20 text-center text-xs font-semibold text-[var(--muted)] ${className}`}>Photo unavailable offline</div>;
  }

  // Signed private URLs are short lived and cannot use Next's static image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} width={media.width} height={media.height} onError={() => setUnavailable(true)} className={className} />;
}
