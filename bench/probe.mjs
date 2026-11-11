// 결정적 지표 탐침(budget.mjs · compare.mjs 공용). 홈 콜드 로드 → 같은 컨텍스트 새 탭 웜 로드를 측정한다.
//  요청 수 = 네트워크를 탄 요청(304 포함, 메모리/디스크 HTTP 캐시 적중 제외, blob:/data: 제외). Cache Storage 적중은 네트워크 이벤트가 없어 자연히 제외된다.
//  웨이브(waterfall 깊이) = 요청 시작 시각 간격 > RTT/2 로 군집화한 타이밍 기반 추론(실제 의존 관계 아님) — RTT 에뮬레이션 필수.
import { spawn } from 'node:child_process'
import net from 'node:net'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

/** vz-manifest 변형은 prod 호스트로 판정돼야 영속 캐시가 켜진다(127.0.0.1/localhost 는 dev 판별). *.bench.test 를 로컬 서버로 매핑한다. */
export const PROD_HOST = 'vzm.bench.test'
export const HOST_RULES = '--host-resolver-rules=MAP *.bench.test 127.0.0.1'
export const originFor = (variant, port) => `https://${variant === 'vz-manifest' ? PROD_HOST : '127.0.0.1'}:${port}`

export async function waitPort(port) {
  for (let i = 0; i < 100; i++) {
    if (await new Promise((ok) => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); ok(true) }); s.on('error', () => ok(false)) })) return
    await sleep(100)
  }
  throw new Error('server start timeout ' + port)
}

export function startServer(benchDir, { root, port, kind = 'vz', mode = 'cf', indexFile }) {
  const a = ['server.mjs', '--root', root, '--port', String(port), '--kind', kind, '--mode', mode]
  if (indexFile) a.push('--index-file', indexFile)
  return spawn('node', a, { cwd: benchDir, stdio: 'ignore' })
}

export function waves(list, gapMs) {
  const sorted = [...list].sort((a, b) => a.start - b.start)
  const out = []
  for (const r of sorted) { const w = out[out.length - 1]; if (w && r.start - w.last <= gapMs) { w.n++; w.last = r.start } else out.push({ at: Math.round(r.start), n: 1, last: r.start }) }
  return out
}

/** 한 번의 로드(새 탭). ctx 는 캐시(HTTP/Cache Storage)를 공유하는 브라우저 컨텍스트. rtt>0 이면 지연 에뮬레이션(대역폭 무제한) */
export async function loadOnce(ctx, url, { rtt = 0 } = {}) {
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  if (rtt) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: -1, uploadThroughput: -1 })
  const reqs = new Map(); let t0 = null
  cdp.on('Network.requestWillBeSent', (e) => { if (/^(blob|data):/.test(e.request.url)) return; if (t0 == null) t0 = e.timestamp; const u = new URL(e.request.url); reqs.set(e.requestId, { path: u.pathname, search: u.search, start: (e.timestamp - t0) * 1000 }) })
  cdp.on('Network.requestServedFromCache', (e) => { const r = reqs.get(e.requestId); if (r) r.mem = true })
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.hdr = e.response.encodedDataLength || 0; r.disk = !!e.response.fromDiskCache } })
  cdp.on('Network.responseReceivedExtraInfo', (e) => { const r = reqs.get(e.requestId); if (r) r.raw = e.statusCode })
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.done = true } })
  await page.addInitScript(() => { new MutationObserver(() => { if (window.__ready == null && document.querySelector('[data-testid=ready]')) window.__ready = performance.now() }).observe(document, { childList: true, subtree: true }) })
  await page.goto(url, { waitUntil: 'commit' })
  await page.waitForFunction(() => window.__ready != null, null, { timeout: 90000, polling: 50 })
  const readyMs = await page.evaluate(() => window.__ready)
  for (let s = 0, last = -1, same = 0; s < 200 && same < 8; s++) { const n = [...reqs.values()].filter((r) => r.done || r.status === 404).length; same = n === last ? same + 1 : 0; last = n; await sleep(60) }
  const net_ = [...reqs.values()].filter((r) => !r.mem && !r.disk && (r.done || r.status === 404))
  const paths = net_.map((r) => r.path)
  const res = {
    requests: net_.length,
    bytes: net_.reduce((s, r) => s + (r.done ? r.bytes || 0 : r.hdr || 0), 0),
    vue: net_.filter((r) => r.path.endsWith('.vue')).length,
    reval304: net_.filter((r) => r.status === 304 || r.raw === 304).length,
    notFound: net_.filter((r) => r.status === 404).length,
    nonVue: net_.filter((r) => !r.path.endsWith('.vue')).length,
    duplicates: paths.length - new Set(net_.map((r) => r.path + r.search)).size,
    readyMs: Math.round(readyMs), paths,
  }
  if (rtt) res.waves = waves(net_, rtt / 2)
  await page.close()
  return res
}

/** 콜드→웜 한 세션. rtt 가 있으면 지연 에뮬레이션 상태로 측정(웨이브용), 없으면 무제한(요청 수·바이트용) */
export async function session(browser, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try { const cold = await loadOnce(ctx, url, opts); const warm = await loadOnce(ctx, url, opts); return { cold, warm } } finally { await ctx.close() }
}
