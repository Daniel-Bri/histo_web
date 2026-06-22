import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            'AIzaSyA_BCtFn0AYeWHCYHqenWjvL7cl0UzcBHE',
  authDomain:        'histolink-ec5ef.firebaseapp.com',
  projectId:         'histolink-ec5ef',
  storageBucket:     'histolink-ec5ef.firebasestorage.app',
  messagingSenderId: '571516822155',
  appId:             '1:571516822155:web:e09827268dfe57412b2a8e',
  measurementId:     'G-L8FXQ4RDQS',
}

// VAPID key — Firebase Console → Project Settings → Cloud Messaging
// → Web Push certificates → Generate key pair → copiar la clave aquí
const VAPID_KEY = 'BKt6Q_sIIJZM_QQUPS4VsrblfBzuHff3YqxBeo3szS7U1bvu-rLtrvJJm2kdfrE9i76h_zEBjw1jrEjZCGwuw1U'

const firebaseApp = initializeApp(firebaseConfig)
const messaging   = getMessaging(firebaseApp)

export async function solicitarPermisoYObtenerToken(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[FCM] Permiso de notificaciones denegado')
      return null
    }

    // Registrar el SW y ESPERAR a que esté ACTIVO. getToken() hace
    // PushManager.subscribe(), que falla con "no active Service Worker" si se
    // llama justo después de register() (el SW aún está en 'installing').
    await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const registration = await navigator.serviceWorker.ready

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (token) {
      console.info('[FCM] Token obtenido:', token.slice(0, 20) + '…')
      return token
    }

    console.warn('[FCM] No se pudo obtener token FCM')
    return null
  } catch (err) {
    console.error('[FCM] Error al obtener token:', err)
    return null
  }
}

export function escucharNotificacionesPrimerPlano(
  callback: (titulo: string, cuerpo: string, datos: Record<string, string>) => void,
) {
  onMessage(messaging, (payload) => {
    const titulo = payload.notification?.title ?? 'Histolink'
    const cuerpo = payload.notification?.body  ?? ''
    const datos  = (payload.data ?? {}) as Record<string, string>
    callback(titulo, cuerpo, datos)
  })
}
