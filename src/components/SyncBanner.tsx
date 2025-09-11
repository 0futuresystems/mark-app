'use client';
import { useSyncStore } from '@/lib/sync/state';

export default function SyncBanner() {
  const { isSyncing, pendingUploads, syncError } = useSyncStore();
  if (syncError) {
    return <div className="fixed bottom-2 inset-x-2 rounded-md border bg-background px-3 py-2 text-sm">Some items failed to sync. Retrying…</div>;
  }
  if (isSyncing || pendingUploads > 0) {
    return <div className="fixed bottom-2 inset-x-2 rounded-md border bg-background px-3 py-2 text-sm">Syncing {pendingUploads}…</div>;
  }
  return null;
}