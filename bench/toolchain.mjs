// 툴체인 비용 측정: 설치(콜드/웜 스토어), nuxt generate, 개발 서버 기동, 산출물 크기, 소스/설정 파일 수.
// 사용: node bench/toolchain.mjs [--gen-reps 3] [--out results/toolchain.json]
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, mkdtempSync } from 'node:fs'
import { resolve, dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants } from 'node:zlib'
import { loadavg, tmpdir } from 'node:os'
import net from 'node:net'

const bench = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(bench, '..')
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] }
const genReps = Number(opt('gen-reps', 3))
const outFile = resolve(bench, opt('out', 'results/toolchain.json'))
const scratch = process.env.BENCH_SCRATCH || mkdtempSync(join(tmpdir(), 'vzbench-'))
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const TEXT = new Set(['.html', '.js', '.json', '.vue', '.css', '.txt', '.svg'])
const sizeOf = (files) => { let raw = 0, br = 0; for (const f of files) { const b = readFileSync(f); raw += b.length; br += TEXT.has(extname(f)) ? brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }).length : b.length } return { files: files.length, rawBytes: raw, brotliBytes: br } }
const duKB = (p) => Number(execFileSync('du', ['-sk', p], { encoding: 'utf8' }).split('\t')[0])
const res = { loadavgStart: loadavg()[0], node: process.version, pnpm: execFileSync('pnpm', ['-v'], { encoding: 'utf8' }).trim() }

// 1) Nuxt 설치 (스크래치에 package.json/lock/workspace 복사)
const inst = resolve(scratch, 'nuxt-install'); rmSync(inst, { recursive: true, force: true }); mkdirSync(inst, { recursive: true })
for (const f of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) cpSync(resolve(bench, 'nuxt-app', f), resolve(inst, f))
const store = resolve(scratch, 'fresh-store')
const run = (args, cwd) => { const t = Date.now(); const r = spawnSync('pnpm', args, { cwd, encoding: 'utf8' }); return { ms: Date.now() - t, ok: r.status === 0, tail: (r.stdout + r.stderr).slice(-300) } }
const cold = run(['install', '--frozen-lockfile', '--store-dir', store], inst)
res.install = { coldStoreMs: cold.ok ? cold.ms : null, coldOk: cold.ok, storeKB: existsSync(store) ? duKB(store) : null, nodeModulesKB: duKB(resolve(inst, 'node_modules')) }
rmSync(resolve(inst, 'node_modules'), { recursive: true, force: true })
const warm = run(['install', '--frozen-lockfile', '--store-dir', store], inst)
res.install.warmStoreMs = warm.ok ? warm.ms : null
res.install.nodeModulesFiles = Number(execFileSync('sh', ['-c', `find ${inst}/node_modules -type f -o -type l | wc -l`], { encoding: 'utf8' }).trim())
res.install.vzForAppDeveloper = { installMs: 0, nodeModulesKB: 0, note: '앱 개발자는 설치 없음(vue/vue-router/vue-zero 를 <script> 로 로드)' }

