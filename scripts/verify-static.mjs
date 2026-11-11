// 릴리스 정적 검증 게이트 (CI verify-static 잡 + 로컬 release:check 공용). 의존성 없음.
// 사용: node scripts/verify-static.mjs [--tag vX.Y.Z] [--require-pushed] [--allow-published]
//   --tag             생략 시 RELEASE_TAG, GITHUB_REF_NAME, 마지막으로 v<package.json 버전>
//   --require-pushed  git fetch origin --tags 후 HEAD 가 origin/<기본브랜치>에 없거나, v<package.json 버전> 태그가 없거나 태그 커밋 != HEAD 면 FAIL (prepublishOnly: commit·push·태그가 publish 보다 먼저)
//   --allow-published npm 에 이미 게시된 버전이어도 FAIL 하지 않고 게시 여부만 표기 (태그→GitHub Release 파이프라인용)
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

const requirePushed = process.argv.includes('--require-pushed')
const allowPublished = process.argv.includes('--allow-published')

const inCI = process.env.GITHUB_ACTIONS === 'true'

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

// 태그 커밋이 기본 브랜치에 포함돼 있어야 한다 (임의 브랜치/고아 커밋에 찍은 태그 차단). CI 에서만 강제, 로컬은 푸시 전이라 경고만.
check('태그 커밋이 origin 기본 브랜치에 포함', () => {
  if (requirePushed && !inCI) {
    try { run('git', ['fetch', 'origin', '--tags']) } catch (e) { throw new Error(`git fetch origin 실패: ${String(e.stderr || e.message).split('\n')[0]}`) }
  }
  let branch = process.env.RELEASE_BRANCH
  if (!branch) {
    try { branch = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).toString().trim().replace(/^origin\//, '') } catch {}
  }
  if (!branch) {
    if (inCI || requirePushed) throw new Error('기본 브랜치명을 알 수 없음 (RELEASE_BRANCH 미설정, origin/HEAD 없음)')
    return '건너뜀(로컬, 원격 브랜치 정보 없음)'
  }
  try { run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]) } catch {
    if (inCI || requirePushed) throw new Error(`origin/${branch} 를 찾을 수 없음 (checkout fetch-depth: 0 필요)`)
    return `건너뜀(로컬, origin/${branch} 없음)`
  }
  try { run('git', ['merge-base', '--is-ancestor', 'HEAD', `origin/${branch}`]) } catch {
    if (inCI || requirePushed) throw new Error(`${requirePushed && !inCI ? 'HEAD' : '태그 커밋'} ${run('git', ['rev-parse', '--short', 'HEAD']).toString().trim()} 가 origin/${branch} 에 포함되지 않음 — ${branch} 에 push 한 뒤 진행하세요 (commit·push 가 태그/publish 보다 먼저)`)
    return `경고(로컬): HEAD 가 origin/${branch} 에 아직 없음 — 푸시 후 태그하세요 (CI 에서는 실패 처리)`
  }
  return `origin/${branch} 포함`
})

// 로컬 publish 전용: 게시되는 커밋 == 그 버전의 Release 태그 커밋. (태그 → Release 가 먼저, npm 은 나중. 버전을 안 올렸거나 태그 이후 커밋이 쌓인 HEAD 의 게시를 막는다)
if (requirePushed && !inCI) {
  check('v<버전> 태그 존재 및 태그 커밋 == HEAD', () => {
    const t = `v${pkg.version}`
    let head, tagged
    try { head = run('git', ['rev-parse', 'HEAD^{commit}']).toString().trim() } catch (e) { throw new Error(`HEAD 를 읽지 못함: ${String(e.stderr || e.message).split('\n')[0]}`) }
    try { tagged = run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${t}^{commit}`]).toString().trim() } catch {
      throw new Error(`태그 ${t} 가 없음 — package.json 버전을 올리지 않았거나 태그 전입니다. 해결: 버전 커밋을 push 하고 \`git tag ${t} && git push origin ${t}\` 로 Release 를 먼저 만든 뒤 그 커밋에서 publish`)
    }
    if (tagged !== head) throw new Error(`태그 ${t}(${tagged.slice(0, 7)}) != HEAD(${head.slice(0, 7)}) — 해결: \`git checkout ${t}\` 후 publish 하거나, 새 버전을 올려 새 태그를 만드세요`)
    return `${t} == HEAD ${head.slice(0, 7)}`
  })
}

// 기본: 이미 게시된 버전이면 실패. --allow-published: 게시 여부만 표기. 네트워크 불가 시: CI·--require-pushed 는 실패, 로컬은 경고 후 통과.
check(allowPublished ? 'npm 게시 여부(정보)' : 'npm에 미게시 버전', () => {
  let out
  try {
    out = run('npm', ['view', `${pkg.name}@${pkg.version}`, 'version', '--json', '--ignore-scripts']).toString().trim()
  } catch (e) {
    const err = `${e.stderr || ''}${e.stdout || ''}`
    if (/E404|404 Not Found|is not in this registry/.test(err)) return `${pkg.name}@${pkg.version} 미게시`
    if (allowPublished) return `조회 실패로 게시 여부 불명 (${(err.split('\n')[0] || e.message).slice(0, 80)})`
    if (inCI || requirePushed) throw new Error(`npm 레지스트리 조회 실패: ${err.split('\n')[0] || e.message}`)
    return `경고(로컬): 레지스트리 조회 실패로 건너뜀 (${(err.split('\n')[0] || e.message).slice(0, 80)})`
  }
  if (out && allowPublished) return `${pkg.name}@${pkg.version} 이미 게시됨`
  if (out) throw new Error(`${pkg.name}@${pkg.version} 는 이미 npm에 게시된 버전입니다 — package.json 버전을 올리세요`)
  return `${pkg.name}@${pkg.version} 미게시`
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
