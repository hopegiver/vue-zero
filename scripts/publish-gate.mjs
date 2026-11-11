// npm prepublishOnly 게이트: push 완료 + 정적 검증 + E2E 를 통과해야 publish 가 진행된다. 의존성 없음.
// 탈출구: VZ_SKIP_GATE=1 (큰 경고 후 통과 — 긴급 상황 전용, 사유를 CHANGELOG 에 남길 것)
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.VZ_SKIP_GATE === '1') {
  const bar = '!'.repeat(72)
  console.warn(`\n${bar}\n!! VZ_SKIP_GATE=1 — 릴리스 게이트(push 확인·정적 검증·E2E)를 건너뛰고 publish 합니다.\n!! 검증되지 않은 산출물이 게시될 수 있습니다. 사유를 CHANGELOG.md 에 남기세요.\n${bar}\n`)
  process.exit(0)
}

for (const script of ['verify-static.mjs --require-pushed', 'verify-e2e.mjs']) {
  const r = spawnSync(`node scripts/${script}`, { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, VZ_NO_TEMPLATE_COPY: '1' } })
  if (r.status !== 0) {
    console.error(`\n[vue-zero-ai] publish 차단: ${script} 실패. 해결 후 다시 시도하세요 (긴급 시에만 VZ_SKIP_GATE=1).`)
    process.exit(1)
  }
}
