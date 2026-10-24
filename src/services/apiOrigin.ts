/** Render Static Site -> standalone Spring Web Service. Override with VITE_API_BASE_URL at build time. */
const configured = (import.meta.env.VITE_API_BASE_URL || 'https://apptest-backend-tj3a.onrender.com').trim()
export const API_ORIGIN = configured.replace(/\/$/, '')
export function apiUrl(path: string): string {
  if (!path.startsWith('/api/') && !path.startsWith('/ws/')) return path
  return `${API_ORIGIN}${path}`
}
export function navigationWsUrl(): string {
  const url = new URL('/ws/navigation', API_ORIGIN)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}
