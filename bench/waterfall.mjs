// 요청 워터폴 분석: 콜드 로드(홈)의 요청 시작 시각을 군집화해 "라운드(웨이브)" 수를 센다. 군집 간격 > RTT/2 이면 새 웨이브(타이밍 기반 추론).
// 사용: node bench/waterfall.mjs [--size M] [--out results/waterfall.json]
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const bench = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] }
const size = opt('size', 'M'), outFile = resolve(bench, opt('out', 'results/waterfall.json'))
const RTT = 150, GAP = RTT / 2
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
execFileSync(resolve(bench, 'scripts/make-cert.sh'))
const spki = readFileSync(resolve(bench, '.cert/spki.txt'), 'utf8').trim()
const waitPort = async (p) => { for (let i = 0; i < 100; i++) { if (await new Promise((ok) => { const s = net.connect(p, '127.0.0.1'); s.on('connect', () => { s.destroy(); ok(true) }); s.on('error', () => ok(false)) })) return; await sleep(100) } }
const variants = { vz: { root: resolve(bench, 'apps', size, 'vz'), kind: 'vz', port: 5951 }, nuxt: { root: resolve(bench, 'build', `nuxt-${size}`), kind: 'nuxt', port: 5952 } }
const servers = Object.values(variants).map((v) => spawn('node', ['server.mjs', '--root', v.root, '--port', String(v.port), '--kind', v.kind], { cwd: bench, stdio: 'ignore' }))
const res = { size, rttMs: RTT, gapMs: GAP, note: '프로필 P3 네트워크(RTT150, 1.6Mbps) + CPU 1x. 웨이브 = 시작 시각 간격 > RTT/2 로 구분한 요청 군집(타이밍 기반 추론, 실제 의존 관계 아님)', variants: {} }
try {
  for (const v of Object.values(variants)) await waitPort(v.port)
  const browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${spki}`] })
  for (const [name, v] of Object.entries(variants)) {
    const runs = []
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext(); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page)
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 })
      const reqs = new Map(); let t0 = null
      cdp.on('Network.requestWillBeSent', (e) => { if (/^(blob|data):/.test(e.request.url)) return; if (t0 == null) t0 = e.timestamp; reqs.set(e.requestId, { url: new URL(e.request.url).pathname, start: (e.timestamp - t0) * 1000 }) })
      cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.end = (e.timestamp - t0) * 1000 })
      await page.addInitScript(() => { new MutationObserver(() => { if (window.__ready == null && document.querySelector('[data-testid=ready]')) window.__ready = performance.now() }).observe(document, { childList: true, subtree: true }) })
      await page.goto(`https://127.0.0.1:${v.port}/`, { waitUntil: 'commit' })
      await page.waitForFunction(() => window.__ready != null, null, { timeout: 60000, polling: 50 }); await sleep(800)
      const list = [...reqs.values()].sort((a, b) => a.start - b.start)
      const waves = []; for (const r of list) { const w = waves[waves.length - 1]; if (w && r.start - w.lastStart <= GAP) { w.reqs.push(r.url); w.lastStart = r.start } else waves.push({ startMs: Math.round(r.start), lastStart: r.start, reqs: [r.url] }) }
      runs.push({ readyMs: Math.round(await page.evaluate(() => window.__ready)), requests: list.length, waves: waves.length, waveDetail: waves.map((w) => ({ startMs: w.startMs, n: w.reqs.length, sample: w.reqs.slice(0, 4) })) })
      await ctx.close()
    }
    res.variants[name] = runs
  }
  await browser.close()
} finally { servers.forEach((s) => s.kill()) }
writeFileSync(outFile, JSON.stringify(res, null, 1))
for (const [n, r] of Object.entries(res.variants)) console.log(n, 'waves', r.map((x) => x.waves), 'ready', r.map((x) => x.readyMs))
