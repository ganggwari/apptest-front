// iOS Safari 는 프런트와 백엔드가 서로 다른 도메인이면 세션 쿠키를 막거나 금방 지운다.
// 로그인 응답의 X-Auth-Token 헤더를 localStorage 에 보관했다가 요청마다 Authorization 헤더로 보내면 쿠키 없이도 로그인이 유지된다.
const KEY = 'routel-auth-token'
export function getAuthToken(): string {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 쿠키 로그인만 쓴다
  }
}
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
