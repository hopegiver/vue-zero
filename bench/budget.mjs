// vue-zero 예산 게이트 (Phase 2). 규모 M 앱을 로컬에서 띄워 "결정적 지표"만 하드 게이트로 검사한다.
//  하드: 콜드 요청 수·전송 바이트(brotli), 페이지당 컴포넌트 요청(미사용 0·중복 0), 웜 재검증 요청 수, 라이브러리 크기
//  소프트(경고만): 콜드 ready 시간, 첫 이동 시간 (머신/소음 의존)
// 사용: node bench/budget.mjs [--write-baseline]   (pnpm bench:budget)  — 성공 1줄, 실패는 위반 항목만 출력하고 exit 1
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants } from 'node:zlib'
import net from 'node:net'
import { generate } from './gen/gen-apps.mjs'

const bench = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(bench, '..')
const budgetFile = process.env.BENCH_BUDGET_FILE ? resolve(process.env.BENCH_BUDGET_FILE) : resolve(bench, 'budget.json')
const writeBaseline = process.argv.includes('--write-baseline')
const SIZE = 'M', PORT = Number(process.env.BENCH_BUDGET_PORT || 5921), NAV = 10

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitPort = async (port) => { for (let i = 0; i < 100; i++) { if (await new Promise((ok) => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); ok(true) }); s.on('error', () => ok(false)) })) return; await sleep(100) } throw new Error('server start timeout') }
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const br = (p) => brotliCompressSync(readFileSync(p), { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }).length

