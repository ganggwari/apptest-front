const appPaths: Record<string, string> = {
  '/fac-detail': '/admin-app/screen-5',
  '/pm-equipment': '/admin-app/screen-9',
  '/pm-equipment-detail': '/admin-app/screen-10',
  '/pm-queue': '/admin-app/screen-11',
  '/pm-inspection': '/admin-app/inspection',
  '/pm-history': '/admin-app/history',
  '/pm-settings': '/admin-app/pm-settings',
  '/pm-daily': '/admin-app/pm-daily',
  '/admin-data/ocr': '/admin-app/ocr',
}

export function managerAppPath(path: string, currentPath: string): string {
  return currentPath.startsWith('/admin-app/') ? appPaths[path] || path : path
}
