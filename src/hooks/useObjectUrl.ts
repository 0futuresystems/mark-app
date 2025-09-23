'use client';
import { useEffect, useState } from 'react';

export function useObjectUrl(loader: () => Promise<Blob | null>, deps: any[]) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true); setError(null); setUrl(null);

    (async () => {
      try {
        const blob = await loader();
        if (!blob) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load media');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // deps intentionally provided by caller
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { url, loading, error };
}
