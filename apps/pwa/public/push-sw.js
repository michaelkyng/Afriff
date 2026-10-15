/**
 * Push notifications for the AFRIFF app, loaded into the generated service
 * worker by `pwa.workbox.importScripts` in nuxt.config.ts.
 *
 * The server sends data-only messages through Firebase Cloud Messaging, with a
 * title, a body, the path to open and a tag (`apps/functions/src/push`). This
 * shows them and, on a tap, opens the app at that path, in a window already
 * open when there is one.
 */

/** FCM puts a message's fields under `data`; a message sent any other way is read as it is. */
function readMessage(event) {
  let payload = null
  try {
    payload = event.data ? event.data.json() : null
  }
  catch {
    payload = null
  }
  const message = payload && typeof payload.data === 'object' && payload.data ? payload.data : payload
  // Every push has to show something, so one that cannot be read still points at the news.
  if (!message || typeof message.title !== 'string') return { title: 'AFRIFF', body: 'There is news from the festival.', url: '/updates' }
  return message
}

self.addEventListener('push', (event) => {
  const message = readMessage(event)
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body || '',
      tag: message.tag || undefined,
      icon: '/pwa-192x192.png',
      data: { url: message.url || '/' },
    }),
  )
})

/** Only ever a path inside the app. */
function pathOf(url) {
  const target = new URL(url || '/', self.location.origin)
  return target.origin === self.location.origin ? target.pathname + target.search + target.hash : '/'
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = pathOf(event.notification.data && event.notification.data.url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (!open) return self.clients.openWindow(path)
      // The app moves itself there (app/plugins/push.client.ts), keeping its state.
      open.postMessage({ type: 'afriff:open', path })
      return open.focus()
    }),
  )
})
