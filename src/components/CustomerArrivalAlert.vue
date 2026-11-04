<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import { notificationCategory, useCustomerNotifications } from '../stores/customerNotifications'
import { displayDate } from '../utils/display-date'
import UiIcon from './UiIcon.vue'
import { playCustomerEmergencyAlert } from '../runtime/customerAlertSound'

const app = useApp(), route = useRoute()
const notifications = useCustomerNotifications()
const dialog = ref<HTMLDialogElement>(), heading = ref<HTMLElement>()
const busy = ref(false), actionError = ref('')
const eligible = computed(() => route.path.startsWith('/customer-app/') && app.account?.role === 'customer')
const current = computed(() => notifications.appArrivals[0])
const batchTotal=ref(0), batchConfirmed=ref(0)
watch(()=>notifications.appArrivals.length,(count,previous=0)=>{
  if(!count){batchTotal.value=0;batchConfirmed.value=0}
  else if(count>previous)batchTotal.value+=count-previous
  else batchConfirmed.value+=previous-count
},{immediate:true})
const body=computed(()=>String(current.value?.body||'').replace(/^\s*(?:\[ROUTEL\]|ROUTEL\s*[:：·-])\s*/i,''))
const isSafety = computed(() => current.value?.category === 'RISK')
const tone = computed(() => {
  if (!isSafety.value) return 'info'
  const level = String(current.value?.severity || current.value?.currentRiskLevel || current.value?.riskLevel || '').toUpperCase()
  return ['DANGER', 'CRITICAL', 'EMERGENCY', '위험', '긴급'].includes(level) ? 'danger' : 'caution'
})
const label = computed(() => isSafety.value
  ? tone.value === 'danger' ? '위험 안내' : '안전 정보'
  : notificationCategory(current.value?.category || ''))
// 안전 알림(재난문자)은 운전에 방해되지 않게 화면 위 배너로 잠깐 띄웠다가 자동으로 내림.
// 배너를 누르면 지금까지처럼 가운데 상세 창, 위로 밀면 바로 내림. 내려도 읽음 처리는 안 해서 알림함에 남음
const BANNER_MS = 3000, LEAVE_MS = 280
const expanded = ref(false), leaving = ref(false)
const banner = computed(() => isSafety.value && !expanded.value)
let interval: ReturnType<typeof setInterval> | undefined
let previousFocus: HTMLElement | null = null
let hideTimer: ReturnType<typeof setTimeout> | undefined, leaveTimer: ReturnType<typeof setTimeout> | undefined
let modalOpen = false, swipeY: number | null = null, swiped = false

