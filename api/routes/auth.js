import { Hono } from 'hono'
import { signJwt } from '../middleware/auth.js'
import { badRequest, unauthorized } from '../utils/response.js'

const router = new Hono()

/**
 * POST /api/auth/login
 * body: { email, password }
 * → { token }
 *
 * 실제 프로젝트에서는 dao/users.js의 findByEmail()로 DB 조회 후 bcrypt 비교.
 * 아래는 구조 예시용 stub.
 */
router.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return badRequest(c, 'email and password are required')
  }

  // TODO: dao/users.js의 findByEmail(body.email)로 교체
  const user = findUserStub(body.email, body.password)
  if (!user) return unauthorized(c, 'Invalid credentials')

  const token = await signJwt({ sub: user.id, email: user.email, role: user.role }, c.env.JWT_SECRET)
  return c.json({ token })
})

/**
 * POST /api/auth/logout
 * 클라이언트에서 localStorage.token을 삭제하면 되므로 서버는 200만 반환.
 * Refresh token 패턴을 쓴다면 여기서 토큰을 무효화한다.
 */
router.post('/logout', (c) => c.json({ ok: true }))

// stub — 실제 구현 시 삭제하고 dao로 교체
function findUserStub(email, password) {
  const users = [
    { id: 1, email: 'admin@example.com', password: 'password', role: 'admin' },
  ]
  return users.find(u => u.email === email && u.password === password) ?? null
}

export default router
