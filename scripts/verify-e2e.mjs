// 실제 산출물(npm pack tarball) 기준 E2E 게이트 (CI verify-e2e 잡 + 로컬 release:check 공용). 의존성 없음.
// tarball을 풀어 그 안의 dist/vue-zero.js를 VUEZERO_DIST로 넘겨 E2E 스위트를 실행한다.
// 사용: node scripts/verify-e2e.mjs      (E2E 명령 기본 "pnpm test", VERIFY_E2E_CMD로 교체 가능)
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = mkdtempSync(join(tmpdir(), 'vuezero-e2e-'))
const packDir = join(work, 'pack')
const unpackDir = join(work, 'unpacked')

try {
  execFileSync('mkdir', ['-p', packDir, unpackDir])
  const out = execFileSync('npm', ['pack', '--pack-destination', packDir, '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  const tarball = join(packDir, JSON.parse(out)[0].filename)
  execFileSync('tar', ['-xzf', tarball, '-C', unpackDir])
  const dist = join(unpackDir, 'package/dist/vue-zero.js')
  if (!existsSync(dist) || statSync(dist).size === 0) throw new Error(`tarball에 dist/vue-zero.js가 없거나 비어 있음: ${tarball}`)

  console.log(`verify-e2e: VUEZERO_DIST=${dist} (${statSync(dist).size}B, from ${tarball})`)
  const cmd = process.env.VERIFY_E2E_CMD || 'pnpm test'
  const r = spawnSync(cmd, { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, VUEZERO_DIST: dist } })
  if (r.status !== 0) throw new Error(`E2E 실패 (exit ${r.status}): ${cmd}`)
  console.log('verify-e2e 통과')
} catch (e) {
  console.error(`verify-e2e 실패 — ${e.message}`)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
