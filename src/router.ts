import { createRouter, createWebHistory } from 'vue-router'
const pages = import.meta.glob('./pages/*.vue')
import { useApp } from './stores/app'
import { restoreSession } from './services/session'
import { requiresCustomer, requiresManager } from './services/access'
import { appOnlyRedirect } from './services/appOnly'
const routes = [
  { path: '/admin-app/menu', component: pages['./pages/admin-app-menu.vue'] },
  { path: '/admin-app/inspection', component: pages['./pages/pm-inspection.vue'] },
  {
    path: '/admin-app/:resource(ocr|reviews|transits|transfers)',
    component: pages['./pages/backend-resource.vue'],
  },
  { path: '/admin-app/notifications', component: pages['./pages/backend-resource.vue'] },
  // 고객 문의·공지는 관리자 앱에서 처리하지 않는다 (웹 관리자 페이지에서 확인)
  { path: '/admin-app/:resource(notices|inquiries)', redirect: '/admin-app/notifications' },
  {
    path: '/admin-app/:section(history|document|contacts)',
    component: pages['./pages/admin-app-extra.vue'],
  },
  { path: '/customer-app/password-reset', component: pages['./pages/service-auth.vue'] },
  { path: '/admin-app/password-reset', component: pages['./pages/service-auth.vue'] },
  { path: '/admin-app/signup', component: pages['./pages/service-auth.vue'] },
  { path: '/customer-app/find-id', component: pages['./pages/customer-app-help.vue'] },
  {
    path: '/customer-app/account/:section(profile|emergency|cars|settings|inquiries|withdraw)',
    component: pages['./pages/customer-app-account.vue'],
    meta: { appMember: true },
  },
  { path: '/customer-app/notices', component: pages['./pages/customer-app-help.vue'] },
  { path: '/customer-app/faq', component: pages['./pages/customer-app-help.vue'] },
  { path: '/admin-app/pm-settings', component: pages['./pages/pm-settings-live.vue'] },
  { path: '/admin-app/pm-daily', component: pages['./pages/pm-daily-live.vue'] },
  { path: '/customer-app/screen-1', component: pages['./pages/customer-app-1.vue'] },
  { path: '/customer-app/screen-2', component: pages['./pages/customer-app-2.vue'] },
  { path: '/customer-app/screen-3', component: pages['./pages/customer-app-3.vue'] },
  { path: '/customer-app/screen-4', component: pages['./pages/customer-app-4.vue'] },
  { path: '/customer-app/screen-5', component: pages['./pages/customer-app-5.vue'] },
  { path: '/customer-app/screen-6', component: pages['./pages/customer-app-6.vue'] },
  { path: '/customer-app/screen-7', component: pages['./pages/customer-app-7.vue'] },
  { path: '/customer-app/screen-8', component: pages['./pages/customer-app-8.vue'] },
  { path: '/customer-app/screen-9', component: pages['./pages/customer-app-9.vue'] },
  { path: '/customer-app/screen-10', component: pages['./pages/customer-app-10.vue'] },
  { path: '/customer-app/screen-11', component: pages['./pages/customer-app-11.vue'] },
  { path: '/customer-app/screen-12', component: pages['./pages/customer-app-12.vue'] },
  { path: '/customer-app/screen-13', component: pages['./pages/customer-app-13.vue'] },
  { path: '/customer-app/screen-14', component: pages['./pages/customer-app-14.vue'] },
  { path: '/admin-app/screen-1', component: pages['./pages/admin-app-1.vue'] },
  { path: '/admin-app/screen-2', component: pages['./pages/admin-app-2.vue'] },
  { path: '/admin-app/screen-3', component: pages['./pages/admin-app-3.vue'] },
  { path: '/admin-app/screen-4', component: pages['./pages/admin-app-4.vue'] },
  { path: '/admin-app/screen-5', component: pages['./pages/admin-app-5.vue'] },
  { path: '/admin-app/screen-6', component: pages['./pages/admin-app-6.vue'] },
  { path: '/admin-app/screen-7', component: pages['./pages/admin-app-7.vue'] },
  { path: '/admin-app/screen-8', component: pages['./pages/admin-app-8.vue'] },
  { path: '/admin-app/screen-9', component: pages['./pages/admin-app-9.vue'] },
  { path: '/admin-app/screen-10', component: pages['./pages/admin-app-10.vue'] },
  { path: '/admin-app/screen-11', component: pages['./pages/admin-app-11.vue'] },
  { path: '/admin-app/screen-12', component: pages['./pages/admin-app-12.vue'] },
  { path: '/admin-app/screen-13', redirect: '/admin-app/notifications' },
  { path: '/admin-app/screen-14', component: pages['./pages/admin-app-14.vue'] },
  // 앱 외 모든 경로는 beforeEach(appOnlyRedirect)에서 고객/관리자 앱으로 보낸다
  { path: '/:pathMatch(.*)*', component: { render: () => null } },
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 24 } : { top: 0 }),
})
router.beforeEach(async (to) => {
  const appTarget = appOnlyRedirect(to.path)
  if (appTarget) return { path: appTarget, replace: true }
  if (to.path === '/c-notice' && to.query.tab === 'faq') return '/info/faq'
  const customer = requiresCustomer(to.path),
    manager = requiresManager(to.path)
  await restoreSession(customer || manager)
  const role = useApp().account?.role
  if ((customer && role !== 'customer') || (manager && role !== 'REGIONAL_ADMIN')) {
    const path = manager
      ? to.path.startsWith('/admin-app/')
        ? '/admin-app/screen-1'
        : '/admin-login'
      : to.path.startsWith('/customer-app/')
        ? '/customer-app/screen-1'
        : '/login'
    return { path, query: { next: to.fullPath }, replace: true }
  }
})
export default router
