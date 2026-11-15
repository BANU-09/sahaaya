/* No health records or authenticated responses are cached. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const notification = data.notification || {};
  event.waitUntil(
    self.registration
      .showNotification(notification.title || 'Sahaaya', {
        body: notification.body || 'Open Sahaaya to review a care update.',
        icon: '/icon.svg',
        data: { url: '/app/notifications' },
        tag: data.notificationId,
      })
      .then(async () => {
        if (typeof data.notificationId === 'string') {
          try {
            await fetch('/api/push/receipt', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationId: data.notificationId }),
            });
          } catch {
            /* No receipt is recorded while offline or signed out. */
          }
        }
      }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/app/notifications'));
});
