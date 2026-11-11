// Service worker de Melissa: hace la app instalable y abre aunque la red falle.
// No guarda datos de Supabase ni de otros dominios: solo archivos propios de la app.
const CACHE = 'melissa-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Páginas: primero la red (siempre la versión más nueva); sin red, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Archivos de la build (/assets/ llevan hash) e íconos: primero la copia guardada.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});


// Notificaciones push de recordatorios de citas.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data?.text() || 'Tienes una notificación de Melissa.' }; }
  const fecha = data.fechaHora ? new Date(data.fechaHora).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const body = data.body || (fecha ? 'Recuerda tu cita: ' + fecha : 'Tienes una notificación de Melissa.');
  event.waitUntil(self.registration.showNotification(data.title || 'Melissa', {
    body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: data.tag || 'melissa-notificacion', renotify: false,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const cliente of clientes) {
      if (cliente.url.startsWith(self.location.origin) && 'focus' in cliente) {
        await cliente.navigate(destino);
        return cliente.focus();
      }
    }
    return self.clients.openWindow(destino);
  })());
});
