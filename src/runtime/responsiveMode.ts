// 태블릿(패드) 등 넓은 화면 맞춤. 켜면 앱이 휴대폰 폭(430px)에 갇히지 않고 화면 폭에 맞춰 넓어진다.
// 설정은 이 기기의 브라우저에만 저장된다(기본 켬). 실제 모양은 styles/tablet-responsive.css 가 <html data-responsive> 로 정한다.
const KEY = 'routel-responsive'

export function responsiveEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function applyResponsive(on: boolean) {
  document.documentElement.dataset.responsive = on ? 'on' : 'off'
}
export function setResponsive(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* 저장이 안 돼도 이번 화면에서는 바뀐다 */ }
  applyResponsive(on)
}
export function initResponsive() {
  applyResponsive(responsiveEnabled())
}
