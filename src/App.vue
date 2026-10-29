<script setup lang="ts">
import './styles/customer-app-shell.css'
import './styles/notification-glow.css'
import { useNotificationGlow } from './stores/notificationGlow'
import { useBackendEvents } from './composables/useBackendEvents'
import { useBackendStream } from './composables/useBackendEvents'
import AdminAppNav from './components/AdminAppNav.vue'
import AdminAppHeader from './components/AdminAppHeader.vue'
import PwaStatus from './components/PwaStatus.vue'
import ConnDot from './components/ConnDot.vue'
import { watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VNode } from 'vue'
import ServiceAppLayout from './components/ServiceAppLayout.vue'
import AdminAppFacilityLive from './pages/admin-app-facility-live.vue'
import AdminAppOverview from './pages/admin-app-overview.vue'
import ServiceAuth from './pages/service-auth.vue'
import ServiceNotifications from './pages/service-notifications.vue'
import ServiceAccount from './pages/service-account.vue'
import PmEquipmentLive from './pages/pm-equipment-live.vue'
import PmEquipmentDetailLive from './pages/pm-equipment-detail-live.vue'
import PmQueueLive from './pages/pm-queue-live.vue'
import PmHistoryLive from './pages/pm-history-live.vue'
import PmInspection from './pages/pm-inspection.vue'
import PmSettings from './pages/pm-settings-live.vue'
import PmDaily from './pages/pm-daily-live.vue'
import ServiceResource from './pages/backend-resource.vue'
import LiveMap from './pages/c-live-map.vue'
import { resourceRoutes } from './data/backendResources'
import AdminHandover from './components/AdminHandover.vue'
import ManagerUrgentAlert from './components/ManagerUrgentAlert.vue'
import DevicePushBridge from './components/DevicePushBridge.vue'
import PushConsentPrompt from './components/PushConsentPrompt.vue'
import CustomerArrivalAlert from './components/CustomerArrivalAlert.vue'
import PublicChatbot from './components/PublicChatbot.vue'
import CustomerRuGuide from './components/CustomerRuGuide.vue'
import { mobileInteractions } from './runtime/mobileInteractions'
import { useApp } from './stores/app'
import { enableFcm, resetFcmOwner, syncFcmOptOut } from './services/fcmPush'
import { unlockManagerAlertAudio, playManagerAlert } from './runtime/managerAlertSound'
useBackendStream()
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockManagerAlertAudio, { passive: true })
  window.addEventListener('keydown', unlockManagerAlertAudio)
  window.addEventListener('puf-fcm-message', ((event: Event) => {
    if (app.account?.role !== 'REGIONAL_ADMIN') return
    const payload = (event as CustomEvent).detail
    playManagerAlert(payload?.data?.notificationId, payload?.data?.urgent === 'true')
  }) as EventListener)
}
const app = useApp()
const notificationGlow = useNotificationGlow()
watch(() => [app.account?.id, app.account?.role] as const, ([id, role], previous) => {
  const oldId = previous?.[0]
  const oldRole = previous?.[1]
  notificationGlow.reset()
  if (!id || !role) { resetFcmOwner(); return }
  if ((id !== oldId || role !== oldRole) && 'Notification' in window && Notification.permission === 'granted') {
    const fcmRole = role === 'customer' ? 'customer' : 'REGIONAL_ADMIN'
    void syncFcmOptOut(fcmRole, String(id)).then((optedOut) => {
      if (optedOut || app.account?.id !== id || app.account?.role !== role) return
      return enableFcm(fcmRole, String(id))
    }).catch(e => console.warn('FCM 자동 재등록 실패:', e))
  }
}, { immediate: true })
useBackendEvents(({ name, data }) => {
  if (name === 'notification-new') {
    notificationGlow.mark('notification', data.id)
    if (app.account?.role === 'REGIONAL_ADMIN') playManagerAlert(data.id, data.isUrgent === true || data.urgent === true)
  }
  if (name === 'notice-new') notificationGlow.mark('notice', data.id ?? data.noticeId)
  if (name === 'inquiry-new') notificationGlow.mark('inquiry', data.id ?? data.inquiryId)
})
watch(
  () => app.theme,
  (t) => (document.documentElement.dataset.theme = t),
  { immediate: true },
)
const route = useRoute(),
  router = useRouter()
