const CACHE_NAME = 'quickfs-v1';
const MANIFEST_URL = '/manifest.json';
const urlsToCache = [
  '/',
  '/host',
  '/join',
  '/bg-light.jpg',
  '/bg-dark.jpg',
  '/favicon.svg',
  '/manifest.json'
];

let manifestData = null;

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('Opened cache');
          return cache.addAll(urlsToCache);
        }),
      fetchAndCacheManifest()
    ])
    .then(() => {
      console.log('Service Worker installed, skipping waiting');
      return self.skipWaiting(); // Force activation of new service worker
    })
    .catch((error) => {
      console.log('Cache install failed:', error);
    })
  );
});

// Fetch and cache manifest data
async function fetchAndCacheManifest() {
  try {
    const response = await fetch(MANIFEST_URL);
    const manifest = await response.json();
    manifestData = manifest;

    // Store manifest in cache with timestamp
    const cache = await caches.open(CACHE_NAME);
    const manifestWithTimestamp = {
      ...manifest,
      cached_at: Date.now()
    };

    await cache.put(MANIFEST_URL + '?cached', new Response(JSON.stringify(manifestWithTimestamp)));
    console.log('Manifest cached:', manifest);

    return manifest;
  } catch (error) {
    console.error('Failed to fetch manifest:', error);
    return null;
  }
}

// Check for manifest updates
async function checkForUpdates() {
  try {
    console.log('Checking for updates...');

    // Get cached manifest
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(MANIFEST_URL + '?cached');

    if (!cachedResponse) {
      console.log('No cached manifest found');
      return false;
    }

    const cachedManifest = await cachedResponse.json();
    const cacheAge = Date.now() - (cachedManifest.cached_at || 0);

    // Check every 5 minutes
    if (cacheAge < 5 * 60 * 1000) {
      console.log('Manifest cache is fresh');
      return false;
    }

    // Fetch current manifest
    const response = await fetch(MANIFEST_URL + '?t=' + Date.now());
    const currentManifest = await response.json();

    // Compare versions or content
    const hasUpdates = JSON.stringify(currentManifest) !== JSON.stringify({
      ...cachedManifest,
      cached_at: undefined
    });

    if (hasUpdates) {
      console.log('Updates detected!');
      await fetchAndCacheManifest();

      // Notify all clients about the update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          payload: { currentManifest, cachedManifest }
        });
      });

      return true;
    }

    console.log('No updates found');
    return false;

  } catch (error) {
    console.error('Error checking for updates:', error);
    return false;
  }
}

// Periodic update check
setInterval(checkForUpdates, 5 * 60 * 1000); // Check every 5 minutes

// Message handler for manual update checks
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
    console.log('Manual update check requested');
    checkForUpdates();
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skipping waiting and activating new service worker');
    self.skipWaiting();
  }
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip WebSocket upgrade requests
  if (event.request.headers.get('upgrade') === 'websocket') {
    return;
  }

  // Skip API requests (let them fail gracefully)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
