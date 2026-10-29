<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { connState } from '../runtime/connStatus'
// 실시간(SSE) 연결 상태를 화면 우상단의 깜빡이는 점 하나로 보여준다. 연결됨=초록, 그 외(연결 중·끊김·수신 없음)=노랑.
// App.vue 에서 한 번만 만들어 두므로 페이지를 옮겨도 사라지거나 다시 시작되지 않는다(헤더 안에 넣지 말 것).
// 서버 하트비트가 30초 간격이라 70초 넘게 아무 이벤트도 없으면 끊긴 것으로 본다.
const now = ref(Date.now())
let timer: number | undefined
onMounted(() => { timer = window.setInterval(() => (now.value = Date.now()), 5000) })
onBeforeUnmount(() => clearInterval(timer))
const ok = computed(() => connState.sse === 'open' && (!connState.lastAt || now.value - connState.lastAt <= 70000))
const label = computed(() => (ok.value ? '실시간 연결됨' : '실시간 연결 확인 중'))
</script>
<template>
  <span class="conn-dot" :class="ok ? 'is-ok' : 'is-warn'" role="img" :aria-label="label" :title="label"></span>
</template>
<style scoped>
.conn-dot { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); right: calc(max(0px, (100vw - 430px) / 2) + 4px); z-index: 60; display: block; width: 8px; height: 8px; margin: 0; border-radius: 50%; pointer-events: none; animation: conn-dot-blink 1.8s ease-in-out infinite; }
.conn-dot.is-ok { background: #22c55e; box-shadow: 0 0 6px #22c55e99; }
.conn-dot.is-warn { background: #f5b301; box-shadow: 0 0 6px #f5b30199; }
@keyframes conn-dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .conn-dot { animation: none; } }
</style>
