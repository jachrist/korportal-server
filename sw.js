/**
 * Service Worker - Korportal PWA
 * Håndterer caching og offline-funksjonalitet
 */

const CACHE_NAME = 'korportal-v45';
const STATIC_CACHE = 'korportal-static-v40';
const DYNAMIC_CACHE = 'korportal-dynamic-v40';

// Filer som skal caches ved installasjon (kun filer som garantert finnes)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/ovelse.html',
  '/login.html',
  '/meldinger.html',
  '/innlegg.html',
  '/nedlasting.html',
  '/noter.html',
  '/konserter.html',
  '/musikk.html',
  '/admin.html',
  '/billetter.html',
  '/billettkontroll.html',
  '/medlemmer.html',
  '/styre.html',
  '/minprofil.html',
  '/css/style.css',
  '/css/ovelse.css',
  '/css/login.css',
  '/css/meldinger.css',
  '/css/innlegg.css',
  '/css/nedlasting.css',
  '/css/noter.css',
  '/css/konserter.css',
  '/css/musikk.css',
  '/css/admin.css',
  '/css/musicxml-tools.css',
  '/css/billetter.css',
  '/css/billettkontroll.css',
  '/css/medlemmer.css',
  '/css/styre.css',
  '/css/minprofil.css',
  '/js/main.js',
  '/js/ovelse.js',
  '/js/login.js',
  '/js/meldinger.js',
  '/js/innlegg.js',
  '/js/nedlasting.js',
  '/js/noter.js',
  '/js/konserter.js',
  '/js/musikk.js',
  '/js/admin.js',
  '/js/musicxml-tools.js',
  '/js/musicxml-phonetic.js',
  '/js/musicxml-repeats.js',
  '/js/billetter.js',
  '/js/billettkontroll.js',
  '/js/medlemmer.js',
  '/js/styre.js',
  '/js/minprofil.js',
  '/js/navigation.js',
  '/js/member-utils.js',
  '/js/badge-manager.js',
  '/js/parse-markdown.js',
  '/js/markdown-editor.js',
  '/css/markdown-editor.css',
  '/js/wav-mp3-tool.js',
  '/js/sw-register.js',
  '/manifest.json'
];

// Valgfrie filer som caches hvis de finnes
const OPTIONAL_ASSETS = [
  '/js/vendor/pdf.min.js',
  '/js/vendor/pdf.worker.min.js',
  '/js/vendor/lamejs.min.js',
  '/js/vendor/jszip.min.js',
  '/js/vendor/html5-qrcode.min.js',
  '/assets/icons/utsikten-logo.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// Installer service worker og cache statiske filer
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        console.log('[SW] Caching static assets');
        // Cache obligatoriske filer
        await cache.addAll(STATIC_ASSETS);
        // Prøv å cache valgfrie filer (ignorer feil)
        for (const url of OPTIONAL_ASSETS) {
          try {
            await cache.add(url);
          } catch (e) {
            console.log('[SW] Optional asset not available:', url);
          }
        }
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err);
      })
  );
});

// Aktiver og rydd opp gamle cacher
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Håndter fetch-requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer ikke-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer eksterne ressurser - la nettleseren håndtere dem direkte
  // (unngår CORS-problemer med blob storage bilder/media)
  if (url.origin !== location.origin) {
    return;
  }

  // Statiske assets - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML-sider - network first for fersk data
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Alt annet - network first
  event.respondWith(networkFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] Cache first failed:', err);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Returner offline-side for HTML-requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }

    return new Response('Offline', { status: 503 });
  }
}

// Sjekk om URL er en statisk asset
function isStaticAsset(pathname) {
  // JS og CSS skal bruke network-first for å sikre oppdateringer
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) return false;
  const staticExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Lytt etter meldinger fra hovedtråden
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

