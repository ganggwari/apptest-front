import { backend } from './backend'

// Firebase Web configuration is public; NEVER place a Firebase service-account private key here.
const firebaseConfig = {
  apiKey: 'AIzaSyC4tpG_t2OGKH8vQTIUHGJEM7lxR8NxiWI',
  authDomain: 'pufpr-ab135-7d2a5.firebaseapp.com',
  projectId: 'pufpr-ab135-7d2a5',
  storageBucket: 'pufpr-ab135-7d2a5.firebasestorage.app',
  messagingSenderId: '950702292615',
  appId: '1:950702292615:web:ad273bbbb7d92a06cc8222',
  measurementId: 'G-71M0N5DCW1',
}
const vapidKey = 'BCIPCowZOT7Szt4tEXOsQzk8n4l595dVxChISYTf-4In15FI-9FHxc6hatBEfN-tKMWW6GzQ__Q5ywRUb4Sz4Cc'
const ownerKey = 'puf-fcm-owner'
let sdkPromise: Promise<any> | null = null
let listening = false
let lastOwner = ''
let currentToken = ''

type Role = 'customer' | 'REGIONAL_ADMIN'
function endpoint(role: Role) {
  return role === 'customer' ? '/api/customers/me/device-tokens' : '/api/managers/me/device-tokens'
}
function platform(): 'APP' | 'WEB' {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone ? 'APP' : 'WEB'
}
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Firebase SDK를 불러올 수 없습니다. 네트워크 연결을 확인하세요.'))
    document.head.appendChild(script)
  })
}
async function messaging(): Promise<any> {
  if (!sdkPromise) sdkPromise = (async () => {
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')
    const firebase = (window as any).firebase
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    if (!(await firebase.messaging.isSupported())) throw new Error('이 브라우저에서는 FCM 웹 푸시를 지원하지 않습니다.')
    const instance = firebase.messaging()
    if (!listening) {
      listening = true
      instance.onMessage((payload: any) => {
        window.dispatchEvent(new CustomEvent('puf-fcm-message', { detail: payload }))
        // Foreground messages must be rendered explicitly; SSE remains the source of truth for the notification list.
        const title = payload.notification?.title || payload.data?.title || 'PUF 새 알림'
        const body = payload.notification?.body || payload.data?.body || ''
        if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          void navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, {
            body, tag: payload.data?.notificationId || 'puf-fcm', data: { url: payload.data?.url || (payload.data?.category ? '/admin-app/notifications' : '/my-alerts') },
          }))
        }
      })
    }
    return instance
  })().catch((err) => { sdkPromise = null; throw err })
  return sdkPromise
}
export async function enableFcm(role: Role, id: string, requestPermission = false) {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('푸시 알림에는 HTTPS와 Service Worker를 지원하는 브라우저가 필요합니다.')
  }
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') {
    if (requestPermission) throw new Error('알림 권한을 허용해야 FCM을 활성화할 수 있습니다.')
    return false
  }
  const instance = await messaging()
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  await navigator.serviceWorker.ready
  const token = await instance.getToken({ vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('FCM 토큰을 발급받지 못했습니다. Firebase 설정을 확인하세요.')
  if (token.length > 255) throw new Error('FCM 토큰이 백엔드 DB의 255자 제한을 초과합니다.')
  const owner = `${role}:${id}`
  const previous = localStorage.getItem(ownerKey)
  // Avoid redundant requests, but always rebind token after a login/account change.
  if (owner !== lastOwner || token !== currentToken || previous !== owner) {
    await backend(endpoint(role), { method: 'POST', body: { token, platform: platform() } })
    lastOwner = owner
    currentToken = token
    localStorage.setItem(ownerKey, owner)
  }
  return true
}
export async function disableFcm(role: Role) {
  const instance = await messaging()
  const registration = await navigator.serviceWorker.ready
  const token = currentToken || await instance.getToken({ vapidKey, serviceWorkerRegistration: registration })
  if (token) await backend(endpoint(role) + '?token=' + encodeURIComponent(token), { method: 'DELETE' })
  currentToken = ''
  lastOwner = ''
  localStorage.removeItem(ownerKey)
}
export function resetFcmOwner() {
  lastOwner = ''
  currentToken = ''
  localStorage.removeItem(ownerKey)
}
