import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
async function files(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name
    if (entry.isDirectory()) result.push(...(await files(path)))
    else result.push(path)
  }
  return result
}
const paths = (await files('dist')).filter(
  (p) => !['sw.js', '_redirects', '_headers'].includes(p.split('/').at(-1)),
)
const hash = createHash('sha256')
for (const path of paths) hash.update(await readFile(path))
const cache = 'routel-static-' + hash.digest('hex').slice(0, 12)
const assets = paths.map((p) => '/' + p.slice(5))
await writeFile(
  'dist/sw.js',
  `
// Firebase Messaging shares the same worker as the offline PWA shell.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp({"apiKey":"AIzaSyC4tpG_t2OGKH8vQTIUHGJEM7lxR8NxiWI","authDomain":"pufpr-ab135-7d2a5.firebaseapp.com","projectId":"pufpr-ab135-7d2a5","storageBucket":"pufpr-ab135-7d2a5.firebasestorage.app","messagingSenderId":"950702292615","appId":"1:950702292615:web:ad273bbbb7d92a06cc8222","measurementId":"G-71M0N5DCW1"});
const messaging=firebase.messaging();
// FCM automatically displays notification payloads in the background.
// Only manually display data-only messages to avoid duplicate notifications.
messaging.onBackgroundMessage(payload=>{
 if(payload.notification)return;
 const data=payload.data||{};
 return self.registration.showNotification(data.title||'PUF 새 알림',{body:data.body||'',tag:data.notificationId||'puf-fcm',data:{url:data.url||(data.category?'/admin-app/notifications':'/customer-app/screen-12')}});
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data?.url||'/customer-app/screen-12';
 const url=new URL(target,self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){if(client.url.startsWith(self.location.origin)){await client.focus();await client.navigate(url.href);return;}}
  await self.clients.openWindow(url.href);
 })());
});
const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('routel-static-')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith((async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{return await fetch(request,{signal:controller.signal})}catch{return await (await caches.open(CACHE)).match('/index.html')}finally{clearTimeout(timer)}})());return}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
});
`,
)
console.log('PWA shell generated:', assets.length, 'files;', cache)
