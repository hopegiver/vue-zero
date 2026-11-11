// 개발 중 "한 번에 검증" 명령. 성공하면 한 줄, 실패하면 실패 지점만 출력한다 (토큰 절약).
//   pnpm check                 # 소스가 dist 보다 새로우면 빌드 → E2E 전체
//   pnpm check -- -g "라우팅"   # 이후 인자는 playwright 로 전달(일부 테스트만)
//   VUEZERO_DIST=<경로> pnpm check   # 다른 dist 검증(빌드 생략)
// 빌드 출력은 실패할 때만 보여 준다. 전체 상세는 test/.results/last.json.
import { spawnSync } from 'node:child_process'
import { statSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const passArgs = process.argv.slice(2).filter(a => a !== '--')

const newest = dir => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => {
  const p = join(dir, e.name)
  return Math.max(m, e.isDirectory() ? newest(p) : statSync(p).mtimeMs)
}, 0)

const t0 = Date.now()
let built = 'dist 최신'
if (!process.env.VUEZERO_DIST) {
  const stale = newest(join(root, 'src')) > statSync(join(root, 'dist/vue-zero.js')).mtimeMs
  if (stale) {
    const b = spawnSync('node', ['build.js'], { cwd: root, encoding: 'utf8' })
    if (b.status !== 0) {
      console.log('✘ build FAILED')
      console.log((b.stdout + b.stderr).trim().split('\n').slice(0, 15).join('\n'))
      process.exit(1)
    }
    built = `build ${((Date.now() - t0) / 1000).toFixed(1)}s`
  }
}

const r = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'test/playwright.config.js', '--reporter=./test/reporters/terse.mjs', ...passArgs], { cwd: root, encoding: 'utf8' })
const out = (r.stdout || '').trim()
// webServer/설정 오류처럼 리포터가 요약을 못 낸 경우만 stderr 앞부분을 보여 준다
if (!out) console.log(`✘ playwright 실행 실패(exit ${r.status})\n${(r.stderr || '').trim().split('\n').slice(0, 12).join('\n')}`)
else console.log(`${out.split('\n')[0].replace(/^(✔|✘) tests/, `$1 ${built} · tests`)}${out.includes('\n') ? '\n' + out.split('\n').slice(1).join('\n') : ''}`)
process.exit(r.status ?? 1)
