// 고객 앱 긴급재난문자(접근 알림·진입 직전 알림) 사운드. 파일 없이 Web Audio 로 만든다.
// 재난문자처럼 높낮이가 번갈아 울리는 경보음 + 강한 진동. 브라우저는 사용자가 화면을 한 번이라도 누른 뒤에야 소리를 허용한다.
let ctx: AudioContext | undefined
let lastKey = ''
let lastTime = 0

export function unlockCustomerAlertAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch { /* 지원하지 않는 브라우저 */ }
}

/** id 가 같은 알림은 15초 안에 다시 울리지 않는다. danger=true(통제·진입 직전)는 더 길고 급박하게 */
export function playCustomerEmergencyAlert(id: unknown, danger = true) {
  const key = String(id ?? '')
  const now = Date.now()
  if (key ? key === lastKey && now - lastTime < 15000 : now - lastTime < 1500) return
  lastKey = key
  lastTime = now
  if ('vibrate' in navigator) navigator.vibrate(danger ? [500, 150, 500, 150, 500, 150, 900] : [400, 150, 400, 150, 700])
  try {
    if (!ctx || ctx.state !== 'running') return
    const c = ctx
    const start = c.currentTime + 0.05
    const cycles = danger ? 6 : 4          // 높은음/낮은음 한 쌍 = 1회(약 0.9초)
    const master = c.createGain()
    master.gain.value = 0.9
    master.connect(c.destination)
    for (let i = 0; i < cycles; i++) {
      ;[[1046, 0], [740, 0.45]].forEach(([freq, offset]) => {
        const t = start + i * 0.9 + offset
        const osc = c.createOscillator(), gain = c.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, t)
        osc.frequency.linearRampToValueAtTime(freq * 0.96, t + 0.42)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.03)
        gain.gain.setValueAtTime(0.5, t + 0.38)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.43)
        osc.connect(gain)
        gain.connect(master)
        osc.start(t)
        osc.stop(t + 0.45)
      })
    }
  } catch { /* 모바일에서 소리가 막힌 경우 */ }
}
