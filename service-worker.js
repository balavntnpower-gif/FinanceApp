// ========== HLB Finance - Service Worker ==========
// Version: 1.0.0 | PWA Support for Offline + Install

const CACHE_NAME = 'hlb-finance-v1';

// Jin files ko cache karna hai (offline ke liye)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
];

// ========== INSTALL EVENT ==========
// Pehli baar app install hone par files cache ho jaati hain
self.addEventListener('install', function(event) {
  console.log('[SW] Installing HLB Finance Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching static assets...');
      // CDN files alag se handle karte hain (fail ho sakti hain)
      const localAssets = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
      const cdnAssets = [
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
        'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
      ];
      
      // Pehle local files cache karo
      return cache.addAll(localAssets).then(function() {
        // Phir CDN files try karo (agar fail ho to skip)
        return Promise.all(
          cdnAssets.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] CDN cache failed (ok):', url, err.message);
            });
          })
        );
      });
    }).then(function() {
      console.log('[SW] ✅ Installation complete!');
      // Turant activate ho jaaye, wait mat karo
      return self.skipWaiting();
    }).catch(function(err) {
      console.error('[SW] ❌ Installation failed:', err);
    })
  );
});

// ========== ACTIVATE EVENT ==========
// Purana cache delete karo
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating HLB Finance Service Worker...');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Purana cache delete karo
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('[SW] ✅ Activated! Taking control of all pages.');
      // Sabhi open tabs ko control lo
      return self.clients.claim();
    })
  );
});

// ========== FETCH EVENT ==========
// Network request intercept karo
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  // Supabase API calls - KABHI cache mat karo (live data chahiye)
  if (url.includes('supabase.co') || url.includes('supabase.io')) {
    // Supabase ke liye sirf network use karo
    event.respondWith(
      fetch(event.request).catch(function() {
        // Offline hai aur Supabase nahi mila - yeh normal hai
        console.log('[SW] Supabase offline (ok - IndexedDB working):', url);
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // GitHub users.json - Network first, phir cache
  if (url.includes('users.json')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // Network se mila - cache update karo
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // Offline - cache se do
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // CDN files (Supabase JS, SheetJS) - Cache first, network fallback
  if (url.includes('cdn.jsdelivr.net') || url.includes('cdn.sheetjs.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          // Cache mein hai - cache se do (fast!)
          return cachedResponse;
        }
        // Cache mein nahi - network se lo aur cache karo
        return fetch(event.request).then(function(response) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }
  
  // Baaki sabhi local files - Cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Cache mein mila - cache se do
        return cachedResponse;
      }
      
      // Cache mein nahi - network se lo
      return fetch(event.request).then(function(response) {
        // Sirf successful responses cache karo
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        
        return response;
      }).catch(function() {
        // Completely offline aur cache mein bhi nahi
        // index.html fallback do
        return caches.match('./index.html');
      });
    })
  );
});

// ========== BACKGROUND SYNC (Future use) ==========
self.addEventListener('sync', function(event) {
  if (event.tag === 'hlb-sync') {
    console.log('[SW] Background sync triggered');
    // Supabase sync yahan ho sakta hai future mein
  }
});

// ========== PUSH NOTIFICATIONS (Future use) ==========
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'HLB Finance', {
      body: data.body || 'New notification',
      icon: './icon-192.png',
      badge: './icon-192.png'
    });
  }
});

console.log('[SW] HLB Finance Service Worker Loaded ✅');