function restorePreviousFocus() {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  previousFocus = null
}
function stopHide() {
  clearTimeout(hideTimer); clearTimeout(leaveTimer)
  hideTimer = leaveTimer = undefined
}
function hideCurrent() {
  const id = current.value?.id
  if (id == null) return
  stopHide()
  leaving.value = true   // 위로 올라가는 동안 기다렸다가 목록에서 뺌
  leaveTimer = setTimeout(() => { leaving.value = false; notifications.dismissAppArrival(id) }, LEAVE_MS)
}
async function syncDialog() {
  await nextTick()
  const element = dialog.value
  if (eligible.value && current.value && document.visibilityState === 'visible') {
    const modal = !banner.value
    if (element?.open && modalOpen !== modal) element.close()   // 배너 <-> 상세 창 전환
    if (element && !element.open) {
      if (modal) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        element.showModal()
      } else {
        // show() 는 배너 안 버튼으로 포커스를 옮겨서, 보던 화면의 포커스를 되돌려 놓음
        const active = document.activeElement
        element.show()
        if (active instanceof HTMLElement && active !== document.body) active.focus({ preventScroll: true })
        else (document.activeElement as HTMLElement | null)?.blur()
      }
      modalOpen = modal
    }
    if (modal) { stopHide(); heading.value?.focus({ preventScroll: true }) }
    else if (!leaving.value) { stopHide(); hideTimer = setTimeout(hideCurrent, BANNER_MS) }
  } else {
    stopHide()
    if (element?.open) {
      element.close()
      if (modalOpen) restorePreviousFocus()
    }
  }
}
function swipeStart(event: PointerEvent) { swipeY = event.clientY; swiped = false }
function swipeEnd(event: PointerEvent) {
  if (swipeY !== null && event.clientY - swipeY < -24) { swiped = true; hideCurrent() }
  swipeY = null
}
function openDetail() {
  if (swiped) { swiped = false; return }
  stopHide()
  expanded.value = true
  void syncDialog()
}
function dismiss() {
  notifications.dismissAppArrivals()
}
async function acknowledge() {
  if (!current.value || busy.value) return
  const id = current.value.id, owner = app.account?.id
  busy.value = true
  actionError.value = ''
  try { await notifications.read(id) }
  catch (error) {
    if (app.account?.id === owner && current.value?.id === id)
      actionError.value = (error as Error).message || '확인 처리에 실패했습니다. 다시 시도해 주세요.'
  } finally {
    if (app.account?.id === owner) busy.value = false
  }
}
function receive(event: Event) {
  if (!eligible.value) return
  const detail = (event as CustomEvent).detail
  if (detail?.name === 'notification-new' && detail.data) notifications.ingest(detail.data)
  if (detail?.name === 'connected') void notifications.refresh()
}
function visible() {
  if (document.visibilityState === 'visible') {
    void notifications.refresh()
    void syncDialog()
  }
}
function stop() {
  if (interval !== undefined) clearInterval(interval)
  interval = undefined
  window.removeEventListener('routel-backend-event', receive)
  document.removeEventListener('visibilitychange', visible)
  notifications.setAppAlertsEnabled(false)
}
watch([() => app.account?.id, () => app.account?.role, eligible], (values, previous) => {
  stop()
  busy.value = false
  actionError.value = ''
  if (values[1] === 'customer' || previous?.[1] === 'customer') notifications.reset()
  if (eligible.value) {
    notifications.setAppAlertsEnabled(true)
    // Reuse the app's shared SSE dispatch: never open an additional stream.
    window.addEventListener('routel-backend-event', receive)
    document.addEventListener('visibilitychange', visible)
    interval = setInterval(() => {
      if (document.visibilityState === 'visible') void notifications.refresh()
    }, 30_000)
    void notifications.refresh()
  }
  void syncDialog()
}, { immediate: true })
watch(() => current.value?.id, () => {
  busy.value = false
  actionError.value = ''
  expanded.value = false
  leaving.value = false
  void syncDialog()
  // 긴급재난문자(접근 알림·진입 직전 알림)가 뜰 때 이목을 끄는 경보음. 안전 정보가 아닌 알림(공지 등)에는 울리지 않는다
  if (current.value && eligible.value && current.value.category === 'RISK' && document.visibilityState === 'visible')
    playCustomerEmergencyAlert(current.value.id, true)
})
onBeforeUnmount(() => {
  stop()
  stopHide()
  dialog.value?.close()
  restorePreviousFocus()
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="customer-arrival-alert" :class="{ 'is-banner': banner, 'is-leaving': banner && leaving }"
      :data-tone="tone" :role="banner ? 'alert' : 'alertdialog'" :aria-modal="banner ? undefined : 'true'"
      :aria-labelledby="banner ? undefined : 'customer-arrival-title'" aria-describedby="customer-arrival-body"
      @cancel.prevent="dismiss">
      <button v-if="current && banner" type="button" class="arrival-banner" aria-label="재난문자 자세히 보기"
        @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="swipeY = null" @click="openDetail">
        <span class="banner-heading">
          <svg class="arrival-warning-icon" viewBox="0 0 36 36" width="22" height="22" aria-hidden="true"><path d="M15.4 5.5a3 3 0 0 1 5.2 0l13 22.5a3 3 0 0 1-2.6 4.5H5A3 3 0 0 1 2.4 28Z" fill="currentColor"/><path d="M18 12v9" stroke="#242428" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="26" r="1.7" fill="#242428"/></svg>
          {{ tone==='danger'?'긴급 안전 안내':'안전 안내 문자' }}
          <time :datetime="current.createdAt">{{ displayDate(current.createdAt) }}</time>
        </span>
        <span id="customer-arrival-body" class="banner-body">{{ body || current.title }}</span>
        <span :key="current.id" class="banner-timer" :style="{ '--arrival-ms': `${BANNER_MS}ms` }" aria-hidden="true"></span>
      </button>
      <template v-else-if="current">
        <header class="arrival-heading">
          <span class="arrival-symbol" aria-hidden="true">
            <svg v-if="isSafety" class="arrival-warning-icon" viewBox="0 0 36 36" width="36" height="36"><path d="M15.4 5.5a3 3 0 0 1 5.2 0l13 22.5a3 3 0 0 1-2.6 4.5H5A3 3 0 0 1 2.4 28Z" fill="currentColor"/><path d="M18 12v9" stroke="#242428" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="26" r="1.7" fill="#242428"/></svg>
            <UiIcon v-else name="bell" />
          </span>
          <div><strong>{{ isSafety ? tone==='danger'?'긴급 안전 안내':'안전 안내 문자' : '새 알림' }}</strong></div>
          <button v-if="!isSafety" type="button" class="arrival-close" aria-label="알림 창 닫기" @click="dismiss">×</button>
        </header>
        <div class="arrival-content">
          <div class="arrival-meta"><span v-if="!isSafety" class="arrival-category">{{ label }}</span><time :datetime="current.createdAt">{{ displayDate(current.createdAt) }}</time></div>
          <h2 id="customer-arrival-title" ref="heading" tabindex="-1">{{ current.title }}</h2>
          <p id="customer-arrival-body" class="arrival-body">{{ body }}</p>
          <p v-if="actionError" class="arrival-error" role="alert">{{ actionError }}</p>
        </div>
        <footer class="arrival-actions">
          <button type="button" class="arrival-confirm" :disabled="busy" @click="acknowledge">{{ busy ? '확인 중…' : '확인' }}<span v-if="batchTotal>1"> ({{batchConfirmed+1}}/{{batchTotal}})</span></button>
        </footer>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog.customer-arrival-alert.customer-arrival-alert {
  --arrival-accent: #225bb5;
  box-sizing: border-box;
  width: min(380px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  padding: 0;
  border: 1px solid var(--r-line, #dbe3ed);
  border-top: 5px solid var(--arrival-accent);
  border-radius: 20px;
  background: var(--r-surface, #fff);
  color: var(--r-ink, #172d48);
  box-shadow: 0 24px 80px #10243d4d;
  font-family: var(--r-font, Pretendard, sans-serif);
  font-size: 15px;
  line-height: 1.7;
  overflow: auto;
  overscroll-behavior: contain;
}
dialog.customer-arrival-alert[data-tone="caution"] { --arrival-accent: #946000; }
dialog.customer-arrival-alert[data-tone="danger"] { --arrival-accent: #b92e47; }
:global(:root[data-theme="dark"] dialog.customer-arrival-alert) { --arrival-accent: #9ac5ff; }
:global(:root[data-theme="dark"] dialog.customer-arrival-alert[data-tone="caution"]) { --arrival-accent: #f2c879; }
:global(:root[data-theme="dark"] dialog.customer-arrival-alert[data-tone="danger"]) { --arrival-accent: #ff9aae; }
dialog.customer-arrival-alert::backdrop { background: #10243d9c; backdrop-filter: blur(3px); }
.customer-arrival-alert .arrival-heading { display: flex; align-items: center; gap: 12px; margin: 0; padding: 19px 20px; background: color-mix(in srgb, var(--arrival-accent) 8%, var(--r-surface, white)); border-bottom: 1px solid var(--r-line, #dbe3ed); }
.customer-arrival-alert .arrival-symbol { display: grid; place-items: center; flex: 0 0 42px; width: 42px; height: 42px; border: 1px solid color-mix(in srgb, var(--arrival-accent) 25%, transparent); border-radius: 13px; color: var(--arrival-accent); }
.customer-arrival-alert .arrival-heading>div { display: grid; gap: 1px; }
.customer-arrival-alert .arrival-heading strong { font-size: 17px; line-height: 1.4; }
.customer-arrival-alert button { box-sizing: border-box; font: inherit; cursor: pointer; }
.customer-arrival-alert .arrival-close { flex: 0 0 40px; width: 40px; height: 40px; margin: 0 -7px 0 auto; padding: 0; background: transparent; border: 0; border-radius: 9px; color: var(--r-muted, #63748a); font-size: 27px; line-height: 1; }
.customer-arrival-alert .arrival-content { padding: 22px 22px 20px; }
.customer-arrival-alert .arrival-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 15px; font-size: 11px; color: var(--r-muted, #63748a); }
.customer-arrival-alert .arrival-category { padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--arrival-accent) 25%, transparent); border-radius: 5px; color: var(--arrival-accent); font-weight: 700; }
.customer-arrival-alert h2 { margin: 0 0 13px; color: var(--r-ink, #172d48); font-size: 22px; font-weight: 750; line-height: 1.45; letter-spacing: -.025em; overflow-wrap: anywhere; }
.customer-arrival-alert .arrival-body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 16px; line-height: 1.75; color: var(--r-ink, #172d48); }
.customer-arrival-alert .arrival-error { margin: 12px 0 0; color: var(--r-danger, #b92e47); font-size: 13px; }
.customer-arrival-alert .arrival-actions { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 16px 22px 20px; background: var(--r-surface, #fff); border-top: 1px solid var(--r-line, #dbe3ed); }
.customer-arrival-alert .arrival-actions>button { flex: 1; min-width: 0; min-height: 46px; padding: 10px 12px; border: 1px solid var(--r-line, #dbe3ed); border-radius: 10px; line-height: 1.5; font-size: 14px; font-weight: 700; }
.customer-arrival-alert .arrival-confirm { color: var(--r-surface, #fff); background: var(--arrival-accent); border-color: var(--arrival-accent); }
.customer-arrival-alert button:disabled { opacity: .65; cursor: wait; }
.customer-arrival-alert button:focus-visible { outline: 3px solid var(--arrival-accent); outline-offset: 3px; }
.customer-arrival-alert h2:focus { outline: none; }
/* Safety arrivals use a compact alert card; general notices keep the usual app surface. */
dialog.customer-arrival-alert.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) {
  --arrival-accent: #ffb454;
  width: min(380px, calc(100vw - 32px));
  border: 1px solid #ffffff26;
  border-radius: 26px;
  background: #414147f5;
  color: #fff;
  box-shadow: 0 24px 90px #00000066, inset 0 1px #ffffff12;
  backdrop-filter: blur(24px);
}
dialog.customer-arrival-alert.customer-arrival-alert[data-tone="danger"] { --arrival-accent: #ff695d; }
dialog.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"])::backdrop { background: #11131a66; backdrop-filter: blur(5px); }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-heading { padding: 22px 24px 12px; gap: 12px; background: transparent; border: 0; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-symbol { flex-basis: 36px; width: 36px; height: 40px; border: 0; border-radius: 0; color: var(--arrival-accent); }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-heading strong { color: #fff; font-size: 18px; font-weight: 750; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-close { color: #dadbe4; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-content { padding: 10px 24px 24px; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-meta { margin-bottom: 12px; color: #d4d5de; font-size: 11px; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-category { border: 0; padding: 0; color: var(--arrival-accent); }
.customer-arrival-alert .arrival-warning-icon { color: #ff5b5b; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) h2 { margin-bottom: 10px; color: #fff; font-size: 16px; line-height: 1.5; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-body { color: #f7f7fb; font-size: 18px; line-height: 1.6; font-weight: 650; letter-spacing: -.015em; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-error { color: #ffbcb6; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-actions { padding: 0; background: #303036; border-top: 1px solid #ffffff24; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-confirm { min-height: 58px; border: 0; border-radius: 0; color: #e1edff; background: transparent; font-size: 15px; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) .arrival-confirm:hover { background: #ffffff0d; }
.customer-arrival-alert:is([data-tone="caution"],[data-tone="danger"]) button:focus-visible { outline-color: #e1edff; outline-offset: -4px; }
/* 재난문자 배너: 화면 위에 잠깐 떴다가 위로 사라짐. 뒤 화면은 막지 않음(show(), backdrop 없음) */
dialog.customer-arrival-alert.customer-arrival-alert.is-banner:is([data-tone]) {
  position: fixed;
  inset: calc(env(safe-area-inset-top, 0px) + 10px) 0 auto;
  z-index: 2147483000;
  width: min(420px, calc(100vw - 20px));
  max-height: none;
  margin: 0 auto;
  border-radius: 20px;
  overflow: hidden;
  animation: arrival-drop .32s ease-out;
  transition: transform .28s ease-in, opacity .28s ease-in;
}
dialog.customer-arrival-alert.is-banner.is-leaving { transform: translateY(calc(-100% - 24px)); opacity: 0; }
.customer-arrival-alert .arrival-banner { display: grid; gap: 6px; width: 100%; padding: 14px 18px 14px; border: 0; background: transparent; color: inherit; text-align: left; touch-action: none; user-select: none; }
.customer-arrival-alert .banner-heading { display: flex; align-items: center; gap: 8px; color: var(--arrival-accent); font-size: 14px; font-weight: 750; line-height: 1.4; }
.customer-arrival-alert .banner-heading time { margin-left: auto; color: #d4d5de; font-size: 11px; font-weight: 400; }
.customer-arrival-alert .banner-body { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; color: #f7f7fb; font-size: 16px; font-weight: 650; line-height: 1.5; letter-spacing: -.015em; overflow-wrap: anywhere; }
.customer-arrival-alert .banner-timer { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: var(--arrival-accent); transform-origin: left; animation: arrival-countdown var(--arrival-ms) linear forwards; }
@keyframes arrival-drop { from { transform: translateY(calc(-100% - 24px)); opacity: 0; } }
@keyframes arrival-countdown { to { transform: scaleX(0); } }
@media (prefers-reduced-motion: reduce) {
  dialog.customer-arrival-alert, dialog.customer-arrival-alert::backdrop { animation: none; transition: none; }
}
</style>
