const CACHE_NAME = 'tr-genius-pwa-v6';
const urlsToCache = [
  // Core App Shell
  '.',
  './_redirects',
  './index.html',
  './manifest.json',
  
  // Local Scripts & Data
  './index.tsx',
  './App.tsx',
  './components/Icon.tsx',
  './components/Login.tsx',
  './components/AttachmentManager.tsx',
  './services/storageService.ts',
  './services/geminiService.ts',
  './services/ragService.ts',
  './services/exportService.ts',
  './types.ts',
  './lei14133.json',

  // Icons and Images
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon192.png',
  './icons/icon-384x384.png',
  './icons/icon512.png',
  './screenshots/screenshot1.png',
  './screenshots/screenshot2.png',
  
  // External Libraries (CDN)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://unpkg.com/mammoth@1.5.1/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  
  // External Modules (from Import Map)
  'https://aistudiocdn.com/react@19.2.0/es.js',
  'https://aistudiocdn.com/react@19.2.0/es/jsx-runtime.js',
  'https://aistudiocdn.com/react-dom@19.2.0/es/client.js',
  'https://aistudiocdn.com/@google/genai@1.24.0/es/index.js',

  // External Fonts & Icons Assets
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7SUc.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force activation of new SW
  );
});

self.addEventListener('fetch', (event) => {
  // Use a network-first strategy for navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If network is available, cache the response and return it
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // If network fails, serve the cached index.html
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Use a stale-while-revalidate strategy for all other requests (assets).
  // This provides a fast response from the cache while updating it in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If the network request is successful, update the cache.
          if (networkResponse && networkResponse.status === 200 && !event.request.url.startsWith('chrome-extension://')) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            // If the network fails, we still have the cached response (if it exists).
            console.warn(`Fetch failed for ${event.request.url}; returning cached response if available.`, err);
            if (cachedResponse) {
                return cachedResponse;
            }
            // If there's no cached response either, the error will propagate.
            throw err;
        });

        // Return the cached response immediately if available (stale), 
        // otherwise wait for the network response.
        return cachedResponse || fetchPromise;
      });
    })
  );
});


self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of open clients
  );
});