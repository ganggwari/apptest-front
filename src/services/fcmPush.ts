import { backend } from './backend'
import { registerPushToken, detachPushToken } from './devicePush'

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
            body, tag: payload.data?.notificationId || 'puf-fcm', data: { url: payload.data?.url || (payload.data?.category ? '/admin-app/notifications' : '/customer-app/screen-12') },
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
  // 토큰 등록은 앱 공통 경로(devicePush)를 쓴다: 로그인 계정이 바뀌면 다시 등록하고, 로그아웃 때 같은 경로로 해제한다.
  if (owner !== lastOwner || token !== currentToken || previous !== owner) {
    await registerPushToken({ token, platform: platform() })
    window.dispatchEvent(new Event('routel:push-device-updated'))
    lastOwner = owner
    currentToken = token
    localStorage.setItem(ownerKey, owner)
  }
  return true
}
export async function disableFcm(role: Role) {
  // 앱을 다시 열어 이 화면에서 아직 토큰을 기억하지 못하는 경우가 있으므로, 끌 때 브라우저의 실제 FCM 토큰을 직접 확인한다.
  // (기억하는 토큰이 없으면 서버 등록을 해제하지 못해 껐는데도 알림이 계속 오던 문제의 원인이 된다)
  let instance: any = null
  let token = currentToken
  if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    try {
      instance = await messaging()
      if (!token) {
        const registration = await navigator.serviceWorker.getRegistration('/')
        if (registration) token = await instance.getToken({ vapidKey, serviceWorkerRegistration: registration })
      }
    } catch {
      // Firebase 를 못 불러와도 서버 쪽 해제는 계속 시도한다
    }
  }
  if (token) {
    // 서버에 등록된 이 기기 토큰을 사용 중지한다 (반대 역할 쪽에 남은 등록은 아래 토큰 폐기로 끊긴다)
    await backend(endpoint(role) + '?token=' + encodeURIComponent(token), { method: 'DELETE' }).catch(() => {})
  }
  try { await detachPushToken() } catch { /* 토큰 해제 실패가 로그아웃·알림 끄기를 막지 않게 한다 */ }
  // FCM 토큰 자체를 폐기한다: 서버 등록이 어떻게 남아 있든 이 기기로는 더 이상 푸시가 오지 않고, 다시 켜면 새 토큰이 발급된다
  try { await instance?.deleteToken() } catch { /* 이미 없거나 지원하지 않으면 무시 */ }
  currentToken = ''
  lastOwner = ''
  localStorage.removeItem(ownerKey)
}
// 사용자가 앱에서 푸시를 직접 끈 계정은 로그인 때 자동으로 다시 켜지 않는다.
// 기준은 서버(계정에 저장)이고, localStorage 는 서버 응답 전·오프라인일 때 쓰는 캐시다. 앱을 지웠다 다시 깔거나 기기를 바꿔도 서버 값이 유지된다.
const optOutKey = (role: Role, id: string) => `puf-fcm-optout:${role}:${id}`
const preferencePath = (role: Role) => (role === 'customer' ? '/api/customers/me/push-preference' : '/api/managers/me/push-preference')
function cacheOptOut(role: Role, id: string, value: boolean) {
  try { value ? localStorage.setItem(optOutKey(role, id), '1') : localStorage.removeItem(optOutKey(role, id)) } catch { /* ignore */ }
}
export function isFcmOptedOut(role: Role, id: string) {
  try { return localStorage.getItem(optOutKey(role, id)) === '1' } catch { return false }
}
// 서버에 저장된 '끈 상태'를 읽어 캐시에 반영한다. 서버에 닿지 않으면 캐시 값을 그대로 쓴다.
export async function syncFcmOptOut(role: Role, id: string): Promise<boolean> {
  try {
    const pref = await backend<{ optOut: boolean }>(preferencePath(role))
    cacheOptOut(role, id, !!pref?.optOut)
    return !!pref?.optOut
  } catch {
    return isFcmOptedOut(role, id)
  }
}
export function setFcmOptOut(role: Role, id: string, value: boolean) {
  cacheOptOut(role, id, value)
  void backend(preferencePath(role), { method: 'PUT', body: { optOut: value } }).catch(() => { /* 다음 로그인 때 서버 값으로 다시 맞춘다 */ })
}
export function isFcmActive(role: Role, id: string) {
  return 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem(ownerKey) === `${role}:${id}`
}
export function resetFcmOwner() {
  lastOwner = ''
  currentToken = ''
  localStorage.removeItem(ownerKey)
}
