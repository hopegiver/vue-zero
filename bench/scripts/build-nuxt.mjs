// 생성된 Nuxt 소스를 bench/nuxt-app/app 에 복사 → nuxt generate → 산출물을 bench/build/nuxt-<size> 로 복사.
// 사용: node bench/scripts/build-nuxt.mjs [S|M|L ...]  — 소요 시간(ms)을 results/build-times.json 에 병합 저장
import { spawnSync } from 'node:child_process'
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nuxtApp = resolve(bench, 'nuxt-app')
const sizes = process.argv.slice(2).filter((s) => /^(S|M|L|X\d+)$/.test(s))
const outFile = resolve(bench, 'results/build-times.json')
const times = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {}

for (const size of sizes.length ? sizes : ['S', 'M', 'L']) {
  const src = resolve(bench, 'apps', size, 'nuxt')
  if (!existsSync(src)) throw new Error(`먼저 node bench/gen/gen-apps.mjs ${size}`)
  rmSync(resolve(nuxtApp, 'app'), { recursive: true, force: true })
  rmSync(resolve(nuxtApp, '.output'), { recursive: true, force: true })
  cpSync(src, resolve(nuxtApp, 'app'), { recursive: true })
  const t0 = Date.now()
  const r = spawnSync('pnpm', ['exec', 'nuxt', 'generate'], { cwd: nuxtApp, encoding: 'utf8', env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1', CI: '1' } })
  const ms = Date.now() - t0
  if (r.status !== 0) { console.error(r.stdout.slice(-3000), r.stderr.slice(-3000)); process.exit(1) }
  const dest = resolve(bench, 'build', `nuxt-${size}`)
  rmSync(dest, { recursive: true, force: true }); mkdirSync(dirname(dest), { recursive: true })
  cpSync(resolve(nuxtApp, '.output/public'), dest, { recursive: true })
  times[size] = { ...(times[size] || {}), nuxtGenerateMs: ms, loadavg: (await import('node:os')).loadavg()[0] }
  console.log(`[build-nuxt] ${size} generate ${ms}ms -> ${dest}`)
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(times, null, 1))