watch(
  () => route.path,
  (path) => {
    if (!/^\/(admin|customer)-app\//.test(path)) return
    const kind = path.startsWith('/admin-app/') ? 'admin' : 'customer'
    const manifest = document.querySelector<HTMLLinkElement>('#app-manifest'),
      icon = document.querySelector<HTMLLinkElement>('#app-touch-icon')
    if (manifest) manifest.href = `/${kind}.webmanifest`
    if (icon) icon.href = `/icons/${kind}-ru-180-v1.png`
  },
  { immediate: true },
)
const serviceComponent = computed(() => {
  const path = route.path
  if (path === '/customer-app/screen-12') return ServiceNotifications
  if (
    [
      '/admin-app/screen-1',
      '/customer-app/screen-1',
      '/customer-app/screen-2',
      '/customer-app/screen-3',
      '/customer-app/screen-4',
      '/customer-app/password-reset',
      '/admin-app/signup',
      '/admin-app/password-reset',
    ].includes(path)
  )
    return ServiceAuth
  if (['/customer-app/notices', '/customer-app/faq'].includes(path))
    return ServiceResource
  if (['/customer-app/screen-5', '/customer-app/screen-6'].includes(path)) return LiveMap
  if (path === '/admin-app/screen-9') return PmEquipmentLive
  if (path === '/admin-app/screen-10') return PmEquipmentDetailLive
  if (path === '/admin-app/screen-11') return PmQueueLive
  if (path === '/admin-app/history') return PmHistoryLive
  if (path === '/admin-app/inspection') return PmInspection
  if (path === '/admin-app/pm-settings') return PmSettings
  if (path === '/admin-app/pm-daily') return PmDaily
  // screen-6(통제)·7(통제 중)·8(해제)은 시설 0번 고정 목업이었다. 실제 통제·해제 API를 쓰는 시설 화면으로 보낸다
  if (['/admin-app/screen-5', '/admin-app/screen-6', '/admin-app/screen-7', '/admin-app/screen-8'].includes(path))
    return AdminAppFacilityLive
  if (path === '/admin-app/screen-3') return AdminAppOverview
  if (
    path === '/admin-app/screen-14' ||
    /^\/customer-app\/account\/(profile|emergency|cars|settings|withdraw)$/.test(path)
  )
    return ServiceAccount
  if (
    resourceRoutes[path] ||
    /^\/admin-app\/(ocr|reviews|transits)$/.test(path)
  )
    return ServiceResource
  return null
})
const managerApp = computed(
  () =>
    route.path.startsWith('/admin-app/') &&
    !['/admin-app/screen-1', '/admin-app/signup', '/admin-app/password-reset'].includes(route.path),
)
const appService = computed(
  () => !!serviceComponent.value && /^\/(admin|customer)-app\//.test(route.path),
)
const cleanups = new Map<HTMLElement, () => void>()
function mounted(vnode: VNode) {
  const el = vnode.el as HTMLElement
  if (
    !serviceComponent.value &&
    (route.path.startsWith('/customer-app/') || route.path.startsWith('/admin-app/'))
  )
    cleanups.set(el, mobileInteractions(el, route.path, router, app))
}
function unmounted(vnode: VNode) {
  const el = vnode.el as HTMLElement
  cleanups.get(el)?.()
  cleanups.delete(el)
}
</script>
<template>
  <div
    :class="{'admin-interface':!route.path.startsWith('/customer-app/'),'manager-app-shell':managerApp,'customer-app-editorial':route.path.startsWith('/customer-app/')&&!['/customer-app/screen-5','/customer-app/screen-6'].includes(route.path),'service-mobile':appService}"
  >
    <ConnDot v-if="/^\/(admin|customer)-app\//.test(route.path)" />
    <AdminAppHeader v-if="managerApp&&route.path!=='/admin-app/menu'" />
    <PwaStatus :hide-install="managerApp" v-if="/^\/(admin|customer)-app\//.test(route.path)" />
    <AdminHandover v-if="app.account?.role==='REGIONAL_ADMIN'" />
    <ManagerUrgentAlert v-if="app.account?.role==='REGIONAL_ADMIN'" />
    <CustomerArrivalAlert />
    <DevicePushBridge />
    <PushConsentPrompt />
    <RouterView v-slot="{Component}">
      <ServiceAppLayout v-if="appService">
        <component :is="serviceComponent" :key="$route.path" />
      </ServiceAppLayout>
      <component
        v-else
        :is="serviceComponent||Component"
        :key="$route.path"
        @vue:mounted="mounted"
        @vue:unmounted="unmounted"
      />
    </RouterView>
    <AdminAppNav v-if="managerApp&&route.path!=='/admin-app/menu'" />
    <PublicChatbot v-if="route.path.startsWith('/customer-app/')" />
    <CustomerRuGuide :key="managerApp?'manager-guide':'customer-guide'" :manager="managerApp" />
  </div>
</template>
