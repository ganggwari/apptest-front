<script setup lang="ts">
import { ref } from 'vue'
import { responsiveEnabled, setResponsive } from '../runtime/responsiveMode'
const on = ref(responsiveEnabled())
function toggle() {
  on.value = !on.value
  setResponsive(on.value)
}
</script>
<template>
  <section class="account-panel responsive-settings">
    <div class="responsive-row">
      <div>
        <strong>태블릿·넓은 화면 맞춤</strong>
        <p>패드처럼 화면이 넓은 기기에서 앱을 화면 폭에 맞춰 넓게 보여 줘요. 끄면 휴대폰 크기로 가운데에 표시돼요. 이 기기에만 적용돼요.</p>
      </div>
      <button type="button" class="responsive-switch" role="switch" :aria-checked="on" :aria-label="`태블릿·넓은 화면 맞춤 ${on ? '켬' : '끔'}`" @click="toggle">
        {{ on ? '켬' : '끔' }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.responsive-settings.account-panel { padding:14px 16px; margin:12px 0; }
.responsive-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.responsive-row p { margin:2px 0 0; color:var(--r-muted,#5c738b); font-size:13px; line-height:20px; }
.responsive-switch { flex:none; min-width:64px; min-height:40px; padding:0 14px; border:1px solid var(--r-line,#c8d3df); border-radius:20px; background:var(--r-surface,#fff); color:inherit; font:inherit; font-weight:600; cursor:pointer; }
.responsive-switch[aria-checked='true'] { background:var(--r-accent,#1674d3); border-color:var(--r-accent,#1674d3); color:#fff; }
</style>
