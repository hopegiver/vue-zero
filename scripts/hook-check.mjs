// Claude Code Stop 훅: 라이브러리 소스/테스트가 마지막 통과 이후 바뀌었을 때만 `check` 를 한 번 실행한다.
//   - 바뀐 게 없으면 아무 것도 하지 않고(출력 0) 종료
//   - 통과하면 마커를 갱신하고 출력 0
//   - 테스트가 실패하면 압축 요약을 stderr 로 내고 exit 2 → Claude 가 이를 피드백으로 받아 수정을 이어간다
//   - 환경 문제(브라우저 없음 등으로 요약이 안 나옴)는 작업을 막지 않는다(exit 0, 출력 0)
// 끄기: VZ_NO_HOOK=1.  루프 방지: stop_hook_active 이면 곧바로 종료한다.
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (process.env.VZ_NO_HOOK) process.exit(0)

let input = ''
try { input = readFileSync(0, 'utf8') } catch { /* stdin 없음 */ }
try { if (JSON.parse(input || '{}').stop_hook_active) process.exit(0) } catch { /* JSON 아님 */ }

const WATCH = ['src', 'test', 'scripts', 'build.js', 'package.json']
const SKIP = new Set(['.results', 'node_modules', 'pages', 'components']) // test/apps/stress 의 생성물 등은 제외
const newest = p => {
  let st
  try { st = statSync(p) } catch { return 0 }
  if (!st.isDirectory()) return st.mtimeMs
  return readdirSync(p, { withFileTypes: true }).reduce((m, e) => {
    if (e.isDirectory() && (SKIP.has(e.name) && p.includes('stress'))) return m
    if (e.name === '.results' || e.name === 'node_modules') return m
    return Math.max(m, newest(join(p, e.name)))
  }, 0)
}
const stamp = Math.max(...WATCH.map(w => newest(join(root, w))))
const marker = join(root, 'test/.results/.last-green')
const last = existsSync(marker) ? Number(readFileSync(marker, 'utf8')) : 0
if (stamp <= last) process.exit(0)

const r = spawnSync('node', ['scripts/check.mjs'], { cwd: root, encoding: 'utf8', timeout: 170_000 })
const out = (r.stdout || '').trim()
if (r.status === 0 && out.startsWith('✔')) {
  mkdirSync(dirname(marker), { recursive: true })
  writeFileSync(marker, String(stamp))
  process.exit(0)
}
if (out.startsWith('✘') && /tests \d+ FAILED|build FAILED/.test(out)) {
  process.stderr.write(`[자동 검증 실패] 변경 후 pnpm check 가 실패했습니다. 수정 후 끝내세요 (끄기: VZ_NO_HOOK=1).\n${out}\n`)
  process.exit(2)
}
process.exit(0) // 환경 문제 등은 막지 않는다
