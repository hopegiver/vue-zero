// 테스트 전용 HS256 JWT 유틸 (server.mjs 와 e2e 헬퍼가 공유). 라이브러리는 서명을 검증하지 않고 payload(exp)만 읽는다.
import { createHmac } from 'node:crypto'

export const SECRET = 'vue-zero-test-secret'

export const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// payload 가 base64url 에서 '-' 또는 '_' 를 만들도록 name 을 고른다 (v1.2.1 회귀의 핵심 조건).
export const B64URL_NAME = '홍길동~~??>>'

export function makeJwt(payload, { secret = SECRET, tamper = false } = {}) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  let sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  if (tamper) sig = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')
  return `${header}.${body}.${sig}`
}

export function verifyJwt(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  const expected = createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url')
  if (expected !== parts[2]) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch { return null }
}

const now = () => Math.floor(Date.now() / 1000)

export const tokens = {
  valid: () => makeJwt({ sub: 'u1', name: 'tester', exp: now() + 3600 }),
  b64url: () => makeJwt({ sub: 'u1', name: B64URL_NAME, exp: now() + 3600 }),
  expired: () => makeJwt({ sub: 'u1', name: 'tester', exp: now() - 3600 }),
  noExp: () => makeJwt({ sub: 'u1', name: 'tester' }),
  // payload 는 정상이나 서명이 틀림 — 클라이언트 가드는 서명을 검증하지 않는다(서버 API 가 401 을 내야 함)
  badSignature: () => makeJwt({ sub: 'u1', name: 'tester', exp: now() + 3600 }, { tamper: true }),
}
