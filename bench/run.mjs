// 벤치 러너: 변형(vz / vz-immutable / nuxt) × 규모(S/M/L) × 네트워크·CPU 프로필(1/2/3) × 반복.
// 세션 1회 = 새 컨텍스트(콜드) → 콜드 로드 → SPA 이동(첫/재방문/20연속) → 메모리 → 같은 컨텍스트 새 탭으로 웜 로드.
// 변형 순서는 반복마다 회전(인터리브)해 시간대 소음 편향을 줄인다.
// 사용: node bench/run.mjs --out results/raw-main.jsonl [--sizes S,M,L] [--profiles 1,2,3] [--reps 7] [--variants vz,vz-immutable,nuxt] [--h1]
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { readdirSync, statSync, readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadavg } from 'node:os'
import https from 'node:https'
import http from 'node:http'
import net from 'node:net'

const bench = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) }
const sizes = String(opt('sizes', 'S,M,L')).split(',')
const profileIds = String(opt('profiles', '1,2,3')).split(',').map(Number)
const reps = Number(opt('reps', 7))
const variantNames = String(opt('variants', 'vz,vz-immutable,nuxt')).split(',')
const h1 = !!opt('h1', false)
const coldOnly = !!opt('cold-only', false) // 콜드+웜 로드만(이동·메모리 생략)
const out = resolve(bench, String(opt('out', 'results/raw-main.jsonl')))
const basePort = Number(opt('port', 5700))
const maxNav = Number(process.env.BENCH_MAXNAV || 20)

export const PROFILES = {
  1: { name: 'unthrottled', rtt: 0, down: 0, up: 0, cpu: 1 },
  2: { name: 'broadband', rtt: 40, down: 10e6 / 8, up: 10e6 / 8, cpu: 1 },
  3: { name: 'slow4g-mobile', rtt: 150, down: 1.6e6 / 8, up: 0.75e6 / 8, cpu: 4 },
}

const INIT = `(() => {
  const b = window.__vzb = { readyAt: null, fcp: null, lcp: null, errors: [] }
  const mo = new MutationObserver(() => {
    if (b.readyAt == null && document.querySelector('[data-testid=ready]')) { b.readyAt = performance.now() }
  })
  mo.observe(document, { childList: true, subtree: true })
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') b.fcp = e.startTime }).observe({ type: 'paint', buffered: true }) } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) b.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch {}
  window.__navTo = (testid, key) => new Promise((res, rej) => {
    const t0 = performance.now()
    const el = document.querySelector('[data-testid=' + testid + ']')
    if (!el) return rej(new Error('no link ' + testid))
    el.click()
    const tick = () => {
      const m = document.querySelector('[data-testid=ready]')
      if (m && m.dataset.page === key) requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0)))
      else if (performance.now() - t0 > 90000) rej(new Error('nav timeout ' + key))
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
})()`

function waitPort(port) {
  return new Promise((ok, bad) => {
    const t0 = Date.now()
    const t = () => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); ok() }); s.on('error', () => { s.destroy(); Date.now() - t0 > 10000 ? bad(new Error('port ' + port)) : setTimeout(t, 100) }) }
    t()
  })
}
function walk(dir, base = dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p)] }) }
function get(origin, path) {
  const lib = origin.startsWith('https') ? https : http
  return new Promise((ok) => { lib.get(origin + path, { rejectUnauthorized: false, headers: { 'accept-encoding': 'br' } }, (r) => { r.resume(); r.on('end', ok) }).on('error', ok) })
}

function variantSpec(v, size) {
  const root = v === 'nuxt' ? resolve(bench, 'build', `nuxt-${size}`) : resolve(bench, 'apps', size, 'vz')
  const indexFile = v === 'vz-hintsA' ? 'index.hintsA.html' : v.startsWith('vz-hintsB') ? 'index.hintsB.html' : null
  return { root, kind: v === 'nuxt' ? 'nuxt' : 'vz', mode: v === 'vz-immutable' || v === 'vz-hintsB-imm' ? 'immutable' : 'cf', indexFile }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function instrument(ctx, profile) {
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const st = { reqs: new Map(), inflight: 0, lastActivity: Date.now() }
  await cdp.send('Network.enable'); await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable')
  if (profile.rtt || profile.down) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.rtt, downloadThroughput: profile.down || -1, uploadThroughput: profile.up || -1 })
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  cdp.on('Network.requestWillBeSent', (e) => { if (/^(blob|data):/.test(e.request.url)) return; st.reqs.set(e.requestId, { url: e.request.url, t: Date.now() }); st.inflight++; st.lastActivity = Date.now() })
  cdp.on('Network.requestServedFromCache', (e) => { const r = st.reqs.get(e.requestId); if (r) r.mem = true })
  cdp.on('Network.responseReceived', (e) => { const r = st.reqs.get(e.requestId); if (r) { r.status = e.response.status; r.hdr = e.response.encodedDataLength || 0; r.disk = !!e.response.fromDiskCache; r.proto = e.response.protocol } })
  cdp.on('Network.responseReceivedExtraInfo', (e) => { const r = st.reqs.get(e.requestId); if (r) r.raw = e.statusCode })
  cdp.on('Network.loadingFinished', (e) => { const r = st.reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.done = true; st.inflight--; st.lastActivity = Date.now() } })
  cdp.on('Network.loadingFailed', (e) => { const r = st.reqs.get(e.requestId); if (r) { r.failed = true; r.done = true; st.inflight-- ; st.lastActivity = Date.now() } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push('console: ' + m.text().slice(0, 200)) })
  const snap = () => {
    let requests = 0, bytes = 0, n304 = 0, cached = 0, h2 = 0
    for (const r of st.reqs.values()) {
      if (r.mem || r.disk) { cached++; continue }
      if (!r.done && r.status !== 404) continue
      requests++; bytes += r.done ? (r.bytes || 0) : (r.hdr || 0); if (r.raw === 304 || r.status === 304) n304++; if (r.proto === 'h2') h2++
    }
    return { requests, bytes, n304, cached, h2 }
  }
  const pend = () => { let n = 0; for (const r of st.reqs.values()) if (!r.done && r.status !== 404) n++; return n }
  const settle = async (quiet = 400, cap = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < cap) { if (pend() === 0 && Date.now() - st.lastActivity >= quiet) return true; await sleep(50) } return false }
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  return { page, cdp, st, snap, settle, metrics, pageErrors }
}

