'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // Register SW on window load to avoid blocking initial page load
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
          .then((registration) => {
            console.log('SW registered successfully:', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('SW updated and ready to activate');
                    // Optionally show update notification to user
                  }
                });
              }
            });
          })
          .catch((registrationError) => {
            console.error('SW registration failed:', registrationError);
          });
      };

      // Register immediately if page is already loaded, otherwise wait for load
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}

