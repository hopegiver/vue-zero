import { test, expect } from '@playwright/test'
import { useOptions, seedStorage, fetchToken, trackAll, settle, barrier, vueReqs, vzErrors } from '../helpers.js'

// v1.5.0: 병렬 선행 로드는 인증 순서를 깨지 않는다 — 미인증 사용자에게는 인증 판단(SFC 의 auth 옵션 해석) 전에
// 레이아웃·컴포넌트를 요청하지 않는다. 인증된 사용자/인증 꺼짐에서만 SFC 와 동시에 시작한다.

const auth = { auth: { enabled: true } }

test('v1.5.0 미인증 + 보호 페이지: 레이아웃·컴포넌트 deps 를 요청하지 않고 로그인으로 보낸다', async ({ page }) => {
  await useOptions(page, { manifest: true, ...auth })
  const reqs = trackAll(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('page')).toHaveText('Login')
  const v = vueReqs(reqs)
  expect(v).toContain('/pages/admin.vue')            // auth 옵션을 읽으려면 SFC 가 필요하다
  expect(v).not.toContain('/layouts/admin.vue')
  expect(v).not.toContain('/components/AdminBar.vue')
  expect((await vzErrors(page)).filter((e) => e.stage === 'auth')).toEqual([])
})

test('v1.5.0 미인증: 보호 페이지 SFC 응답을 붙잡은 동안에도 deps 요청이 나가지 않는다 (인증 판단 전)', async ({ page }) => {
  await useOptions(page, { manifest: true, ...auth })
  const reqs = trackAll(page)
  let release
  const held = new Promise((r) => { release = r })
  await page.route('**/pages/admin.vue', async (route) => { await held; await route.fallback() })
  await page.goto('/admin', { waitUntil: 'commit' })
  await expect.poll(() => reqs.some((r) => r.url === '/pages/admin.vue')).toBe(true)
  await expect.poll(() => reqs.some((r) => r.url === '/vz-manifest.json')).toBe(true)
  await settle(page, 15)
  expect(vueReqs(reqs)).toEqual(['/pages/admin.vue'])
  release()
  await expect(page).toHaveURL(/\/login$/)
})

test('v1.5.0 미인증 + 공개 페이지(auth:false): SFC 가 도착해 공개로 확인된 뒤에 deps 를 시작한다', async ({ page }) => {
  await useOptions(page, { manifest: true, ...auth })
  const reqs = trackAll(page)
  let release
  const held = new Promise((r) => { release = r })
  await page.route('**/pages/about.vue', async (route) => { await held; await route.fallback() })
  await page.goto('/about', { waitUntil: 'commit' })
  await expect.poll(() => reqs.some((r) => r.url === '/pages/about.vue')).toBe(true)
  await settle(page, 15)
  expect(vueReqs(reqs)).toEqual(['/pages/about.vue'])  // 응답 전에는 레이아웃·컴포넌트 없음
  release()
  await expect(page.getByTestId('page')).toHaveText('About')
  await expect(page.getByTestId('app-nav')).toBeVisible()
  expect(vueReqs(reqs).sort()).toEqual(['/components/AppNav.vue', '/components/Badge.vue', '/layouts/default.vue', '/pages/about.vue'])
})

test('v1.5.0 인증됨: 보호 페이지의 SFC·레이아웃·컴포넌트를 동시에 요청한다 (장벽)', async ({ page, request }) => {
  await seedStorage(page, { token: await fetchToken(request, 'valid') })
  await useOptions(page, { manifest: true, ...auth })
  const globs = ['**/pages/admin.vue', '**/layouts/admin.vue', '**/components/AdminBar.vue']
  const b = await barrier(page, globs)
  await page.goto('/admin', { waitUntil: 'commit' })
  await b.opened
  await expect(page.getByTestId('page')).toHaveText('Admin (protected)')
  await expect(page.getByTestId('admin-bar')).toBeVisible()
})

test('v1.5.0 만료된 토큰은 미인증과 같다: deps 선행 없음', async ({ page, request }) => {
  await seedStorage(page, { token: await fetchToken(request, 'expired') })
  await useOptions(page, { manifest: true, ...auth })
  const reqs = trackAll(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
  expect(vueReqs(reqs)).not.toContain('/layouts/admin.vue')
  expect(vueReqs(reqs)).not.toContain('/components/AdminBar.vue')
})
