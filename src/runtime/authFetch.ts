import { API_ORIGIN } from '../services/apiOrigin'
import { clearAuthToken, getAuthToken, setAuthToken } from '../services/authToken'

// window.fetch 를 한 번 감싸서 백엔드 API 요청에 로그인 토큰을 붙이고, 로그인 응답의 토큰을 저장한다.
// 쿠키 로그인은 그대로 두고(credentials: include) 토큰을 보조로 쓰는 방식이라 안드로이드·PC 동작은 바뀌지 않는다.
export function installAuthFetch(): void {
  const w = window as unknown as { __authFetchInstalled?: boolean }
  if (w.__authFetchInstalled) return
  w.__authFetchInstalled = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const isApi = url.startsWith(`${API_ORIGIN}/api/`) || url.startsWith('/api/')
    if (!isApi) return original(input, init)
    const token = getAuthToken()
    let nextInput = input
    let nextInit = init
    if (token) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
      if (input instanceof Request) nextInput = new Request(input, { headers })
      else nextInit = { ...init, headers }
    }
    const response = await original(nextInput, nextInit)
    const issued = response.headers.get('X-Auth-Token')
    if (issued) setAuthToken(issued)
    if (url.includes('/api/auth/logout')) clearAuthToken()
    // 만료·무효 토큰이 남아 계속 401 이 나지 않게 정리한다 (로그인 요청 자체의 401 은 토큰과 무관)
    else if (response.status === 401 && token && !url.includes('/login')) clearAuthToken()
    return response
  }
}
