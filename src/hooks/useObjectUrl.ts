'use client';
import { useEffect, useState } from 'react';

const DEBUG_IMAGES = true; // TODO: Remove before final commit

export function useObjectUrl(loader: () => Promise<Blob | null>, deps: any[]) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    
    if (DEBUG_IMAGES) {
      console.log('[useObjectUrl] LIFECYCLE START:', {
        deps: deps,
        timestamp: Date.now()
      });
    }
    
    setLoading(true); setError(null); setUrl(null);

    (async () => {
      try {
        const blob = await loader();
        if (!blob) {
          if (DEBUG_IMAGES) {
            console.log('[useObjectUrl] BLOB IS NULL:', { deps });
          }
          return;
        }
        
        objectUrl = URL.createObjectURL(blob);
        
        if (DEBUG_IMAGES) {
          console.log('[useObjectUrl] OBJECT URL CREATED:', {
            deps: deps,
            url: objectUrl,
            blobSize: blob.size,
            blobType: blob.type,
            timestamp: Date.now()
          });
        }
        
        if (!cancelled) setUrl(objectUrl);
      } catch (e: any) {
        if (DEBUG_IMAGES) {
          console.error('[useObjectUrl] ERROR:', {
            deps: deps,
            error: e?.message,
            timestamp: Date.now()
          });
        }
        if (!cancelled) setError(e?.message ?? 'Failed to load media');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { 
      cancelled = true; 
      if (objectUrl) {
        if (DEBUG_IMAGES) {
          console.log('[useObjectUrl] REVOKING OBJECT URL:', {
            deps: deps,
            url: objectUrl,
            timestamp: Date.now()
          });
        }
        URL.revokeObjectURL(objectUrl);
      }
    };
  // deps intentionally provided by caller
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { url, loading, error };
}
