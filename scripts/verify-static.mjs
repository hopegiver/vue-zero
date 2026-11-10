// 릴리스 정적 검증 게이트 (CI verify-static 잡 + 로컬 release:check 공용). 의존성 없음.
// 사용: node scripts/verify-static.mjs [--tag vX.Y.Z]   (생략 시 RELEASE_TAG, GITHUB_REF_NAME, 마지막으로 v<package.json 버전>)
// 모든 검사를 실행한 뒤 실패가 하나라도 있으면 exit 1.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractNotes } from './changelog.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const EXPECTED_PACK = ['LICENSE', 'README.md', 'dist/vue-zero.js', 'package.json']

const argTag = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : undefined
const tag = argTag || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${pkg.version}`

const sha = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16)
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] })

let failed = 0
function check(name, fn) {
  try {
    const detail = fn()
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (e) {
    failed++
    console.log(`FAIL  ${name} — ${e.message.split('\n')[0]}`)
  }
}

console.log(`verify-static: package=${pkg.name}@${pkg.version} tag=${tag}`)

check('태그 형식 vX.Y.Z', () => {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`"${tag}"는 vX.Y.Z 형식이 아님 (프리릴리스 태그는 게이트 비대상)`)
})

check('태그 버전 == package.json 버전', () => {
  if (tag !== `v${pkg.version}`) throw new Error(`태그 ${tag} != package.json ${pkg.version}`)
})

check('CHANGELOG에 해당 버전 항목 존재', () => {
  const notes = extractNotes(pkg.version)
  if (!notes) throw new Error(`CHANGELOG.md에 [${pkg.version}] 항목이 없거나 비어 있음`)
  return `${notes.split('\n').length}줄`
})

// 빌드 전에 커밋된 dist를 읽어 둔다(빌드가 working tree의 dist를 덮어쓰므로)
let committed = null
check('작업 트리 클린(소스·dist·메타 파일)', () => {
  const out = run('git', ['status', '--porcelain', '--', 'src', 'dist', 'build.js', 'package.json', 'pnpm-lock.yaml', 'CHANGELOG.md', 'README.md', 'LICENSE']).toString().trim()
  if (out) throw new Error(`커밋되지 않은 변경:\n${out}`)
  committed = run('git', ['show', 'HEAD:dist/vue-zero.js'])
})

check('빌드 성공', () => {
  run('node', ['build.js'])
})

check('dist는 vue-zero.js 단일 파일(.d.ts/.map 없음)', () => {
  const files = readdirSync(resolve(root, 'dist'))
  if (files.length !== 1 || files[0] !== 'vue-zero.js') throw new Error(`dist 내용: ${files.join(', ')}`)
})

check('커밋된 dist == 새로 빌드한 결과', () => {
  if (!committed) throw new Error('커밋된 dist를 읽지 못함(이전 검사 실패)')
  const built = readFileSync(resolve(root, 'dist/vue-zero.js'))
  if (!built.equals(committed)) throw new Error(`불일치 committed=${sha(committed)} built=${sha(built)} — pnpm run build 후 dist를 커밋하세요`)
  return `sha256:${sha(built)} ${built.length}B`
})

check(`npm pack 파일 목록 == ${EXPECTED_PACK.join(', ')}`, () => {
  const json = JSON.parse(run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts']).toString())
  const files = json[0].files.map(f => f.path).sort()
  const expected = [...EXPECTED_PACK].sort()
  if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`실제: ${files.join(', ')}`)
  return `${json[0].size}B tarball`
})

console.log(failed ? `\nverify-static 실패 (${failed}건)` : '\nverify-static 통과')
process.exit(failed ? 1 : 0)
