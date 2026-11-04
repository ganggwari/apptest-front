import { reactive } from 'vue'
import { apiUrl } from '../services/apiOrigin'

// SCargo voice.js의 Web Speech TTS를 현재 웹/PWA 내비 인터페이스에 연결한다.
const storageKey = 'routel-navigation-voice-v2'
export const defaultVoice = 'ai:Charon'
export const aiVoices = [{ name: 'Charon', label: '남성 · 차분한 (기본)' }, { name: 'Iapetus', label: '남성 · 또렷한' }, { name: 'Orus', label: '남성 · 묵직한' }, { name: 'Puck', label: '남성 · 경쾌한' }]
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
export const voiceStatus = reactive({ status: 'checking', lastError: '', talking: false })
export function koreanVoices() {
  return speechSupported ? speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ko')) : []
}
export function savedVoiceName() {
  try {
    const raw = localStorage.getItem(storageKey) || ''
    const value = raw.startsWith('{') ? String(JSON.parse(raw).voice || '') : raw
    return value || defaultVoice
  } catch { return defaultVoice }
}
export function saveVoiceName(name: string) {
  try { localStorage.setItem(storageKey, name) } catch { /* 저장 불가 시 이번 화면에서만 사용 */ }
}
// 경로 API의 짧고 딱딱한 회전 지시를 정중한 음성 안내로 바꾼다.
export function politeNavigationText(text: string) {
  return text.trim()
    .replace(/(좌회전|우회전|직진|유턴)(?:입니다|하세요|하십시오|합니다)?[.!?。]?$/, '$1해 주세요.')
    .replace(/진입(?:입니다|하세요|하십시오|합니다)[.!?。]?$/, '진입해 주세요.')
    .replace(/이동(?:하세요|하십시오)[.!?。]?$/, '이동해 주세요.')
}
export function spokenDistance(meters: number) {
  if (meters < 50) return '잠시 후'
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)}미터 후`
  const km = meters < 10000 ? Math.round(meters / 500) / 2 : Math.round(meters / 1000)
  return `${km}킬로미터 후`
}
export async function initVoice() {
  if (!speechSupported) { voiceStatus.status = 'no-engine'; return }
  if (!speechSynthesis.getVoices().length) await new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); speechSynthesis.removeEventListener('voiceschanged', done); resolve() }
    const timer = setTimeout(done, 1500)
    speechSynthesis.addEventListener('voiceschanged', done)
  })
  voiceStatus.status = koreanVoices().length ? 'ok' : speechSynthesis.getVoices().length ? 'no-korean' : 'no-engine'
}
const clips = new Map<string, Promise<string>>()
function clip(text: string, name: string) {
  text = politeNavigationText(text)
  const key = `${name}|${text}`
  if (!clips.has(key)) {
    const request = fetch(apiUrl(`/api/navigation/tts?${new URLSearchParams({ text, voice: name.slice(3) })}`), { signal: AbortSignal.timeout(20000) }).then(async response => {
      if (!response.ok) throw new Error('남성 안내 음성을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return URL.createObjectURL(await response.blob())
    })
    request.catch(() => clips.delete(key))
    clips.set(key, request)
  }
  return clips.get(key)!
}
let preloadPausedUntil = 0
export function preloadNavigationSpeech(texts: string[], name = savedVoiceName()) {
  if (!name.startsWith('ai:') || Date.now() < preloadPausedUntil) return
  for (const text of new Set(texts.filter(Boolean))) void clip(text, name).catch(() => { preloadPausedUntil = Date.now() + 60000 })
}
let audio: HTMLAudioElement | undefined
let generation = 0
let pending: { text: string; name: string; generation: number } | undefined
let current: SpeechSynthesisUtterance | undefined
export function stopNavigationSpeech() {
  generation++
  audio?.pause()
  audio = undefined
  pending = undefined
  current = undefined
  voiceStatus.talking = false
  if (speechSupported) speechSynthesis.cancel()
}
async function play(text: string, name: string, mine: number) {
  if (name.startsWith('ai:')) {
    try {
      const url = await clip(text, name)
      if (mine !== generation) return
      audio = new Audio(url)
      audio.onended = () => { if (mine === generation) voiceStatus.talking = false }
      audio.onerror = () => { if (mine === generation) { voiceStatus.talking = false; voiceStatus.lastError = '안내 음성을 재생하지 못했습니다.' } }
      await audio.play()
      if (mine === generation) { voiceStatus.talking = true; voiceStatus.lastError = '' }
    } catch (error) {
      if (mine !== generation) return
      voiceStatus.talking = false
      if (error instanceof Error && error.name === 'NotAllowedError') pending = { text, name, generation: mine }
      else voiceStatus.lastError = error instanceof Error ? error.message : String(error)
    }
    return
  }
  await initVoice()
  if (mine !== generation) return
  const voices = koreanVoices()
  // 명시적으로 고른 목소리가 없으면 다른 성별로 임의 대체하지 않는다.
  const selected = name ? voices.find(v => v.name === name) : voices[0]
  if (!selected) {
    voiceStatus.lastError = name ? '선택한 목소리를 사용할 수 없습니다. 안내 음성을 다시 선택해 주세요.' : '기기에 한국어 음성을 설치해 주세요.'
    return
  }
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    pending = { text, name, generation: mine }
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  current = utterance
  utterance.lang = 'ko-KR'
  utterance.voice = selected
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1
  utterance.onstart = () => { if (mine === generation) voiceStatus.talking = true }
  utterance.onend = () => { if (mine === generation) { voiceStatus.talking = false; current = undefined } }
  utterance.onerror = event => {
    if (mine !== generation) return
    voiceStatus.talking = false
    current = undefined
    if (event.error === 'not-allowed') pending = { text, name, generation: mine }
    else if (event.error !== 'canceled' && event.error !== 'interrupted') voiceStatus.lastError = event.error
  }
  voiceStatus.lastError = ''
  try { speechSynthesis.speak(current) } catch (error) { voiceStatus.lastError = String(error); current = undefined }
}
export async function speakNavigation(text: string, name = savedVoiceName()) {
  text = politeNavigationText(text)
  stopNavigationSpeech()
  if (!text || (!name.startsWith('ai:') && !speechSupported)) return
  await play(text, name, generation)
}
if (speechSupported) {
  const replay = () => {
    const item = pending
    pending = undefined
    if (item && item.generation === generation) void play(item.text, item.name, item.generation)
  }
  for (const event of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(event, replay, { passive: true })
  void initVoice()
}
