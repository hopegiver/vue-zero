export type Stage = 'load' | 'parse' | 'eval' | 'render' | 'route' | 'auth' | 'manifest' | 'config'
export type Level = 'error' | 'warn'

export interface Diag {
  code: string
  stage: Stage
  file: string
  line?: number
  message: string
  hint: string
}

export interface DiagEntry extends Diag {
  level: Level
  time: number
}

const MAX = 50
const buffer: DiagEntry[] = []

/** 진단 보고: 콘솔(`[vue-zero] CODE file:line — message` + `hint: …`) + 링 버퍼(VueZero.errors()). 경로·상태코드만 담는다 — 토큰/사용자 데이터 금지. */
export function report(d: Diag, level: Level = 'error', extra?: unknown): void {
  // JWT 모양(eyJ…)은 가린다 — 사용자 코드의 에러 메시지에 토큰 조각이 섞일 수 있다
  const entry: DiagEntry = { ...d, message: d.message.replace(/eyJ[\w.-]*/g, '[jwt]').slice(0, 300), level, time: Date.now() }
  if (entry.line === undefined) delete entry.line
  buffer.push(entry)
  if (buffer.length > MAX) buffer.shift()
  const where = entry.file ? ` ${entry.file}${entry.line ? ':' + entry.line : ''}` : ''
  const text = `[vue-zero] ${entry.code}${where} — ${entry.message}${entry.hint ? `\nhint: ${entry.hint}` : ''}`
  const args = extra === undefined ? [text] : [text, extra]
  if (level === 'warn') console.warn(...args)
  else console.error(...args)
}

export function errors(): DiagEntry[] {
  return buffer.map(e => ({ ...e }))
}

/** 코드가 붙은 로드/파싱 오류. report() 한 뒤 reported 표시 → errorHandler/onError 가 중복 보고하지 않는다. */
export class VzError extends Error {
  reported = false
  constructor(public diag: Diag, public status?: number) {
    super(diag.message)
  }
}

/** 잡은 예외를 보고한다. VzError 면 그 진단을 쓰고(필요하면 덮어쓰기), 아니면 fallback 에 메시지를 채운다. */
export function reportCaught(e: unknown, fallback: Diag, override?: Partial<Diag>, level: Level = 'error'): void {
  const base = e instanceof VzError ? e.diag : { ...fallback, message: `${fallback.message}: ${e instanceof Error ? e.message : String(e)}` }
  report({ ...base, ...override }, level)
  if (e instanceof VzError) e.reported = true
}
