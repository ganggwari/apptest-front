import { backend, queryString } from './backend'
import { useApp } from '../stores/app'
export type PushToken = { token:string;platform:'WEB'|'APP' }
let current:PushToken|undefined, registeredOwner=''
export function pushTokenBase() {
  const role=useApp().account?.role
  return role==='REGIONAL_ADMIN'?'/api/managers/me/device-tokens':role==='customer'?'/api/customers/me/device-tokens':null
}
export async function registerPushToken(value?:PushToken) {
  if(value){
    const token=typeof value.token==='string'?value.token.trim():''
    if(!token||token.length>255||!['WEB','APP'].includes(value.platform))throw Error('알림 기기 정보를 확인하지 못했습니다.')
    current={token,platform:value.platform}
  }
  const base=pushTokenBase(),account=useApp().account
  if(!current||!base||!account)return
  const owner=`${account.role}:${account.id}:${current.token}`
  if(owner===registeredOwner)return
  await backend(base,{method:'POST',body:current})
  if(useApp().account?.id===account.id&&useApp().account?.role===account.role)registeredOwner=owner
}
export async function detachPushToken() {
  const base=pushTokenBase()
  const detaching=current
  // 해제한 토큰은 잊는다: 그렇지 않으면 SSE 재연결·계정 변경 때 브리지가 같은 토큰을 다시 등록해 알림이 되살아난다
  current=undefined;registeredOwner=''
  if(detaching&&base)await backend(base+queryString({token:detaching.token}),{method:'DELETE'})
}