// 2) nuxt generate (.nuxt/.output 삭제 후 클린 빌드, N회 중앙값)
res.generate = {}
const app = resolve(bench, 'nuxt-app')
for (const size of ['S', 'M', 'L']) {
  const ms = []
  for (let i = 0; i < genReps; i++) {
    rmSync(resolve(app, 'app'), { recursive: true, force: true }); rmSync(resolve(app, '.nuxt'), { recursive: true, force: true }); rmSync(resolve(app, '.output'), { recursive: true, force: true })
    cpSync(resolve(bench, 'apps', size, 'nuxt'), resolve(app, 'app'), { recursive: true })
    const t = Date.now(); const r = spawnSync('pnpm', ['exec', 'nuxt', 'generate'], { cwd: app, encoding: 'utf8', env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1', CI: '1' } })
    if (r.status !== 0) throw new Error('generate 실패 ' + r.stderr.slice(-500))
    ms.push(Date.now() - t)
  }
  res.generate[size] = { runsMs: ms, medianMs: median(ms), vzBuildMs: 0 }
}

// 3) 산출물 크기·파일 수 (vue-zero = 앱 소스 + 런타임 라이브러리 3개 / Nuxt = .output/public)
const libs = ['node_modules/vue/dist/vue.global.prod.js', 'node_modules/vue-router/dist/vue-router.global.prod.js', 'dist/vue-zero.js'].map((p) => resolve(pkgRoot, p))
res.libs = Object.fromEntries(libs.map((f) => [f.split('/').pop(), sizeOf([f])]))
res.output = {}
for (const size of ['S', 'M', 'L']) {
  const vzApp = walk(resolve(bench, 'apps', size, 'vz'))
  const nuxtOut = walk(resolve(bench, 'build', `nuxt-${size}`))
  const srcVue = (d) => walk(resolve(bench, 'apps', size, d)).filter((f) => f.endsWith('.vue')).length
  res.output[size] = {
    vz: { app: sizeOf(vzApp), libs: sizeOf(libs), total: sizeOf([...vzApp, ...libs]), vueFiles: srcVue('vz'), configFiles: 0, otherFiles: ['index.html', 'pages/pages.json', 'components/components.json'] },
    nuxt: { out: sizeOf(nuxtOut), jsCssChunks: nuxtOut.filter((f) => /\/_nuxt\//.test(f)).length, vueFiles: srcVue('nuxt'), configFiles: ['nuxt.config.ts', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'].length, otherFiles: ['app.vue (vueFiles 에 포함)', '.nuxt/ 생성 디렉터리(tsconfig 등)'] },
  }
}

// 4) 개발 서버 기동 (M 규모)
const portUp = (port) => new Promise((ok) => { const s = net.connect(port, 'localhost'); s.on('connect', () => { s.destroy(); ok(true) }); s.on('error', () => ok(false)) })
async function timeStart(cmd, args, cwd, port, readyFn) {
  const t0 = Date.now(); const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1', CI: '1' }, detached: true })
  let logTail = ''; p.stdout.on('data', (d) => (logTail = (logTail + d).slice(-500))); p.stderr.on('data', (d) => (logTail = (logTail + d).slice(-500)))
  let portMs = null, okMs = null
  while (Date.now() - t0 < 120000) {
    if (portMs == null && await portUp(port)) portMs = Date.now() - t0
    if (portMs != null) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok && await readyFn(r)) { okMs = Date.now() - t0; break } } catch {} }
    await sleep(50)
  }
  try { process.kill(-p.pid, 'SIGTERM') } catch {}
  await sleep(500)
  return { portOpenMs: portMs, firstHtmlOkMs: okMs, log: logTail.slice(-150) }
}
res.devServer = { vz: [], nuxt: [] }
for (let i = 0; i < 3; i++) res.devServer.vz.push(await timeStart('node', ['server.mjs', '--root', 'apps/M/vz', '--port', '5811', '--kind', 'vz', '--h1'], bench, 5811, async () => true))
rmSync(resolve(app, 'app'), { recursive: true, force: true }); cpSync(resolve(bench, 'apps', 'M', 'nuxt'), resolve(app, 'app'), { recursive: true })
for (let i = 0; i < 3; i++) res.devServer.nuxt.push(await timeStart('pnpm', ['exec', 'nuxt', 'dev', '--port', '5812', '--no-fork'], app, 5812, async (r) => (await r.text()).includes('<div id="__nuxt">') || true))
res.devServer.note = 'vz = node 정적 서버(--h1) 포트 열림~첫 200. nuxt = `nuxt dev` 프로세스 시작~포트 열림/첫 HTML 200. nuxt dev 는 첫 페이지 요청 시 추가 컴파일(vite)이 일어나므로 화면 도달 시간은 더 길 수 있음(미측정).'
res.loadavgEnd = loadavg()[0]
mkdirSync(dirname(outFile), { recursive: true }); writeFileSync(outFile, JSON.stringify(res, null, 1))
console.log('[toolchain] ->', outFile)
