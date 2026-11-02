<script setup lang="ts">
// 예지보전 점검 수동 등록 (관리자 앱 새 페이지). 설비 상세·점검 대기·점검 이력의 "+ 점검 등록" 이 이 페이지로 온다.
//  GET  /api/pm/equipments/{id}        설비 하나 (?id= 로 들어온 경우, 설비 고정)
//  GET  /api/pm/equipments?size=100    설비 고르기 목록 (?id= 가 없을 때)
//  POST /api/pm/events {equipId, reason, priority, content}   점검 대기(수동등록)를 만들고 첫 기록을 남긴다
//        점검 후 쿨다운과 상관없이 등록되고, 같은 설비에 처리 중인 점검이 있으면 409, 노면 설비는 400
// 등록자는 서버가 로그인한 관리자로 기록하므로 입력받지 않는다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import { backend, type PageData } from '../services/backend'
import { managerAppPath } from '../utils/manager-app-path'
import { PM_TYPES, pmLabel } from '../utils/pm-labels'

type Equip = { equipId: number; name: string; type: string; underpassName?: string; openEventId?: number | null }
const REASONS = ['현장 이상 발견', '정기 점검', '민원·제보', '기타']
const PRIORITIES = ['보통', '높음']

const route = useRoute(), router = useRouter()
const appPath = (path: string) => managerAppPath(path, route.path)
const fixedId = computed(() => String(route.query.id || ''))
const equipments = ref<Equip[]>([]), fixed = ref<Equip>()
const equipId = ref(''), reason = ref(REASONS[0]!), priority = ref(PRIORITIES[0]!), content = ref('')
const loading = ref(false), busy = ref(false), error = ref(''), done = ref(false)
let controller: AbortController | undefined

// 처리 중인 점검이 있거나 노면 설비는 수동 등록 대상에서 뺀다 (서버도 막는다)
const options = computed(() =>
  equipments.value.filter((e) => e.type !== 'ROAD' && !e.openEventId).sort((a, b) => a.name.localeCompare(b.name)),
)
const blocked = computed(() => {
  const e = fixed.value
  if (!e) return ''
  if (e.type === 'ROAD') return '노면 설비는 탐지 확인·조치 영역에서 처리해 주세요.'
  if (e.openEventId) return '이미 처리 중인 점검이 있어요. 해당 점검을 먼저 끝내 주세요.'
  return ''
})
const canSubmit = computed(() => !busy.value && !loading.value && !done.value && !blocked.value && !!(fixedId.value ? fixed.value : equipId.value) && !!content.value.trim())

async function load() {
  controller?.abort()
  const request = new AbortController(); controller = request
  error.value = ''; fixed.value = undefined; loading.value = true
  try {
    if (fixedId.value) {
      const detail = await backend<{ equipment: Record<string, any> }>(`/api/pm/equipments/${encodeURIComponent(fixedId.value)}`, { signal: request.signal })
      if (request.signal.aborted) return
      const e = detail.equipment
      fixed.value = { equipId: Number(e.equipId), name: String(e.name || ''), type: String(e.type || ''), underpassName: e.underpassName, openEventId: e.openEventId }
      equipId.value = String(fixed.value.equipId)
    } else {
      const page = await backend<PageData<Equip>>('/api/pm/equipments?size=100', { signal: request.signal })
      if (!request.signal.aborted) equipments.value = page.items
    }
  } catch (cause) { if (!request.signal.aborted) error.value = (cause as Error).message || '설비 정보를 불러오지 못했습니다.' }
  finally { if (!request.signal.aborted) loading.value = false }
}
watch(fixedId, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())

async function submit() {
  const text = content.value.trim()
  if (!equipId.value) { error.value = '설비를 선택해 주세요.'; return }
  if (!text) { error.value = '점검 내용을 입력해 주세요.'; return }
  busy.value = true; error.value = ''
  try {
    await backend('/api/pm/events', {
      method: 'POST',
      body: { equipId: Number(equipId.value), reason: reason.value, priority: priority.value, content: text },
    })
    done.value = true
    await router.replace(appPath('/pm-queue'))
  } catch (cause) {
    error.value = (cause as Error).message || '점검 등록에 실패했습니다.'
  } finally { busy.value = false }
}
</script>

<template>
  <BackendLayout>
    <section class="service-workspace pm-register-page">
      <div class="service-heading"><h1><AdminPageIcon />점검 등록</h1></div>
      <p class="register-lead">현장에서 이상을 발견했거나 정기 점검이 필요할 때 점검 대기를 직접 만들어요. 등록하면 '확인 필요' 상태가 되고, 등록자는 로그인한 관리자로 기록돼요.</p>
      <p v-if="loading" role="status">설비 정보를 불러오는 중입니다.</p>
      <form class="register-form" @submit.prevent="submit">
        <section v-if="fixed" class="register-target">
          <small>{{fixed.underpassName}}</small>
          <h2>{{fixed.name}} <span>· {{pmLabel(PM_TYPES,fixed.type)}}</span></h2>
        </section>
        <label v-else class="register-field">설비
          <select v-model="equipId" :disabled="loading||busy" @change="error=''">
            <option value="">설비를 선택해 주세요</option>
            <option v-for="e in options" :key="e.equipId" :value="String(e.equipId)">{{e.name}}<template v-if="e.underpassName"> · {{e.underpassName}}</template></option>
          </select>
        </label>
        <p v-if="blocked" class="service-error" role="alert">{{blocked}}</p>
        <div class="register-row">
          <label class="register-field">점검 사유
            <select v-model="reason" :disabled="busy"><option v-for="r in REASONS" :key="r" :value="r">{{r}}</option></select>
          </label>
          <label class="register-field">우선순위
            <select v-model="priority" :disabled="busy"><option v-for="p in PRIORITIES" :key="p" :value="p">{{p}}</option></select>
          </label>
        </div>
        <label class="register-field">점검 내용 (필수)
          <textarea v-model="content" rows="6" maxlength="1900" :disabled="busy" placeholder="예) 화면 하단 깜빡임 확인, 현장 점검 필요" @input="error=''"></textarea>
          <small>{{content.length}} / 1900</small>
        </label>
        <p v-if="error" class="service-error" role="alert">{{error}}</p>
        <div class="register-actions">
          <RouterLink class="btn" :to="fixedId?{path:appPath('/pm-equipment-detail'),query:{id:fixedId}}:appPath('/pm-queue')">취소</RouterLink>
          <button class="btn primary" type="submit" :disabled="!canSubmit">{{busy?'등록 중…':'등록'}}</button>
        </div>
      </form>
    </section>
  </BackendLayout>
</template>

<style scoped>
.pm-register-page { max-width:640px; margin-inline:auto; }
.register-lead { margin:0 0 16px; color:var(--r-muted,#5c738b); font-size:13px; line-height:20px; }
.register-form { display:flex; flex-direction:column; gap:14px; }
.register-target { padding:14px 16px; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); }
.register-target small { color:var(--r-muted,#5c738b); font-size:13px; }
.register-target h2 { margin:4px 0 0; font-size:17px; line-height:26px; }
.register-target h2 span { font-size:13px; font-weight:400; }
.register-field { display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:600; }
.register-field select,.register-field textarea { width:100%; box-sizing:border-box; font:inherit; font-weight:400; }
.register-field small { color:var(--r-muted,#5c738b); font-weight:400; text-align:right; }
.register-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.register-actions { display:flex; gap:8px; justify-content:flex-end; position:sticky; bottom:0; padding:10px 0; background:var(--r-bg,transparent); }
.register-actions .btn { min-width:96px; text-align:center; }
</style>
