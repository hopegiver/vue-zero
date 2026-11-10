// CHANGELOG.md에서 특정 버전 항목 본문을 추출한다. 의존성 없음.
// 사용: node scripts/changelog.mjs <X.Y.Z>   → 본문을 stdout으로 출력 (없거나 비어 있으면 exit 1)
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function extractNotes(version, file = resolve(root, 'CHANGELOG.md')) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const esc = version.replace(/[.+]/g, '\\$&')
  const head = new RegExp(`^##\\s+\\[?${esc}\\]?(\\s|$)`)
  const start = lines.findIndex(l => head.test(l))
  if (start === -1) return null
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  if (end === -1) end = lines.length
  const body = lines.slice(start + 1, end).join('\n').trim()
  return body || null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]
  if (!version) {
    console.error('usage: node scripts/changelog.mjs <X.Y.Z>')
    process.exit(2)
  }
  const notes = extractNotes(version)
  if (!notes) {
    console.error(`CHANGELOG.md에 ${version} 항목(비어 있지 않은 본문)이 없습니다`)
    process.exit(1)
  }
  process.stdout.write(notes + '\n')
}
