<script setup lang="ts">
// 최초 로그인(또는 앱 설치 후 첫 로그인) 때 푸시 알림 동의를 바로 받는다. 알림 설정 화면까지 찾아가지 않아도 된다.
// - 브라우저 권한이 아직 '기본'일 때만 보여 준다. 허용/차단된 뒤에는 다시 묻지 않는다.
// - '나중에'는 7일 뒤에 다시 한 번만 묻는다(계정·브라우저별로 기억).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import { useCustomerNotifications } from '../stores/customerNotifications'
import { enableFcm } from '../services/fcmPush'

const app = useApp(), route = useRoute(), notifications = useCustomerNotifications()
const visible = ref(false), busy = ref(false), message = ref('')
const supported = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext && 'serviceWorker' in navigator
const manager = computed(() => app.account?.role === 'REGIONAL_ADMIN')
const key = computed(() => (app.account ? `routel-push-asked:${app.account.role}:${app.account.id}` : ''))
const onAuthScreen = computed(() => /^\/(admin|customer)-app\/(screen-[1-4]|signup|password-reset|find-id)$/.test(route.path) && !app.account)
const REASK_MS = 7 * 24 * 3600 * 1000
let timer: ReturnType<typeof setTimeout> | undefined

function store(value: string | null) {
  try { return value === null ? localStorage.getItem(key.value) : (localStorage.setItem(key.value, value), null) } catch { return null }
}
function shouldAsk() {
  if (!supported || !app.account || !key.value || onAuthScreen.value) return false
  if (Notification.permission !== 'default') return false
  const prev = store(null)
  if (!prev) return true
  if (prev === 'later:2') return false
  const [kind, at] = prev.split(':')
  return kind === 'later' && Date.now() - Number(at) > REASK_MS
}
watch(() => [app.account?.id, app.account?.role, route.path] as const, () => {
  clearTimeout(timer)
  if (visible.value || !shouldAsk()) return
  timer = setTimeout(() => { if (shouldAsk()) visible.value = true }, 1200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

function later() {
  const prev = store(null)
  store(prev?.startsWith('later') ? 'later:2' : `later:${Date.now()}`)
  visible.value = false
}
async function allow() {
  if (!app.account || busy.value) return
  busy.value = true
  message.value = ''
  try {
    await enableFcm(manager.value ? 'REGIONAL_ADMIN' : 'customer', String(app.account.id), true)
    if (!manager.value) notifications.setBrowserEnabled(true)
    store('done')
    visible.value = false
  } catch (e) {
    // 사용자가 브라우저 팝업에서 거부한 경우 포함. 다시 묻지 않고 알림 설정에서 켜도록 안내한다.
    if (Notification.permission === 'default') { later(); return } // 팝업을 그냥 닫은 경우: 나중에 한 번 더 묻는다
    store('denied')
    message.value = (e as Error).message || '알림을 켜지 못했습니다.'
    setTimeout(() => { visible.value = false; message.value = '' }, 2600)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <Teleport to="body">
    <div v-if="visible" class="push-consent-backdrop" role="presentation">
      <section class="push-consent" role="dialog" aria-modal="true" aria-labelledby="push-consent-title">
        <div class="push-consent-icon" aria-hidden="true">🔔</div>
        <h2 id="push-consent-title">{{ manager ? '긴급 알림을 받으시겠어요?' : '알림을 받으시겠어요?' }}</h2>
        <p v-if="manager">설비 위험 진입, 점검 요청 같은 긴급 알림을 앱을 닫아 둔 상태에서도 바로 받을 수 있어요.</p>
        <p v-else>내가 지나는 지하차도의 통제·위험 소식과 경로 재탐색 안내를 앱을 닫아 둔 상태에서도 받을 수 있어요.</p>
        <p v-if="message" class="push-consent-message" role="status">{{ message }}</p>
        <div class="push-consent-actions">
          <button type="button" class="push-consent-later" :disabled="busy" @click="later">나중에</button>
          <button type="button" class="push-consent-allow" :disabled="busy" @click="allow">{{ busy ? '설정 중…' : '알림 받기' }}</button>
        </div>
        <small>설정은 마이페이지 · 알림 설정에서 언제든 바꿀 수 있어요.</small>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.push-consent-backdrop{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,24,40,.45);padding:0 12px calc(12px + env(safe-area-inset-bottom))}
.push-consent{width:100%;max-width:420px;box-sizing:border-box;border-radius:20px;background:var(--r-surface,#fff);color:var(--r-ink,#18344d);padding:22px 20px 16px;box-shadow:0 12px 40px rgba(10,24,40,.3);text-align:center}
.push-consent-icon{font-size:30px;line-height:1}
.push-consent h2{margin:10px 0 6px;font-size:18px}
.push-consent p{margin:0 0 6px;font-size:14px;line-height:1.55;color:var(--r-ink-sub,#516577)}
.push-consent-message{color:#b3261e!important}
.push-consent-actions{display:flex;gap:10px;margin:16px 0 8px}
.push-consent-actions button{flex:1;min-height:46px;border-radius:12px;border:1px solid var(--r-line,#cfd8e3);font:inherit;font-weight:700;cursor:pointer}
.push-consent-later{background:transparent;color:inherit}
.push-consent-allow{background:#175c9e;color:#fff;border-color:#175c9e!important}
.push-consent-actions button:disabled{opacity:.6}
.push-consent small{color:var(--r-ink-sub,#6b7c8e);font-size:12px}
</style>
