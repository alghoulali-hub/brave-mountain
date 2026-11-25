// Keeps the app shell available so it opens fast, and shows phone notifications.
// Data always comes live from Supabase.
const CACHE = 'brave-v20';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'js/main.js', 'js/core.js', 'js/icons.js', 'js/auth.js', 'js/child.js', 'js/parent.js', 'js/push.js', 'js/food.js', 'js/lock.js', 'js/feed.js', 'js/focus.js', 'js/report.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // network first, so updates show up right away; cache as fallback when offline
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Brave Mountain', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Brave Mountain';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { tab: data.tab || null },
    renotify: false
  }).then(() => self.clients.matchAll({ type: 'window' }).then(list => list.forEach(c => c.postMessage({ type: 'refresh' })))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = e.notification.data && e.notification.data.tab;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ type: 'open-tab', tab }); return open.focus(); }
    return self.clients.openWindow('./' + (tab ? '?tab=' + encodeURIComponent(tab) : ''));
  }));
});
