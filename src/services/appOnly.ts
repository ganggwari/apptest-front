import { managerAppPath } from '../utils/manager-app-path'

// Render 시연 빌드: 웹사이트(데스크톱) 화면을 막고 고객 앱 / 관리자 앱 경로만 허용한다.
// 웹사이트 화면은 이 저장소에서 제거되어 있어 항상 켜져 있다.
export const APP_ONLY = true

const ADMIN_WEB = /^\/(?:admin-|fac-|pm-|cs-|bot-|shift-|index$|verify$|logs$|handover-pdf$|jurisdiction-contacts$|staff$)/

export function appOnlyRedirect(path: string): string | undefined {
  if (!APP_ONLY) return
  if (path.startsWith('/customer-app/') || path.startsWith('/admin-app/')) return
  if (path === '/admin-app') return '/admin-app/screen-3'
  if (path === '/customer-app') return '/customer-app/screen-1'
  if (path === '/notifications') return '/admin-app/notifications'
  if (path === '/my-alerts') return '/customer-app/screen-12'
  if (path.startsWith('/my-')) return '/customer-app/screen-13'
  const mapped = managerAppPath(path, '/admin-app/x')
  if (mapped !== path) return mapped
  if (ADMIN_WEB.test(path)) return '/admin-app/screen-3'
  return '/customer-app/screen-1'
}
