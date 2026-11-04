// 내비 음성 안내 목소리. AI 목소리는 서버(/api/navigation/tts, 배포에서는 Spring)에서 만들고, 실패하거나 기기 목소리를 고르면 브라우저 음성으로 읽는다
import { apiUrl } from '../services/apiOrigin'
const storageKey = 'routel-navigation-voice'
const preferred = ['SunHi', 'Google 한국의', 'Yuna', 'Heami']
// AI 음성이 이 시간 안에 준비되지 않으면 안내가 늦지 않게 기기 목소리로 바로 읽는다
const aiWaitMs = 800

// 서버 navigation-api.mjs 의 ttsVoices 와 이름을 맞춘다
export const aiVoices = [
  { name: 'Kore', label: '여성 · 또렷한 안내' },
  { name: 'Aoede', label: '여성 · 부드러운' },
  { name: 'Zephyr', label: '여성 · 밝은' },
  { name: 'Sulafat', label: '여성 · 따뜻한' },
  { name: 'Charon', label: '남성 · 차분한' },
  { name: 'Iapetus', label: '남성 · 또렷한' },
  { name: 'Orus', label: '남성 · 묵직한' },
  { name: 'Puck', label: '남성 · 경쾌한' },
] as const
const aiPrefix = 'ai:'

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function koreanVoices() {
  return speechSupported ? speechSynthesis.getVoices().filter((voice) => voice.lang.replace('_', '-').startsWith('ko')) : []
}
// 저장값: '' = 기기 자동, 'ai:Kore' = AI 목소리, 그 밖 = 기기 목소리 이름
export function savedVoiceName() {
  try {
    const value = localStorage.getItem(storageKey) || ''
    // 말투 목록을 쓰던 때는 JSON 으로 저장했다
    return value.startsWith('{') ? String(JSON.parse(value).voice || '') : value
  } catch { return '' }
}
export function saveVoiceName(name: string) {
  try {
    if (name) localStorage.setItem(storageKey, name)
    else localStorage.removeItem(storageKey)
  } catch { /* 저장이 안 돼도 이번 화면에서는 선택한 목소리로 들린다. */ }
}
// 말로 읽는 거리는 정해진 단위로 맞춰서, 미리 만들어 둔 음성을 다시 쓸 수 있게 한다
export function spokenDistance(meters: number) {
  if (meters < 50) return '잠시 후'
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)}미터 후`
  const km = meters < 10000 ? Math.round(meters / 500) / 2 : Math.round(meters / 1000)
  return `${km}킬로미터 후`
}
function pickVoice(name: string) {
  const voices = koreanVoices()
  return (name && voices.find((voice) => voice.name === name))
    || preferred.map((part) => voices.find((voice) => voice.name.includes(part))).find(Boolean)
    || voices[0]
}
function speakDevice(text: string, name: string) {
  if (!speechSupported) return
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(name)
  utterance.lang = voice?.lang || 'ko-KR'
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
}
// 받아 둔 AI 음성. 같은 목소리·문장은 다시 요청하지 않는다
const clips = new Map<string, Promise<string>>()
function clip(voice: string, text: string) {
  const id = `${voice}|${text}`
  if (!clips.has(id)) {
    const query = new URLSearchParams({ text, voice })
    const request = fetch(apiUrl(`/api/navigation/tts?${query}`)).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 429 ? 'TTS_LIMIT' : 'TTS')
      return URL.createObjectURL(await response.blob())
    })
    // 실패한 문장은 다음에 다시 시도할 수 있게 지운다
    request.catch(() => clips.delete(id))
    clips.set(id, request)
  }
  return clips.get(id)!
}
// 무료 키는 분당 3회까지라서, 한도에 걸리면 1분 동안은 미리 받기를 쉰다
let preloadPausedUntil = 0
// 다음에 나올 안내 문장을 미리 만들어 둔다
export function preloadNavigationSpeech(texts: string[], name = savedVoiceName()) {
  if (!name.startsWith(aiPrefix) || Date.now() < preloadPausedUntil) return
  for (const text of new Set(texts.filter(Boolean)))
    clip(name.slice(aiPrefix.length), text).catch((error) => {
      if ((error as Error).message === 'TTS_LIMIT') preloadPausedUntil = Date.now() + 60000
    })
}
let audio: HTMLAudioElement | undefined, turn = 0
export function stopNavigationSpeech() {
  turn++
  audio?.pause()
  audio = undefined
  if (speechSupported) speechSynthesis.cancel()
}
// Gemini 는 '우회전'처럼 너무 짧은 말은 음성을 만들지 않아서 문장을 통째로 읽는다
export async function speakNavigation(text: string, name = savedVoiceName()) {
  stopNavigationSpeech()
  if (!name.startsWith(aiPrefix)) return speakDevice(text, name)
  const mine = turn
  try {
    const url = await Promise.race([
      clip(name.slice(aiPrefix.length), text),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TTS_SLOW')), aiWaitMs)),
    ])
    if (mine !== turn) return
    audio = new Audio(url)
    await audio.play()
  } catch {
    // 늦거나 실패하면 이번 안내는 기기 목소리로 읽고, AI 음성은 다음에 쓰도록 계속 받는다
    if (mine === turn) speakDevice(text, '')
  }
}