async function loadMeasure(ctx, url, profile, expectNodes) {
  const h = await instrument(ctx, profile)
  await h.page.addInitScript(INIT)
  const t0 = Date.now()
  await h.page.goto(url, { waitUntil: 'commit' })
  await h.page.waitForFunction(() => window.__vzb && window.__vzb.readyAt != null, null, { timeout: 120000, polling: 50 })
  const wall = Date.now() - t0
  const settled = await h.settle()
  const pending = [...h.st.reqs.values()].filter((r) => !r.done && r.status !== 404).map((r) => r.url.slice(0, 80))
  if (pending.length && process.env.BENCH_DEBUG) console.log('PENDING', pending)
  const b = await h.page.evaluate(() => ({ ...window.__vzb, compNodes: document.querySelectorAll('[data-comp]').length, styleNodes: document.querySelectorAll('style').length, linkCss: document.querySelectorAll('link[rel=stylesheet]').length }))
  const m = await h.metrics()
  const nav = await h.page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, resp: n.responseStart } : null })
  const res = { readyMs: b.readyAt, fcpMs: b.fcp, lcpMs: b.lcp, wallMs: wall, settled, ...h.snap(), compNodes: b.compNodes, expectedCompNodes: expectNodes, compOk: b.compNodes === expectNodes, styleNodes: b.styleNodes, linkCss: b.linkCss,
    taskMs: m.TaskDuration * 1000, scriptMs: m.ScriptDuration * 1000, layoutMs: m.LayoutDuration * 1000, styleRecalcMs: m.RecalcStyleDuration * 1000, nav, errors: h.pageErrors.slice(0, 5) }
  return { h, res }
}

async function memory(h) {
  await h.cdp.send('HeapProfiler.collectGarbage'); await h.cdp.send('HeapProfiler.collectGarbage')
  const heap = await h.cdp.send('Runtime.getHeapUsage')
  const m = await h.metrics()
  const dom = await h.page.evaluate(() => ({ style: document.querySelectorAll('style').length, link: document.querySelectorAll('link[rel=stylesheet]').length }))
  return { heapUsedMB: heap.usedSize / 1048576, heapTotalMB: heap.totalSize / 1048576, nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents, styleNodes: dom.style, linkCss: dom.link }
}

