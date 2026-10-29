<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { backend } from '../services/backend'
import { enableFcm, disableFcm, isFcmActive, setFcmOptOut } from '../services/fcmPush'
import { useApp } from '../stores/app'
import { useCustomerNotifications } from '../stores/customerNotifications'
const app = useApp()
const notifications = useCustomerNotifications(),
  devices = ref<{ id: number; platform: string; active: boolean }[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref('')
const supported = 'Notification' in window,
  permission = ref(supported ? Notification.permission : 'unsupported')
const controller = new AbortController()
// 스위치 상태는 실제 푸시 연결(권한 허용 + 이 기기가 내 계정에 등록됨)을 기준으로 한다.
// 앱을 다시 설치했거나 로그인 때 자동 연결된 경우에도 실제 상태와 스위치가 어긋나지 않는다.
const fcmTick = ref(0)
const pushOn = computed(() => {
  void fcmTick.value
  return supported && !!app.account && app.account.role === 'customer' && isFcmActive('customer', String(app.account.id))
})
function syncSwitch() {
  permission.value = supported ? Notification.permission : 'unsupported'
  fcmTick.value++
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    devices.value =
      (await backend('/api/customers/me/device-tokens', { signal: controller.signal })) || []
  } catch (e) {
    if (!controller.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
async function toggle() {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    if (pushOn.value) {
      await disableFcm('customer')
      setFcmOptOut('customer', String(app.account!.id), true)
      notifications.setBrowserEnabled(false)
      message.value = '이 기기의 푸시 알림을 껐습니다.'
      return
    }
    if (!supported) {
      message.value = '이 브라우저는 알림을 지원하지 않습니다.'
      return
    }
    if (!app.account || app.account.role !== 'customer') throw new Error('고객 로그인이 필요합니다.')
    if (Notification.permission === 'denied') {
      permission.value = 'denied'
      message.value = '브라우저의 사이트 설정에서 알림 권한을 허용해 주세요.'
      return
    }
    // 권한이 아직 없으면 이 클릭에서 바로 묻는다(허용돼 있으면 묻지 않고 바로 연결한다)
    await enableFcm('customer', String(app.account.id), Notification.permission !== 'granted')
    setFcmOptOut('customer', String(app.account.id), false)
    notifications.setBrowserEnabled(true)
    await load()
    message.value = 'FCM 푸시 토큰이 등록되었습니다. 앱을 닫아도 푸시를 받을 수 있습니다.'
  } catch (e) {
    message.value = (e as Error).message || 'FCM 등록에 실패했습니다.'
  } finally {
    busy.value = false
    syncSwitch()
  }
}
onMounted(() => {
  void notifications.refresh()
  void load()
  syncSwitch()
  window.addEventListener('routel:push-device-updated', syncSwitch)
})
onBeforeUnmount(() => {
  controller.abort()
  window.removeEventListener('routel:push-device-updated', syncSwitch)
})
</script>
<template>
  <section class="notification-settings" aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title">알림 수신 설정</h2>
    <div class="notification-setting-row">
      <div>
        <strong>이 기기 푸시 알림</strong>
        <p>앱을 닫아 둔 상태에서도 새 알림을 받습니다. 이 기기에만 적용됩니다.</p>
      </div>
      <button
        type="button"
        class="notification-setting-switch"
        role="switch"
        :aria-checked="pushOn"
        aria-label="이 기기 푸시 알림"
        :disabled="busy||!supported"
        @click="toggle"
      >
        {{busy?'처리 중':pushOn?'켜짐':'꺼짐'}}
      </button>
    </div>
    <p v-if="permission==='denied'" class="notification-setting-help">알림 권한이 차단되어 있습니다. 주소창 옆 사이트 설정에서 허용할 수 있습니다.</p>
    <p v-if="!supported" class="notification-setting-help">현재 브라우저는 브라우저 알림을 지원하지 않습니다.</p>
    <p v-if="message" role="status">{{message}}</p>
    <div class="notification-device-heading">
      <h3>등록된 알림 기기</h3>
      <button type="button" :disabled="loading" @click="load">새로고침</button>
    </div>
    <p v-if="loading" role="status">등록된 기기를 확인하고 있습니다.</p>
    <div v-else-if="error" role="alert">
      <p>{{error}}</p>
      <button type="button" @click="load">다시 불러오기</button>
    </div>
    <ul v-else-if="devices.length" class="notification-device-list">
      <li v-for="(device,index) in devices" :key="device.id">
        <span>{{device.platform==='APP'?'모바일 앱':'웹 브라우저'}} {{index+1}}</span>
        <span class="notification-device-state">{{device.active?'알림 수신 중':'수신 중지'}}</span>
      </li>
    </ul>
    <p v-else class="notification-setting-help">등록된 기기가 없습니다. 앱에서 알림을 허용하면 연결된 기기가 표시됩니다.</p>
    <p v-if="devices.length" class="notification-setting-help">모바일 앱의 푸시 알림은 해당 기기의 알림 설정에서 변경할 수 있습니다.</p>
  </section>
</template>
<style scoped src="../styles/components/notification-settings.css"></style>
