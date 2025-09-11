'use client';

import { useEffect } from 'react';

export default function PersistentStorage() {
  useEffect(() => {
    // Request persistent storage to reduce IndexedDB eviction
    const requestPersistentStorage = async () => {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
          const isPersistent = await navigator.storage.persist();
          console.log(`Persistent storage ${isPersistent ? 'granted' : 'denied'}`);
        } catch (error) {
          console.warn('Failed to request persistent storage:', error);
        }
      }
    };

    requestPersistentStorage();
  }, []);

  return null; // This component doesn't render anything
}
