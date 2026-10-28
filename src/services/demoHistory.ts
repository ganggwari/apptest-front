// 앱 시연용 그래프 보충: 서버에 과거 데이터(백필)가 없으므로 부족한 이력만 프런트에서 그럴듯하게 채운다.
// 실제로 받은 최근 값은 그대로 두고, 그 이전 구간만 설정 id 기반의 고정 난수로 생성한다(새로고침해도 같은 모양).
export const DEMO_HISTORY = String(import.meta.env.VITE_DEMO_HISTORY ?? 'true') !== 'false'
const HOUR = 3600_000

function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOf = (key: string) => [...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const iso = (ms: number) => new Date(ms).toISOString()
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Score = { at: string; score: number; maxScore: number }
type Point = { at: string; value: number }
type Band = { low: number; high: number; mean: number }

/** 7일 위험 점수: 낮은 기저선 + 일주기 + 잡음, 현재 점수가 높으면 마지막 몇 시간을 따라 올라가게 한다. */
export function fillScores(real: Score[], current: number | null, key: string, days = 7): Score[] {
  if (!DEMO_HISTORY || real.length >= days * 8) return real
  const r = rng(seedOf('score' + key))
  const end = real.length ? new Date(real[0]!.at).getTime() : Date.now()
  const target = real.length ? Number(real[0]!.score) : current ?? 15
  const base = clamp(Math.min(target, 28) * 0.7 + 6 + r() * 6, 5, 30)
  const n = days * 24
  const ramp = target > 40 ? Math.min(10, Math.round((target - 30) / 6)) : 0
  const out: Score[] = []
  for (let i = n; i >= 1; i--) {
    const t = end - i * HOUR
    const hour = new Date(t).getHours()
    const daily = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 4
    let s = base + daily + (r() - 0.5) * 7
    if (ramp && i <= ramp) s += ((target - s) * (ramp - i + 1)) / (ramp + 1)
    s = clamp(s, 2, 96)
    out.push({ at: iso(t), score: +s.toFixed(1), maxScore: +clamp(s + 2 + r() * 9, s, 100).toFixed(1) })
  }
  return [...out, ...real]
}

const TYPICAL: Record<string, [number, number]> = {
  video_receive_rate: [97, 1.2], response_time_ms: [120, 18], packet_loss_rate: [0.6, 0.25], image_blur_score: [12, 3],
  vibration: [2.4, 0.35], pressure: [3.2, 0.2], temperature: [46, 2.2], current: [12.5, 0.9], flow: [180, 12], rpm: [1450, 25],
  temperature_c: [44, 2.5], ambient_c: [27, 2], ripple_v: [0.18, 0.03], error_count: [1, 0.8], bad_pixel_pct: [0.4, 0.1],
}

/** 센서 1시간 평균 추이: 평소 범위(mean±2σ) 안에서 움직이고, 마지막 값이 있으면 거기로 이어진다. */
export function fillTrend(
  trend: { column: string; points: Point[]; band: Band | null },
  key: string,
  days = 7,
): { column: string; points: Point[]; band: Band | null } {
  if (!DEMO_HISTORY || trend.points.length >= days * 8) return trend
  const col = trend.column
  const [typMean, typSd] = TYPICAL[col] || [50, 5]
  const mean = trend.band?.mean ?? (trend.points.length ? Number(trend.points[0]!.value) : typMean)
  const sd = trend.band ? (trend.band.high - trend.band.low) / 4 || typSd : typSd
  const r = rng(seedOf('sensor' + key + col))
  const end = trend.points.length ? new Date(trend.points[0]!.at).getTime() : Date.now()
  const out: Point[] = []
  let v = mean
  for (let i = days * 24; i >= 1; i--) {
    const t = end - i * HOUR
    const daily = Math.sin(((new Date(t).getHours() - 8) / 24) * Math.PI * 2) * sd * 0.5
    v += (mean - v) * 0.35 + (r() - 0.5) * sd * 1.1
    out.push({ at: iso(t), value: +(v + daily).toFixed(3) })
  }
  const band = trend.band ?? { low: +(mean - 2 * sd).toFixed(3), high: +(mean + 2 * sd).toFixed(3), mean: +mean.toFixed(3) }
  return { ...trend, points: [...out, ...trend.points], band }
}

/** 목록 스파크라인(최근 24시간): 비어 있거나 짧으면 현재 점수로 끝나는 24점을 만든다. */
export function fillSparkline(values: unknown[] | undefined, current: number | null | undefined, key: string): number[] {
  const real = (values || []).map(Number).filter((v) => Number.isFinite(v))
  if (!DEMO_HISTORY || real.length >= 12) return real
  const target = real.length ? real[real.length - 1]! : current ?? 15
  const r = rng(seedOf('spark' + key))
  const base = clamp(Math.min(target, 28) * 0.7 + 6 + r() * 5, 5, 30)
  const ramp = target > 40 ? 5 : 0
  const out: number[] = []
  for (let i = 24 - real.length; i >= 1; i--) {
    let s = base + (r() - 0.5) * 6
    if (ramp && i <= ramp) s += ((target - s) * (ramp - i + 1)) / (ramp + 1)
    out.push(+clamp(s, 2, 96).toFixed(1))
  }
  return [...out, ...real]
}
