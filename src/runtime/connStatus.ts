// 실시간 연결 상태(SSE). 예전에는 화면 상단 바로 보여줬지만, 지금은 헤더의 작은 점(ConnDot.vue)으로만 표시한다.
// SSE 상태는 useBackendEvents.ts 가 reportSse 로 알려준다.
import { reactive } from 'vue'

type Sse = 'idle' | 'connecting' | 'open' | 'lost'
export const connState = reactive({ sse: 'idle' as Sse, lastAt: 0, lastName: '', retry: 0, url: '' })

export function reportSse(state: Sse, extra?: { event?: string; retry?: number; url?: string }) {
  connState.sse = state
  if (extra?.url) connState.url = extra.url
  if (typeof extra?.retry === 'number') connState.retry = extra.retry
  if (extra?.event) {
    connState.lastAt = Date.now()
    connState.lastName = extra.event
  }
}

// 메인 서버는 SSE 만 사용한다(WebSocket 제거). 호출부 호환을 위해 빈 함수로 둔다.
export function probeWs() {}

// 상단 표시줄은 폐지했다. 호출부 호환을 위해 빈 함수로 둔다.
export function installConnStatus() {}
