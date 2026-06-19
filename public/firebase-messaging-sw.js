// Service Worker para notificaciones push en background (Firebase Cloud Messaging)
// Este archivo DEBE estar en /public para que el navegador lo registre desde la raíz.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyA_BCtFn0AYeWHCYHqenWjvL7cl0UzcBHE',
  authDomain:        'histolink-ec5ef.firebaseapp.com',
  projectId:         'histolink-ec5ef',
  storageBucket:     'histolink-ec5ef.firebasestorage.app',
  messagingSenderId: '571516822155',
  appId:             '1:571516822155:web:e09827268dfe57412b2a8e',
})

const messaging = firebase.messaging()

// Muestra la notificación cuando la app está en BACKGROUND o CERRADA
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title ?? 'Histolink'
  const cuerpo = payload.notification?.body  ?? ''
  const datos  = payload.data ?? {}

  self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: datos,
    tag: datos.tipo ?? 'histolink',
    renotify: true,
  })
})

// Al hacer clic en la notificación: abre o enfoca la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const datos = event.notification.data ?? {}
  let url = '/'

  if (datos.tipo === 'nueva_ficha' && datos.ficha_id) {
    url = `/fichas/dia`
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    }),
  )
})
