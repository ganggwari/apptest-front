import type { RouteLocationRaw } from 'vue-router'
import { managerAppPath } from './manager-app-path'

// 관리자 앱 메뉴에 처리 화면이 없는 알림(고객 문의·공지)은 앱에서 이동하지 않고 웹에서 확인하도록 안내한다
export function isWebOnlyNotification(item:{refType?:string},manager:boolean,currentPath:string):boolean {
  return manager&&currentPath.startsWith('/admin-app/')&&['INQUIRY','NOTICE'].includes(String(item.refType||'').toUpperCase())
}
export function notificationTarget(
  item: {id:number;refType?:string;refId?:number|string;regionId?:number|string|null},
  manager:boolean,
  currentPath:string,
  historyPath:string,
):RouteLocationRaw {
  const id=Number(item.refId), type=String(item.refType || '').toUpperCase()
  if(isWebOnlyNotification(item,manager,currentPath))return {path:'/admin-app/notifications',query:{notification:String(item.id)}}
  const mobile=currentPath.startsWith('/customer-app/')
  const target=(path:string)=>manager?managerAppPath(path,currentPath):path
  const detail=(path:string)=>({path:target(path),query:{id:String(id)}})
  if(Number.isSafeInteger(id)&&id>0) {
    if(type==='UNDERPASS')return detail(manager?'/fac-detail':mobile?'/customer-app/screen-5':'/c-map')
    if(type==='NOTICE')return detail(manager?'/admin-data/notices':mobile?'/customer-app/notices':'/c-notice')
    if(type==='INQUIRY')return detail(manager?'/admin-data/inquiries':mobile?'/customer-app/account/inquiries':'/my-inquiries')
    if(manager) {
      if(type==='PM_EQUIPMENT')return detail('/pm-equipment-detail')
      if(type==='PM_EVENT')return {path:target('/pm-queue'),query:{eventId:String(id)}}
      if(type==='PLATE_LOG')return {path:target('/admin-data/ocr'),query:{id:String(id),...(item.regionId!=null?{regionId:String(item.regionId)}:{})}}
    }
  }
  if(manager&&type==='PM_REPORT')return {path:target('/pm-history')}
  const fallback=manager&&currentPath.startsWith('/admin-app/')?'/admin-app/notifications':mobile?'/customer-app/screen-12':historyPath
  return {path:fallback,query:{notification:String(item.id)}}
}
