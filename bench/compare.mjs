// 결정적 지표 비교: vz · vz-manifest · vz-immutable · nuxt × 규모. 홈 콜드/웜의 요청 수·바이트·.vue 요청 수·304 재검증 수·waterfall 깊이(웨이브).
// 시간(ms)은 참고용(load average 동봉). 사용: node bench/compare.mjs [--sizes S,M,L] [--reps 3] [--out results/compare.json]
//  - 요청 수·바이트·.vue 수는 지연 없는 세션, 웨이브는 RTT150 에뮬 세션(타이밍 기반 추론)에서 측정. 값이 반복마다 다르면 min~max 로 표기.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadavg } from 'node:os'
import { startServer, waitPort, session, median, originFor, HOST_RULES } from './probe.mjs'

const bench = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] }
const sizes = opt('sizes', 'S,M,L').split(','), reps = Number(opt('reps', 3)), outFile = resolve(bench, opt('out', 'results/compare.json'))
const VARIANTS = ['vz', 'vz-manifest', 'vz-immutable', 'nuxt']
const spec = (v, size) => v === 'nuxt'
  ? { root: resolve(bench, 'build', `nuxt-${size}`), kind: 'nuxt', mode: 'cf' }
  : { root: resolve(bench, 'apps', size, 'vz'), kind: 'vz', mode: v === 'vz-immutable' ? 'immutable' : 'cf', indexFile: v === 'vz-manifest' ? 'index.manifest.html' : undefined }

execFileSync(resolve(bench, 'scripts/make-cert.sh'))
const spki = readFileSync(resolve(bench, '.cert/spki.txt'), 'utf8').trim()
const servers = [], urls = {}
let port = 5960
for (const size of sizes) for (const v of VARIANTS) { const p = port++; servers.push(startServer(bench, { ...spec(v, size), port: p })); await waitPort(p); urls[v + ':' + size] = originFor(v, p) + '/' }
const browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${spki}`, HOST_RULES] })
const out = { meta: { started: new Date().toISOString(), chromium: browser.version(), reps, loadavgStart: loadavg() }, cells: {} }
try {
  for (const size of sizes) for (const v of VARIANTS) {
    const url = urls[v + ':' + size]
    const flat = [], lat = []
    // 서버 압축 캐시 예열(측정 제외) 후 반복
    await session(browser, url)
    for (let i = 0; i < reps; i++) { flat.push(await session(browser, url)); lat.push(await session(browser, url, { rtt: 150 })) }
    const pick = (arr, ph, k) => arr.map((s) => s[ph][k])
    const cell = {}
    for (const ph of ['cold', 'warm']) {
      cell[ph] = {
        requests: pick(flat, ph, 'requests'), bytes: pick(flat, ph, 'bytes'), vue: pick(flat, ph, 'vue'), reval304: pick(flat, ph, 'reval304'), notFound: pick(flat, ph, 'notFound'), duplicates: pick(flat, ph, 'duplicates'),
        waves: lat.map((s) => s[ph].waves.length), readyMsRtt150: pick(lat, ph, 'readyMs'), readyMsUnthrottled: pick(flat, ph, 'readyMs'),
        paths: flat[0][ph].paths.slice().sort(),
      }
    }
    out.cells[`${size}|${v}`] = cell
    console.log(size, v.padEnd(13), 'cold', cell.cold.requests.join('/'), 'vue', cell.cold.vue.join('/'), 'waves', cell.cold.waves.join('/'), '| warm', cell.warm.requests.join('/'), 'vue', cell.warm.vue.join('/'), '304', cell.warm.reval304.join('/'), 'waves', cell.warm.waves.join('/'))
  }
} finally { out.meta.ended = new Date().toISOString(); out.meta.loadavgEnd = loadavg(); await browser.close(); servers.forEach((s) => s.kill()) }
writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n')

const rng = (a) => { const mn = Math.min(...a), mx = Math.max(...a); return mn === mx ? String(mn) : `${mn}~${mx}` }
const lines = ['| 규모 | 변형 | 콜드 요청 | 콜드 바이트 | 콜드 .vue | 콜드 waves | 웜 요청 | 웜 바이트 | 웜 .vue | 웜 304 | 웜 waves |', '|---|---|---|---|---|---|---|---|---|---|---|']
for (const [k, c] of Object.entries(out.cells)) { const [s, v] = k.split('|'); lines.push(`| ${s} | ${v} | ${rng(c.cold.requests)} | ${median(c.cold.bytes).toLocaleString('en')} | ${rng(c.cold.vue)} | ${rng(c.cold.waves)} | ${rng(c.warm.requests)} | ${median(c.warm.bytes).toLocaleString('en')} | ${rng(c.warm.vue)} | ${rng(c.warm.reval304)} | ${rng(c.warm.waves)} |`) }
writeFileSync(outFile.replace(/\.json$/, '.tables.md'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
