<script setup lang="ts">
// 관리자 앱 목록 화면의 조건 영역: 기본은 검색창 + 한 줄 칩만 보이고, 칩을 누르면 선택지가 칩 아래에 열린다.
import { onBeforeUnmount, onMounted, ref } from 'vue'
export type FilterOption = { value: string; label: string }
export type FilterChip = {
  key: string
  label: string
  kind?: 'select' | 'range'
  options?: FilterOption[]
  value?: string
  from?: string
  to?: string
}
const props = defineProps<{ chips: FilterChip[]; search?: string; searchLabel?: string; busy?: boolean }>()
const emit = defineEmits<{
  'update:search': [value: string]
  submit: []
  select: [key: string, value: string]
  range: [key: string, from: string, to: string]
}>()
const root = ref<HTMLElement>(),
  openKey = ref(''),
  menuLeft = ref(0),
  menuWidth = ref(260),
  from = ref(''),
  to = ref(''),
  rangeError = ref('')
const shortDate = (value?: string) => (value ? value.slice(5).replace('-', '.') : '')
function selectedLabel(chip: FilterChip) {
  if (chip.kind === 'range') return chip.from || chip.to ? `${shortDate(chip.from) || '처음'} ~ ${shortDate(chip.to) || '오늘'}` : ''
  return chip.options?.find(option => option.value === (chip.value ?? ''))?.label || ''
}
const isActive = (chip: FilterChip) => (chip.kind === 'range' ? !!(chip.from || chip.to) : !!chip.value)
function toggle(chip: FilterChip, event: Event) {
  if (openKey.value === chip.key) {
    openKey.value = ''
    return
  }
  openKey.value = chip.key
  from.value = chip.from || ''
  to.value = chip.to || ''
  rangeError.value = ''
  const box = root.value!.getBoundingClientRect(),
    target = (event.currentTarget as HTMLElement).getBoundingClientRect()
  menuWidth.value = Math.min(chip.kind === 'range' ? 300 : 280, box.width)
  menuLeft.value = Math.max(0, Math.min(target.left - box.left, box.width - menuWidth.value))
}
function pick(chip: FilterChip, value: string) {
  openKey.value = ''
  emit('select', chip.key, value)
}
function applyRange(chip: FilterChip) {
  if (from.value && to.value && from.value > to.value) {
    rangeError.value = '시작일은 종료일보다 늦을 수 없습니다.'
    return
  }
  openKey.value = ''
  emit('range', chip.key, from.value, to.value)
}
function clearRange(chip: FilterChip) {
  openKey.value = ''
  emit('range', chip.key, '', '')
}
function close(event: Event) {
  if (openKey.value && root.value && !root.value.contains(event.target as Node)) openKey.value = ''
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape') openKey.value = ''
}
onMounted(() => {
  document.addEventListener('pointerdown', close, true)
  document.addEventListener('keydown', escape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', close, true)
  document.removeEventListener('keydown', escape)
})
</script>
<template>
  <div ref="root" class="compact-filters">
    <form v-if="search !== undefined" class="compact-search" role="search" @submit.prevent="openKey = ''; emit('submit')">
      <input
        :value="search"
        type="search"
        :placeholder="searchLabel || '검색'"
        :aria-label="searchLabel || '검색'"
        maxlength="100"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
      <button type="submit" :disabled="busy">조회</button>
    </form>
    <div class="compact-chips" role="group" aria-label="조회 조건">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="compact-chip"
        :class="{ 'is-active': isActive(chip), 'is-open': openKey === chip.key }"
        :aria-expanded="openKey === chip.key"
        aria-haspopup="true"
        @click="toggle(chip, $event)"
      >
        <span>{{ isActive(chip) ? `${chip.label}: ${selectedLabel(chip)}` : chip.label }}</span>
        <i aria-hidden="true">{{ openKey === chip.key ? '▴' : '▾' }}</i>
      </button>
    </div>
    <template v-for="chip in chips" :key="'menu-' + chip.key">
      <div
        v-if="openKey === chip.key"
        class="compact-menu"
        :style="{ left: menuLeft + 'px', width: menuWidth + 'px' }"
        role="dialog"
        :aria-label="chip.label + ' 선택'"
      >
        <template v-if="chip.kind === 'range'">
          <label>시작일<input v-model="from" type="date" :max="to || undefined" /></label>
          <label>종료일<input v-model="to" type="date" :min="from || undefined" /></label>
          <p v-if="rangeError" class="compact-error" role="alert">{{ rangeError }}</p>
          <div class="compact-actions">
            <button type="button" @click="clearRange(chip)">초기화</button>
            <button type="button" class="is-primary" @click="applyRange(chip)">적용</button>
          </div>
        </template>
        <ul v-else role="listbox" :aria-label="chip.label">
          <li
            v-for="option in chip.options"
            :key="option.value"
            role="option"
            :aria-selected="option.value === (chip.value ?? '')"
          >
            <button type="button" :class="{ 'is-selected': option.value === (chip.value ?? '') }" @click="pick(chip, option.value)">
              {{ option.label }}<span v-if="option.value === (chip.value ?? '')" aria-hidden="true"> ✓</span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
<style scoped>
.compact-filters { position:relative; display:flex; flex-direction:column; gap:8px; margin:0 0 10px; min-width:0; }
.compact-search { display:flex; gap:8px; }
.compact-search input { flex:1; min-width:0; height:44px; box-sizing:border-box; padding:0 14px; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); font:inherit; font-size:15px; }
.compact-search button { flex:none; height:44px; padding:0 18px; border:0; border-radius:12px; background:var(--r-primary,linear-gradient(115deg,#2467b4,#287ed5)); color:#fff; font:inherit; font-weight:700; font-size:14px; cursor:pointer; }
.compact-search button:disabled { opacity:.6; }
.compact-chips { display:flex; gap:6px; overflow-x:auto; padding:2px 1px 4px; scrollbar-width:none; }
.compact-chips::-webkit-scrollbar { display:none; }
.compact-chip { flex:none; display:inline-flex; align-items:center; gap:4px; height:34px; padding:0 12px; border:1px solid var(--r-line,#dce7f2); border-radius:17px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); font:inherit; font-size:13px; white-space:nowrap; cursor:pointer; }
.compact-chip i { font-style:normal; font-size:10px; color:var(--r-muted,#5c738b); }
.compact-chip.is-active { border-color:#9cc3f0; background:var(--r-selected,#eaf3ff); color:#17509a; font-weight:700; }
.compact-chip.is-open { border-color:var(--r-accent,#2375d6); }
.compact-menu { position:absolute; top:100%; z-index:20; box-sizing:border-box; max-height:min(320px,50vh); overflow:auto; margin-top:-2px; padding:6px; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); box-shadow:var(--r-overlay-shadow,0 8px 24px #1534522e); }
.compact-menu ul { list-style:none; margin:0; padding:0; }
.compact-menu li button { display:block; width:100%; min-height:40px; padding:0 12px; border:0; border-radius:8px; background:transparent; color:var(--r-ink,#172e49); font:inherit; font-size:14px; text-align:left; cursor:pointer; }
.compact-menu li button.is-selected { background:var(--r-selected,#eaf3ff); color:#17509a; font-weight:700; }
.compact-menu label { display:flex; flex-direction:column; gap:4px; margin:6px 6px 10px; color:var(--r-muted,#5c738b); font-size:12px; }
.compact-menu label input { height:40px; box-sizing:border-box; padding:0 10px; border:1px solid var(--r-line,#dce7f2); border-radius:10px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); font:inherit; font-size:14px; }
.compact-error { margin:0 6px 8px; color:#c0392b; font-size:12px; }
.compact-actions { display:flex; gap:8px; margin:0 6px 6px; }
.compact-actions button { flex:1; height:40px; border:1px solid var(--r-line,#dce7f2); border-radius:10px; background:var(--r-surface,#fff); color:var(--r-ink,#172e49); font:inherit; font-weight:700; cursor:pointer; }
.compact-actions button.is-primary { border:0; background:var(--r-primary,linear-gradient(115deg,#2467b4,#287ed5)); color:#fff; }
:root[data-theme=dark] .compact-chip.is-active, :root[data-theme=dark] .compact-menu li button.is-selected { color:#cfe5ff; }
</style>
