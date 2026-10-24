let ctx: AudioContext | undefined
let lastAlert = ''
let lastTime = 0
export function unlockManagerAlertAudio() {
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume().catch(() => {}) } catch { /* unsupported */ }
}
export function playManagerAlert(id: unknown, urgent = false) {
  const key = String(id ?? '')
  const now = Date.now()
  if (key && key === lastAlert && now - lastTime < 12000) return
  if (!key && now - lastTime < 1200) return
  lastAlert = key; lastTime = now
  if ('vibrate' in navigator) navigator.vibrate(urgent ? [300,100,300,100,550] : [160,90,210])
  try {
    if (!ctx || ctx.state !== 'running') return
    const start = ctx.currentTime + .03
    const notes = urgent ? [880,660,880,660,1046] : [784,988,784]
    notes.forEach((freq,i) => {
      const osc = ctx!.createOscillator(), gain = ctx!.createGain()
      osc.type = 'square'; osc.frequency.value = freq
      const t = start+i*.19
      gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(.16,t+.025); gain.gain.exponentialRampToValueAtTime(.0001,t+.15)
      osc.connect(gain); gain.connect(ctx!.destination); osc.start(t); osc.stop(t+.16)
    })
  } catch { /* mobile audio restricted */ }
}