async function main() {
  const manifestPath = resolve(bench, 'apps', SIZE, 'manifest.json')
  if (!existsSync(manifestPath)) generate(SIZE)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  execFileSync(resolve(bench, 'scripts/make-cert.sh'))
  const spki = readFileSync(resolve(bench, '.cert/spki.txt'), 'utf8').trim()
  // 컴포넌트 트리 계산(매니페스트의 직접 컴포넌트 + 소스의 중첩 태그)
  const compDir = resolve(bench, 'apps', SIZE, 'vz/components')
  const tree = (name, seen = new Set()) => { if (seen.has(name)) return seen; seen.add(name); const src = readFileSync(resolve(compDir, name + '.vue'), 'utf8'); for (const m of src.matchAll(/<(Comp\d{3})[\s/>]/g)) tree(m[1], seen); return seen }
  const treeOf = (key) => { const s = new Set(); for (const c of manifest.pages[key].components) tree(c, s); return s }

  const srv = spawn('node', ['server.mjs', '--root', resolve(bench, 'apps', SIZE, 'vz'), '--port', String(PORT), '--kind', 'vz', '--mode', 'cf'], { cwd: bench, stdio: 'ignore' })
  const browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${spki}`] })
  const m = {}
  try {
    await waitPort(PORT)
    const origin = `https://127.0.0.1:${PORT}`
    // 1) 콜드 로드 3회(ready 시간 중앙값). 결정적 지표(요청·바이트·컴포넌트·웜)는 첫 회에서 수집, 첫 회에 연속 이동 N회 포함
    const readyMs = [], navFirst = []
    for (let i = 0; i < 3; i++) {
      const c = await browser.newContext(); const page = await c.newPage()
      const cdp = await c.newCDPSession(page); await cdp.send('Network.enable')
      const reqs = new Map()
      cdp.on('Network.requestWillBeSent', (e) => { if (!/^(blob|data):/.test(e.request.url)) reqs.set(e.requestId, { url: new URL(e.request.url).pathname, bytes: 0 }) })
      cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.hdr = e.response.encodedDataLength || 0 } })
      cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.done = true } })
      await page.addInitScript(() => { window.__t0 = performance.now(); new MutationObserver(() => { if (window.__ready == null && document.querySelector('[data-testid=ready]')) window.__ready = performance.now() }).observe(document, { childList: true, subtree: true }) })
      await page.goto(origin + '/', { waitUntil: 'commit' })
      await page.waitForFunction(() => window.__ready != null, null, { timeout: 30000, polling: 50 })
      readyMs.push(await page.evaluate(() => window.__ready))
      for (let s = 0, last = -1, same = 0; s < 100 && same < 6; s++) { const n = [...reqs.values()].filter((r) => r.done || r.status === 404).length; same = n === last ? same + 1 : 0; last = n; await sleep(60) }
      const all = [...reqs.values()].filter((r) => r.done || r.status === 404)
      if (i === 0) {
        m.cold = { requests: all.length, bytes: all.reduce((s, r) => s + (r.done ? r.bytes : r.hdr), 0) }
        const compReq = all.filter((r) => /^\/components\/Comp\d{3}\.vue$/.test(r.url)).map((r) => r.url.replace(/.*\/|\.vue$/g, ''))
        const expected = [...treeOf(manifest.chainKeys[0])].sort()
        m.initComponents = { requested: compReq.length, expected: expected.length, unexpected: compReq.filter((c) => !expected.includes(c)), missing: expected.filter((c) => !compReq.includes(c)) }
        // 2) 연속 이동 N회: 방문 페이지들의 컴포넌트 합집합과 요청이 정확히 일치(미사용 0, 중복 0)
        const union = new Set(expected); let navStart = null
        for (let k = 1; k <= NAV; k++) {
          const key = manifest.chainKeys[k]; for (const c of treeOf(key)) union.add(c)
          const t = await page.evaluate(([k2]) => new Promise((res) => { const t0 = performance.now(); document.querySelector('[data-testid=next]').click(); const tick = () => { const e = document.querySelector('[data-testid=ready]'); if (e && e.dataset.page === k2) requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0))); else requestAnimationFrame(tick) }; tick() }), [key])
          if (k === 1) navFirst.push(t)
          await sleep(150)
        }
        for (let s = 0, last = -1, same = 0; s < 100 && same < 6; s++) { const n = [...reqs.values()].filter((r) => r.done || r.status === 404).length; same = n === last ? same + 1 : 0; last = n; await sleep(60) }
        const all2 = [...reqs.values()].filter((r) => r.done || r.status === 404)
        const comps2 = all2.filter((r) => /^\/components\/Comp\d{3}\.vue$/.test(r.url)).map((r) => r.url)
        const pages2 = all2.filter((r) => /^\/pages\/.+\.vue$/.test(r.url)).map((r) => r.url)
        const dup = (a) => a.length - new Set(a).size
        m.nav = { pages: NAV + 1, componentRequests: comps2.length, unionExpected: union.size, unexpected: comps2.filter((u) => !union.has(u.replace(/.*\/|\.vue$/g, ''))).length, pageRequests: pages2.length }
        m.duplicates = dup(all2.map((r) => r.url)) // 같은 URL 이 한 세션에서 2번 이상 네트워크로 나가면 중복
        // 3) 웜: 같은 컨텍스트 새 탭 재방문 (must-revalidate → 304 개수)
        const p2 = await c.newPage(); const cdp2 = await c.newCDPSession(p2); await cdp2.send('Network.enable')
        const r2 = new Map()
        cdp2.on('Network.requestWillBeSent', (e) => { if (!/^(blob|data):/.test(e.request.url)) r2.set(e.requestId, { url: e.request.url, mem: false }) })
        cdp2.on('Network.requestServedFromCache', (e) => { const r = r2.get(e.requestId); if (r) r.mem = true })
        cdp2.on('Network.responseReceived', (e) => { const r = r2.get(e.requestId); if (r) { r.status = e.response.status; r.disk = !!e.response.fromDiskCache; r.hdr = e.response.encodedDataLength || 0 } })
        cdp2.on('Network.loadingFinished', (e) => { const r = r2.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.done = true } })
        await p2.addInitScript(() => { new MutationObserver(() => { if (window.__ready == null && document.querySelector('[data-testid=ready]')) window.__ready = performance.now() }).observe(document, { childList: true, subtree: true }) })
        await p2.goto(origin + '/', { waitUntil: 'commit' }); await p2.waitForFunction(() => window.__ready != null, null, { timeout: 30000, polling: 50 })
        for (let s = 0, last = -1, same = 0; s < 100 && same < 6; s++) { const n = [...r2.values()].filter((r) => r.done || r.status === 404).length; same = n === last ? same + 1 : 0; last = n; await sleep(60) }
        const w = [...r2.values()].filter((r) => !r.mem && !r.disk && (r.done || r.status === 404))
        m.warm = { requests: w.length, bytes: w.reduce((s, r) => s + (r.done ? r.bytes : r.hdr), 0) }
      }
      await c.close()
    }
    m.cold.readyMs = median(readyMs); m.navFirstMs = navFirst[0] // 이동은 첫 회에만 수행(단일 값, 소프트 지표)
    m.libs = { vueBrotli: br(resolve(pkgRoot, 'node_modules/vue/dist/vue.global.prod.js')), routerBrotli: br(resolve(pkgRoot, 'node_modules/vue-router/dist/vue-router.global.prod.js')), vzBrotli: br(resolve(pkgRoot, 'dist/vue-zero.js')), vzRaw: statSync(resolve(pkgRoot, 'dist/vue-zero.js')).size }
  } finally { await browser.close(); srv.kill() }

  const measured = {
    coldRequests: m.cold.requests, coldBytes: m.cold.bytes, warmRequests: m.warm.requests,
    navComponentRequests: m.nav.componentRequests, vzBrotliBytes: m.libs.vzBrotli, vzRawBytes: m.libs.vzRaw, libsBrotliBytes: m.libs.vueBrotli + m.libs.routerBrotli + m.libs.vzBrotli,
    coldReadyMs: Math.round(m.cold.readyMs), navFirstMs: Math.round(m.navFirstMs),
  }
  if (writeBaseline) {
    const up = (v, f) => Math.ceil(v * f)
    const b = {
      _comment: '하드 게이트 = 측정값 +15%, 소프트(경고) 시간 = 측정값 x2. --write-baseline 으로 재생성(규모 M, 로컬 무제한 프로필).',
      size: SIZE, baseline: measured,
      hard: { coldRequests: up(measured.coldRequests, 1.15), coldBytes: up(measured.coldBytes, 1.15), warmRequests: up(measured.warmRequests, 1.15), navComponentRequests: up(measured.navComponentRequests, 1.15), vzBrotliBytes: up(measured.vzBrotliBytes, 1.15), vzRawBytes: up(measured.vzRawBytes, 1.15), libsBrotliBytes: up(measured.libsBrotliBytes, 1.15) },
      exact: { unexpectedInitialComponents: 0, missingInitialComponents: 0, unexpectedNavComponents: 0, duplicateRequests: 0, navComponentRequestsEqualsUnion: true },
      soft: { coldReadyMs: up(measured.coldReadyMs, 2), navFirstMs: up(measured.navFirstMs, 2) },
    }
    writeFileSync(budgetFile, JSON.stringify(b, null, 1) + '\n'); console.log('baseline written', JSON.stringify(measured)); return 0
  }
  const B = JSON.parse(readFileSync(budgetFile, 'utf8'))
  const bad = [], warn = []
  for (const [k, lim] of Object.entries(B.hard)) if (measured[k] > lim) bad.push(`${k}: ${measured[k]} > ${lim} (baseline ${B.baseline[k]})`)
  if (m.initComponents.unexpected.length) bad.push(`초기 로드에서 홈이 쓰지 않는 컴포넌트 요청 ${m.initComponents.unexpected.length}건: ${m.initComponents.unexpected.slice(0, 5)}`)
  if (m.initComponents.missing.length) bad.push(`홈 컴포넌트 트리 중 요청되지 않은 것 ${m.initComponents.missing.length}건: ${m.initComponents.missing.slice(0, 5)}`)
  if (m.nav.unexpected) bad.push(`이동 중 방문 페이지가 쓰지 않는 컴포넌트 요청 ${m.nav.unexpected}건`)
  if (m.nav.componentRequests !== m.nav.unionExpected) bad.push(`컴포넌트 요청 ${m.nav.componentRequests} != 방문 페이지 컴포넌트 합집합 ${m.nav.unionExpected} (중복/누락)`)
  if (m.duplicates) bad.push(`같은 URL 중복 네트워크 요청 ${m.duplicates}건`)
  for (const [k, lim] of Object.entries(B.soft)) if (measured[k] > lim) warn.push(`${k}: ${measured[k]} > ${lim}`)
  if (bad.length) { console.error(`bench:budget FAIL (${bad.length})\n` + bad.map((x) => '  - ' + x).join('\n') + (warn.length ? '\n  warn: ' + warn.join(', ') : '')); return 1 }
  console.log(`bench:budget OK — ${SIZE}: cold req ${measured.coldRequests}/${B.hard.coldRequests} bytes ${measured.coldBytes}/${B.hard.coldBytes} warm-reval ${measured.warmRequests}/${B.hard.warmRequests} nav-comp ${m.nav.componentRequests}=${m.nav.unionExpected} dup 0 libs(br) ${measured.libsBrotliBytes}/${B.hard.libsBrotliBytes} | soft: ready ${measured.coldReadyMs}ms nav1 ${measured.navFirstMs}ms${warn.length ? ' WARN ' + warn.join(', ') : ''}`)
  return 0
}
main().then((c) => process.exit(c), (e) => { console.error('bench:budget ERROR', e.message); process.exit(2) })