async function session(browser, origin, size, profile, manifest) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const la0 = loadavg()[0]
  const home = manifest.pages[manifest.chainKeys[0]]
  const out = { cold: null, nav: null, memory: null, warm: null }
  try {
    const { h, res } = await loadMeasure(ctx, origin + '/', profile, home.expectedCompNodes)
    out.cold = res
    if (coldOnly) { out.cold.pageErrors = h.pageErrors.slice(0, 5); await h.page.close(); const w0 = await loadMeasure(ctx, origin + '/', profile, home.expectedCompNodes); out.warm = w0.res; await w0.h.page.close(); out.loadavgStart = la0; out.loadavgEnd = loadavg()[0]; return out }
    out.memory = { afterHome: await memory(h) }
    // SPA 이동
    const keys = manifest.chainKeys
    const K = Math.min(maxNav, keys.length - 1)
    const navs = []
    const go = async (testid, key, kind) => {
      const before = h.snap()
      const ms = await h.page.evaluate(([t, k]) => window.__navTo(t, k), [testid, key])
      await h.settle(250, 15000)
      const after = h.snap()
      navs.push({ kind, key, ms, requests: after.requests - before.requests, bytes: after.bytes - before.bytes })
    }
    await go('next', keys[1], 'first')       // 미방문 첫 이동
    await go('prev', keys[0], 'revisit')     // 재방문 (홈)
    await go('next', keys[1], 'revisit')     // 재방문
    for (let i = 2; i <= K; i++) await go('next', keys[i], 'seq')   // 서로 다른 미방문 페이지 연속
    const seq = navs.filter((n) => n.kind === 'seq')
    const firstVisits = [navs[0], ...seq]
    out.nav = {
      list: navs, count: K,
      firstMs: navs[0].ms, firstReq: navs[0].requests, firstBytes: navs[0].bytes,
      revisitMs: median(navs.filter((n) => n.kind === 'revisit').map((n) => n.ms)),
      seqAvgMs: firstVisits.reduce((s, n) => s + n.ms, 0) / firstVisits.length,
      seqTotalReq: firstVisits.reduce((s, n) => s + n.requests, 0), seqTotalBytes: firstVisits.reduce((s, n) => s + n.bytes, 0),
    }
    out.memory.afterNav = { ...(await memory(h)), visited: K + 1 }
    out.cold.pageErrors = [...new Set([...out.cold.errors, ...h.pageErrors])].slice(0, 5)
    await h.page.close()
    // 웜 로드: 같은 컨텍스트(HTTP 캐시 유지), 새 탭
    const w = await loadMeasure(ctx, origin + '/', profile, home.expectedCompNodes)
    out.warm = w.res
    await w.h.page.close()
  } finally { await ctx.close() }
  out.loadavgStart = la0; out.loadavgEnd = loadavg()[0]
  return out
}

async function main() {
  execFileSync(resolve(bench, 'scripts/make-cert.sh'))
  const spki = readFileSync(resolve(bench, '.cert/spki.txt'), 'utf8').trim()
  mkdirSync(dirname(out), { recursive: true })
  const servers = [], origins = {}, manifests = {}
  let port = basePort
  for (const size of sizes) {
    manifests[size] = JSON.parse(readFileSync(resolve(bench, 'apps', size, 'manifest.json'), 'utf8'))
    for (const v of variantNames) {
      const sp = variantSpec(v, size)
      if (!existsSync(sp.root)) throw new Error('없음: ' + sp.root + ' (gen-apps / build-nuxt 먼저)')
      const p = port++
      const a = ['server.mjs', '--root', sp.root, '--port', String(p), '--kind', sp.kind, '--mode', sp.mode]; if (sp.indexFile) a.push('--index-file', sp.indexFile)
      if (h1) a.push('--h1')
      servers.push(spawn('node', a, { cwd: bench, stdio: 'ignore' }))
      origins[v + ':' + size] = `${h1 ? 'http' : 'https'}://127.0.0.1:${p}`
      await waitPort(p)
      // 압축 캐시 예열(서버 첫 요청 압축 비용이 측정에 섞이지 않게)
      const files = walk(sp.root).map((f) => '/' + f.split('\\').join('/'))
      if (sp.kind === 'vz') files.push('/lib/vue.js', '/lib/vue-router.js', '/lib/vue-zero.js')
      for (let i = 0; i < files.length; i += 16) await Promise.all(files.slice(i, i + 16).map((f) => get(origins[v + ':' + size], f)))
    }
  }
  const browser = await chromium.launch({ headless: true, args: h1 ? [] : [`--ignore-certificate-errors-spki-list=${spki}`] })
  const meta = { type: 'meta', started: new Date().toISOString(), chromium: browser.version(), h1, sizes, profiles: profileIds, reps, variants: variantNames, loadavgStart: loadavg() }
  appendFileSync(out, JSON.stringify(meta) + '\n')
  const t0 = Date.now(); let n = 0; const total = reps * sizes.length * profileIds.length * variantNames.length
  try {
    for (let rep = 0; rep < reps; rep++) for (const size of sizes) for (const pid of profileIds) {
      const order = variantNames.map((_, i) => variantNames[(i + rep) % variantNames.length]) // 회전
      for (const v of order) {
        let rec
        try { rec = { type: 'session', variant: v, size, profile: pid, rep, ...(await session(browser, origins[v + ':' + size], size, PROFILES[pid], manifests[size])) } }
        catch (e) { rec = { type: 'session', variant: v, size, profile: pid, rep, error: String(e && e.stack || e).slice(0, 600) } }
        appendFileSync(out, JSON.stringify(rec) + '\n')
        n++
        const c = rec.cold
        console.log(`[${n}/${total}] ${size} p${pid} ${v} rep${rep} ` + (rec.error ? 'ERROR ' + rec.error : `cold=${c.readyMs.toFixed(0)}ms warm=${rec.warm.readyMs.toFixed(0)}ms req=${c.requests}/${rec.warm.requests} ok=${c.compOk}`) + ` load=${loadavg()[0].toFixed(1)} t=${Math.round((Date.now() - t0) / 1000)}s`)
      }
    }
  } finally {
    appendFileSync(out, JSON.stringify({ type: 'end', ended: new Date().toISOString(), loadavgEnd: loadavg() }) + '\n')
    await browser.close(); servers.forEach((s) => s.kill())
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
