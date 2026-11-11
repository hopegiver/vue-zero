// publish 직후 소유자가 로컬에서 수동 실행하는 확인 스크립트. 의존성 없음, Node 18+ (fetch).
// 레지스트리에 버전이 보이고, 게시된 tarball 의 dist/vue-zero.js 가 그 버전 태그(v<버전>)에 커밋된 dist 와 바이트 단위로 같은지 확인한다.
// 사용: node scripts/verify-published.mjs [X.Y.Z] [--ref <git-ref>]   (생략 시 package.json 버전. 성공 1줄, 실패 시 FAIL 사유)
// 비교 대상 dist: --ref 가 있으면 그 ref, 없으면 태그 v<버전>, 태그도 없으면 HEAD 의 dist(태그 없는 과거 버전은 --ref 로 커밋을 지정). 전파 지연은 짧게 재시도(--attempts, --interval)
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def)
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')))
const ref = arg('--ref')
const version = positional[0] || pkg.version
const attempts = Number(arg('--attempts', 6))
const interval = Number(arg('--interval', 10)) * 1000
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: node scripts/verify-published.mjs [X.Y.Z]')
  process.exit(2)
}

const fail = msg => { console.error(`verify-published FAIL — ${msg}`); process.exit(1) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const git = args => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })

let meta
for (let i = 1; i <= attempts; i++) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/${version}`, { headers: { 'cache-control': 'no-cache' } })
    if (res.ok) { meta = await res.json(); break }
    if (res.status !== 404 && res.status < 500) fail(`레지스트리 응답 HTTP ${res.status}`)
  } catch (e) {
    if (i === attempts) fail(`레지스트리 조회 오류: ${e.message}`)
  }
  if (i < attempts) await sleep(interval)
}
if (!meta) fail(`${attempts}회 시도 후에도 레지스트리에서 ${pkg.name}@${version} 를 찾지 못함`)

let committed, source
if (ref) {
  try { committed = git(['show', `${ref}:dist/vue-zero.js`]); source = ref } catch { fail(`ref ${ref} 의 dist 를 읽지 못함`) }
} else try { committed = git(['show', `v${version}:dist/vue-zero.js`]); source = `v${version}` } catch {
  try { committed = git(['show', 'HEAD:dist/vue-zero.js']); source = 'HEAD(태그 없음)' } catch { fail('커밋된 dist 를 읽지 못함') }
}

const tmp = mkdtempSync(join(tmpdir(), 'vuezero-pub-'))
try {
  const tgzRes = await fetch(meta.dist.tarball)
  if (!tgzRes.ok) fail(`tarball 다운로드 실패 HTTP ${tgzRes.status}`)
  const tgz = Buffer.from(await tgzRes.arrayBuffer())
  const [algo, b64] = meta.dist.integrity.split('-')
  if (createHash(algo).update(tgz).digest('base64') !== b64) fail('tarball integrity 불일치')

  writeFileSync(join(tmp, 'pkg.tgz'), tgz)
  execFileSync('tar', ['-xzf', join(tmp, 'pkg.tgz'), '-C', tmp])
  const published = readFileSync(join(tmp, 'package/dist/vue-zero.js'))
  if (!published.equals(committed)) fail(`게시된 dist(${published.length}B) != ${source} 의 dist(${committed.length}B)`)
  console.log(`verify-published OK — ${pkg.name}@${version} 게시 확인, dist == ${source} (${published.length}B, sha256:${createHash('sha256').update(published).digest('hex').slice(0, 16)})`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
