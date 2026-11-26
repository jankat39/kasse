// Offline-Cache für die Kasse. Bei jedem Update die Versionsnummer erhöhen.
const V = 'wmkasse-v11';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './jspdf.umd.min.js', './jspdf.plugin.autotable.min.js'];

self.addEventListener('install', e => {
  // cache:'reload' umgeht den Browser-Cache, damit wirklich die neue Version gespeichert wird
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(CORE.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Seite selbst: mit Internet immer die neueste Version holen, ohne Internet aus dem Speicher
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(req, { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
          const copy = res.clone();
          caches.open(V).then(c => c.put('./index.html', copy));
          return res;
        }
        throw new Error('status ' + res.status);
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Alles andere: erst Speicher, dann Netz
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
