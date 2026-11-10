// 게시 후 검증 (CI post-publish 잡). 의존성 없음, Node 18+ (fetch).
// 레지스트리에 새 버전이 보이고, 게시된 tarball의 dist/vue-zero.js가 커밋된 dist와 바이트 동일한지 확인한다.
// 사용: node scripts/verify-published.mjs <X.Y.Z> [--attempts 18] [--interval 10]
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def)
const version = process.argv[2]
const attempts = Number(arg('--attempts', 18))
const interval = Number(arg('--interval', 10)) * 1000
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('usage: node scripts/verify-published.mjs <X.Y.Z>')
  process.exit(2)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const url = `https://registry.npmjs.org/${pkg.name}/${version}`

let meta
for (let i = 1; i <= attempts; i++) {
  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
    if (res.ok) { meta = await res.json(); break }
    console.log(`[${i}/${attempts}] ${pkg.name}@${version} 아직 미노출 (HTTP ${res.status})`)
  } catch (e) {
    console.log(`[${i}/${attempts}] 레지스트리 조회 오류: ${e.message}`)
  }
  if (i < attempts) await sleep(interval)
}
if (!meta) {
  console.error(`FAIL  ${attempts}회 시도 후에도 레지스트리에서 ${pkg.name}@${version}를 찾지 못함`)
  process.exit(1)
}
console.log(`PASS  레지스트리에 ${pkg.name}@${meta.version} 노출`)

const tmp = mkdtempSync(join(tmpdir(), 'vuezero-pub-'))
let failed = 0
try {
  const tgzRes = await fetch(meta.dist.tarball)
  if (!tgzRes.ok) throw new Error(`tarball 다운로드 실패 HTTP ${tgzRes.status}`)
  const tgz = Buffer.from(await tgzRes.arrayBuffer())

  const [algo, b64] = meta.dist.integrity.split('-')
  const actual = createHash(algo).update(tgz).digest('base64')
  if (actual === b64) console.log(`PASS  tarball integrity 일치 (${algo})`)
  else { failed++; console.log(`FAIL  tarball integrity 불일치 (registry=${b64.slice(0, 12)}… actual=${actual.slice(0, 12)}…)`) }

  writeFileSync(join(tmp, 'pkg.tgz'), tgz)
  execFileSync('tar', ['-xzf', join(tmp, 'pkg.tgz'), '-C', tmp])
  const published = readFileSync(join(tmp, 'package/dist/vue-zero.js'))
  const local = readFileSync(resolve(root, 'dist/vue-zero.js'))
  if (published.equals(local)) console.log(`PASS  게시된 dist/vue-zero.js == 태그 커밋의 dist (${published.length}B, sha256:${createHash('sha256').update(published).digest('hex').slice(0, 16)})`)
  else { failed++; console.log('FAIL  게시된 dist/vue-zero.js가 태그 커밋의 dist와 다름') }
} catch (e) {
  failed++
  console.log(`FAIL  ${e.message}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// provenance attestation은 전파가 늦을 수 있어 경고로만 보고한다
if (meta.dist.attestations?.provenance) console.log(`PASS  provenance attestation 확인 (${meta.dist.attestations.provenance.predicateType})`)
else console.log('WARN  provenance attestation이 아직 보이지 않음(전파 지연일 수 있음) — 게시 후 npm 패키지 페이지에서 확인')

process.exit(failed ? 1 : 0)
