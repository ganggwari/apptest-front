<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref} from 'vue'
import {backend} from '../services/backend'
import {useApp} from '../stores/app'
import {enableFcm,disableFcm,isFcmActive,setFcmOptOut} from '../services/fcmPush'
const devices=ref<{id:number;platform:string;active:boolean}[]>([]),loading=ref(false),error=ref('')
const controller=new AbortController()
const app=useApp(),switchBusy=ref(false),switchMessage=ref(''),pushOn=ref(false)
const supported='Notification' in window
function syncSwitch(){pushOn.value=!!app.account&&isFcmActive('REGIONAL_ADMIN',String(app.account.id))}
async function togglePush(){
  if(switchBusy.value||!app.account)return
  const id=String(app.account.id)
  switchBusy.value=true;switchMessage.value=''
  try{
    if(pushOn.value){
      await disableFcm('REGIONAL_ADMIN');setFcmOptOut('REGIONAL_ADMIN',id,true)
      switchMessage.value='이 기기의 푸시 알림을 껐습니다.'
    }else{
      await enableFcm('REGIONAL_ADMIN',id,true);setFcmOptOut('REGIONAL_ADMIN',id,false)
      switchMessage.value='이 기기의 푸시 알림을 켰습니다.'
    }
  }catch(e){switchMessage.value=(e as Error).message||'푸시 설정을 바꾸지 못했습니다.'}
  finally{switchBusy.value=false;syncSwitch();void load()}
}
async function load(){loading.value=true;error.value='';try{const rows=await backend('/api/managers/me/device-tokens',{signal:controller.signal});if(!controller.signal.aborted)devices.value=Array.isArray(rows)?rows:[]}catch(e){if(!controller.signal.aborted)error.value=(e as Error).message}finally{if(!controller.signal.aborted)loading.value=false}}
function updated(){syncSwitch();void load()}
function failed(){error.value='이 기기의 알림 연결을 완료하지 못했습니다. 다시 연결해 주세요.'}
onMounted(()=>{syncSwitch();void load();window.addEventListener('routel:push-device-updated',updated);window.addEventListener('routel:push-device-error',failed)})
onBeforeUnmount(()=>{controller.abort();window.removeEventListener('routel:push-device-updated',updated);window.removeEventListener('routel:push-device-error',failed)})
</script>
<template><section class="manager-push-devices"><div class="push-switch-row"><div><strong>이 기기 푸시 알림</strong><p>긴급 알림을 앱을 닫아 둔 상태에서도 받습니다. 이 기기에만 적용됩니다.</p></div><button type="button" class="push-switch" role="switch" :aria-checked="pushOn" :disabled="switchBusy||!supported" @click="togglePush">{{switchBusy?'처리 중':pushOn?'켜짐':'꺼짐'}}</button></div><p v-if="!supported" role="note">이 브라우저는 푸시 알림을 지원하지 않습니다.</p><p v-if="switchMessage" role="status">{{switchMessage}}</p><header><h2>알림 기기</h2><button type="button" :disabled="loading" @click="load">새로고침</button></header><p v-if="loading" role="status">알림 기기를 확인하고 있습니다.</p><p v-else-if="error" role="alert">{{error}}</p><ul v-else-if="devices.length"><li v-for="(device,index) in devices" :key="device.id">{{device.platform==='APP'?'모바일 앱':'웹 브라우저'}} {{index+1}} · {{device.active?'연결됨':'수신 중지'}}</li></ul><p v-else>연결된 알림 기기가 없습니다.</p></section></template>
<style scoped>.push-switch-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}.push-switch-row p{margin:2px 0 0;color:var(--r-muted)}.push-switch[aria-checked=true]{background:var(--r-accent,#1674d3);color:#fff;border-color:transparent}.push-switch{min-width:64px;font-weight:700}.manager-push-devices{margin:16px 0;padding:18px 16px;border:1px solid var(--r-line);border-radius:14px;background:var(--r-surface);}header{display:flex;justify-content:space-between;align-items:center;gap:12px;}h2{margin:0;font-size:15px;}button{padding:6px 10px;min-height:34px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:inherit;}p,li{font-size:13px;line-height:1.7;}ul{padding-left:18px;}</style>
