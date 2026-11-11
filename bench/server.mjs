// 벤치 정적 서버. Cloudflare Workers 정적 자산 동작을 모사한다.
//  - 해시 없는 파일: ETag + `Cache-Control: public, max-age=0, must-revalidate` (If-None-Match → 304)
//  - Nuxt 해시 파일(/_nuxt/*): `public, max-age=31536000, immutable`
//  - 텍스트(js/css/json/vue/html)는 brotli(없으면 gzip) 압축 — 모든 변형에 동일하게 적용(시작 후 첫 요청에 압축·캐시)
//  - 기본 HTTP/2(TLS, 자체서명) — CF 는 h2/h3 이므로. --h1 은 HTTP/1.1 평문
// 사용: node bench/server.mjs --root <dir> --port <n> --kind vz|nuxt [--mode cf|immutable] [--h1]
import http from 'node:http'
import http2 from 'node:http2'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { brotliCompress, gzip, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { resolve, extname, join, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []))
const indexFile = args['index-file'] || 'index.html' // 보조 변형(힌트 포함 index) 용
const root = resolve(args.root), port = Number(args.port), kind = args.kind || 'vz', mode = args.mode || 'cf', h1 = !!args.h1
const libs = {
  '/lib/vue.js': join(pkgRoot, 'node_modules/vue/dist/vue.global.prod.js'),
  '/lib/vue-router.js': join(pkgRoot, 'node_modules/vue-router/dist/vue-router.global.prod.js'),
  '/lib/vue-zero.js': join(pkgRoot, 'dist/vue-zero.js'),
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.vue': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const TEXT = new Set(['.html', '.js', '.mjs', '.json', '.vue', '.css', '.txt', '.svg'])
const br = promisify(brotliCompress), gz = promisify(gzip)
const cache = new Map() // file -> { raw, etag, br, gz }

async function entry(file) {
  let e = cache.get(file)
  if (!e) {
    const raw = await readFile(file)
    e = { raw, etag: '"' + createHash('sha1').update(raw).digest('hex').slice(0, 20) + '"' }
    if (TEXT.has(extname(file))) {
      e.br = await br(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }) // 사전 압축 CDN 과 달리 서버 CPU 를 쓰므로 q6, 첫 요청 후 캐시
      e.gz = await gz(raw, { level: 6 })
    }
    cache.set(file, e)
  }
  return e
}
async function isFile(f) { try { return (await stat(f)).isFile() } catch { return false } }

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost')
    let file
    if (libs[url.pathname]) file = libs[url.pathname]
    else if (kind === 'vz' && (url.pathname === '/' || url.pathname === '/index.html')) file = join(root, indexFile)
    else {
      const cand = resolve(root, '.' + decodeURIComponent(url.pathname))
      if (cand !== root && !cand.startsWith(root + sep)) { res.writeHead(403); return res.end() }
      file = cand
    }
    if (!(await isFile(file))) {
      const dirIndex = join(file, 'index.html')
      if (await isFile(dirIndex)) file = dirIndex
      else if (!extname(url.pathname)) file = join(root, kind === 'nuxt' ? '200.html' : indexFile) // SPA fallback (확장자 없는 경로만)
      else { res.writeHead(404, { 'content-type': MIME['.txt'], 'cache-control': 'no-store' }); return res.end('not found') }
      if (!(await isFile(file))) file = join(root, 'index.html')
    }
    const e = await entry(file)
    const ext = extname(file)
    const hashed = url.pathname.startsWith('/_nuxt/')
    const headers = {
      'content-type': MIME[ext] || 'application/octet-stream',
      etag: e.etag,
      'cache-control': hashed || mode === 'immutable' ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      vary: 'Accept-Encoding',
    }
    if (!hashed && mode !== 'immutable' && req.headers['if-none-match'] === e.etag) { res.writeHead(304, headers); return res.end() }
    if (hashed && req.headers['if-none-match'] === e.etag) { res.writeHead(304, headers); return res.end() }
    const ae = String(req.headers['accept-encoding'] || '')
    let body = e.raw
    if (e.br && /\bbr\b/.test(ae)) { body = e.br; headers['content-encoding'] = 'br' }
    else if (e.gz && /\bgzip\b/.test(ae)) { body = e.gz; headers['content-encoding'] = 'gzip' }
    headers['content-length'] = body.length
    res.writeHead(200, headers); res.end(body)
  } catch (err) { res.writeHead(500); res.end(String(err && err.stack || err)) }
}

const server = h1
  ? http.createServer(handler)
  : http2.createSecureServer({ key: readFileSync(join(here, '.cert/key.pem')), cert: readFileSync(join(here, '.cert/cert.pem')), allowHTTP1: true }, handler)
server.listen(port, '127.0.0.1', () => console.log(`[bench-server] ${kind}/${mode}${h1 ? '/h1' : '/h2'} ${root} ${h1 ? 'http' : 'https'}://127.0.0.1:${port}`))
