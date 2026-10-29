import type { Router } from 'vue-router'
import { useApp } from '../stores/app'
import { restoreSession } from './session'
import { setUnauthorizedHandler } from '../runtime/authFetch'
import { requiresCustomer, requiresManager } from './access'

// 로그인이 풀리면 곧바로 로그인 화면으로 보낸다.
// 관리자 앱과 고객 앱은 같은 브라우저(저장소·쿠키)를 쓰기 때문에, 한쪽에서 로그인하면 다른 쪽 로그인은 풀린다.
// 이때 풀린 앱이 로그인된 것처럼 화면(알림 팝업 등)을 계속 보여주면 확인도 닫기도 안 되므로, 아래 상황에서 바로 로그인 화면으로 보낸다.
//  1) 다른 앱이 로그인 표식(routel-session-kind)을 바꿨을 때 (storage 이벤트)
//  2) 앱이 다시 화면에 보일 때 서버 세션을 확인해서 없거나 다른 역할이면
//  3) 로그인이 필요한 API 가 401 을 돌려줄 때
const KIND_KEY = 'routel-session-kind'
type Kind = 'manager' | 'customer' | ''
const appKind = (path: string): Kind => (path.startsWith('/admin-app') ? 'manager' : path.startsWith('/customer-app') ? 'customer' : '')
const accountKind = (role?: string): Kind => (role === 'customer' ? 'customer' : role ? 'manager' : '')
// 로그인·가입·재설정 화면 (관리자 앱의 screen-2~4 는 일반 화면이라 포함하지 않는다)
const AUTH_PAGE = /^\/customer-app\/(screen-[1234]|password-reset)$|^\/admin-app\/(screen-1|signup|password-reset)$/

export function installSessionGuard(router: Router) {
  let redirecting = false
  let lastValidate = 0

  function toLogin() {
    const app = useApp()
    const here = router.currentRoute.value
    const kind = appKind(here.path) || accountKind(app.account?.role)
    if (!kind) return
    app.clearAccount()
    const loginPath = kind === 'manager' ? '/admin-app/screen-1' : '/customer-app/screen-1'
    if (AUTH_PAGE.test(here.path) || redirecting) return
    redirecting = true
    void router
      .replace({ path: loginPath, query: { next: here.fullPath } })
      .finally(() => { redirecting = false })
  }

  // 지금 앱의 로그인 정보가 서버·저장소와 어긋났는지 확인하고, 어긋났으면 로그인 화면으로 보낸다
  async function validate(force = false) {
    const app = useApp()
    const here = router.currentRoute.value
    const kind = appKind(here.path)
    if (!kind || AUTH_PAGE.test(here.path)) return
    if (!app.account) {
      // 로그인이 필요한 화면인데 로그인 정보가 없으면(서버 세션이 사라짐) 로그인 화면으로 보낸다. 비로그인으로 볼 수 있는 화면은 그대로 둔다
      if (!requiresCustomer(here.path) && !requiresManager(here.path)) return
      await restoreSession(true)
      if (!useApp().account) toLogin()
      return
    }
    const marker = localStorage.getItem(KIND_KEY)
    if (marker && marker !== accountKind(app.account.role)) { toLogin(); return }
    if (!force && Date.now() - lastValidate < 15000) return
    lastValidate = Date.now()
    await restoreSession(true)
    const after = useApp().account
    if (!after || accountKind(after.role) !== kind) toLogin()
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== KIND_KEY) return
    const app = useApp()
    const mine = accountKind(app.account?.role)
    if (mine && event.newValue && event.newValue !== mine) toLogin()
  })
  const onVisible = () => { if (!document.hidden) void validate() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
  window.addEventListener('pageshow', onVisible)
  // 앱을 켜 둔 채 오래 있어도 서버에서 로그인이 풀리면 알아챈다
  window.setInterval(() => { if (!document.hidden) void validate() }, 60000)

  setUnauthorizedHandler(() => {
    const app = useApp()
    if (app.account && appKind(router.currentRoute.value.path)) toLogin()
  })
}
