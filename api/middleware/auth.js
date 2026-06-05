import { serverError, unauthorized } from '../utils/response.js'

/**
 * JWT 인증 미들웨어
 *
 * 사용법:
 *   import { authMiddleware } from '../middleware/auth.js'
 *   router.get('/me', authMiddleware, (c) => { ... })
 *
 * 검증 성공 시 c.set('user', payload) 로 페이로드를 전달한다.
 * 이후 핸들러에서 const user = c.get('user') 로 접근.
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(c)
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch {
    return unauthorized(c, 'Invalid or expired token')
  }
}

/** JWT 서명 검증 + 만료 확인 (Web Crypto API — Cloudflare Workers 기본 지원) */
async function verifyJwt(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split('.')
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('malformed token')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = base64UrlDecode(signatureB64)
  const valid = await crypto.subtle.verify('HMAC', key, signature, data)
  if (!valid) throw new Error('invalid signature')

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('token expired')

  return payload
}

/** JWT 발급 (로그인 핸들러에서 사용) */
export async function signJwt(payload, secret, expiresInSeconds = 60 * 60 * 24) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  }))

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${base64UrlEncode(signature)}`
}

function base64UrlEncode(input) {
  const str = typeof input === 'string' ? input : String.fromCharCode(...new Uint8Array(input))
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}
