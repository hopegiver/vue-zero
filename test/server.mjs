// 의존성 없는 테스트 서버: 정적 서빙(SPA fallback) + 픽스처 API.
// 사용: node test/server.mjs <app> <port>
// 라이브러리 파일은 기본 ../dist/vue-zero.js, VUEZERO_DIST 로 교체 가능(요청마다 읽는다).
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, extname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokens, makeJwt, verifyJwt, B64URL_NAME } from './jwt.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const pkgRoot = resolve(here, '..')

export const distPath = resolve(process.env.VUEZERO_DIST || join(pkgRoot, 'dist/vue-zero.js'))
const libs = {
  '/lib/vue-zero.js': () => distPath,
  '/lib/vue.js': () => join(pkgRoot, 'node_modules/vue/dist/vue.global.prod.js'),
  '/lib/vue-router.js': () => join(pkgRoot, 'node_modules/vue-router/dist/vue-router.global.prod.js'),
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.vue': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
const readBody = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(req, res, url) {
  const p = url.pathname
  if (p === '/api/ping') return json(res, 200, { ok: true })
  if (p === '/api/slow') {
    await sleep(Math.min(Number(url.searchParams.get('ms')) || 0, 5000))
    return json(res, 200, { ok: true })
  }
  const st = p.match(/^\/api\/status\/(\d{3})$/)
  if (st) return json(res, Number(st[1]), { status: Number(st[1]) })
  if (p === '/api/token') {
    const kind = url.searchParams.get('kind') || 'valid'
    if (kind === 'garbage') return json(res, 200, { token: 'not-a-jwt' })
    if (kind === 'badPayload') return json(res, 200, { token: 'aaa.@@@@.ccc' })
    if (!tokens[kind]) return json(res, 400, { error: 'unknown kind' })
    return json(res, 200, { token: tokens[kind]() })
  }
  if (p === '/api/login' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    if (body.email === 'user@example.com' && body.password === 'pass') {
      return json(res, 200, { token: makeJwt({ sub: 'u1', name: B64URL_NAME, exp: Math.floor(Date.now() / 1000) + 3600 }) })
    }
    return json(res, 401, { error: 'invalid credentials' })
  }
  if (p === '/api/me') {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')
    const payload = m && verifyJwt(m[1])
    return payload ? json(res, 200, { user: payload }) : json(res, 401, { error: 'unauthorized' })
  }
  return json(res, 404, { error: 'no such api' })
}

export function createServer(appName) {
  const appRoot = resolve(here, 'apps', appName)
  if (!existsSync(appRoot)) throw new Error(`unknown app: ${appName} (${appRoot})`)

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      // 일부 호스팅(CF 등)은 HEAD 를 허용하지 않는다 — v1.1.2 의 HEAD 회귀를 결정적으로 잡기 위해 항상 405
      if (req.method === 'HEAD') { res.writeHead(405); return res.end() }
      if (url.pathname.startsWith('/api/')) return await api(req, res, url)

      let file
      if (libs[url.pathname]) file = libs[url.pathname]()
      else {
        const decoded = decodeURIComponent(url.pathname)
        const candidate = resolve(appRoot, '.' + decoded)
        if (candidate !== appRoot && !candidate.startsWith(appRoot + sep)) { res.writeHead(403); return res.end() }
        file = candidate
      }

      let ok = false
      try { ok = (await stat(file)).isFile() } catch {}
      if (!ok) {
        // 확장자 없는 경로만 SPA fallback. 확장자 있는 파일(.vue/.json 등)은 진짜 404 여야 존재 확인이 동작한다.
        if (!extname(url.pathname) && !url.pathname.startsWith('/lib/')) file = join(appRoot, 'index.html')
        else { res.writeHead(404, { 'content-type': MIME['.txt'], 'cache-control': 'no-store' }); return res.end('not found') }
      }
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(data)
    } catch (e) {
      res.writeHead(500, { 'content-type': MIME['.txt'] }); res.end(String(e && e.stack || e))
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [app, port] = process.argv.slice(2)
  if (!app || !port) { console.error('usage: node test/server.mjs <app> <port>'); process.exit(2) }
  for (const f of Object.values(libs)) {
    if (!existsSync(f())) { console.error(`missing library file: ${f()} (pnpm install / pnpm build ?)`); process.exit(1) }
  }
  createServer(app).listen(Number(port), '127.0.0.1', () => console.log(`[test-server] ${app} http://127.0.0.1:${port} dist=${distPath}`))
}
