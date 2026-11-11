import { defineConfig, devices } from '@playwright/test'

// 앱별 정적 서버(포트 고정) + 앱별 Playwright project. 앱은 서로 독립이므로 병렬 실행된다.
// 라이브러리 파일 교체: VUEZERO_DIST=<경로> (기본 ../dist/vue-zero.js)
const allApps = { basic: 4101, auth: 4102, 'custom-dirs': 4103, stress: 4104 }
// VZ_APPS=basic,auth 처럼 일부 앱만 띄우고 실행할 수 있다 (기본: 전체)
const only = (process.env.VZ_APPS || '').split(',').filter(Boolean)
const apps = Object.fromEntries(Object.entries(allApps).filter(([n]) => !only.length || only.includes(n)))

export default defineConfig({
  testDir: './e2e',
  outputDir: './.results',
  fullyParallel: true,
  workers: process.env.CI ? 3 : 4,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 20_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { ...devices['Desktop Chrome'], browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    ...Object.entries(apps).map(([name, port]) => ({
      name,
      testDir: `./e2e/${name}`,
      use: { baseURL: `http://127.0.0.1:${port}` },
    })),
    // 브라우저·서버가 필요 없는 Node 테스트(매니페스트 생성기 골든) — 항상 포함
    { name: 'manifest', testDir: './e2e/manifest' },
  ],
  webServer: Object.entries(apps).map(([name, port]) => ({
    command: `${name === 'stress' ? 'node test/scripts/gen-stress.mjs && ' : ''}node test/server.mjs ${name} ${port}`,
    cwd: new URL('..', import.meta.url).pathname,
    url: `http://127.0.0.1:${port}/lib/vue.js`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { ...process.env },
  })),
})
