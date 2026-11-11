import { test, expect } from '@playwright/test'
import { useOptions, trackAll, vzErrors, collectConsole } from '../helpers.js'

// v1.4.0: loginPage 가 보호 상태(auth:false 누락)면 리다이렉트가 끝없이 반복되어 탭이 멈췄다(prod 라우터는 중단 장치가 없다).
// 이제 E_LOGIN_PAGE_PROTECTED 로 보고하고 그 페이지를 공개 취급해 끊는다.
// 주의: 수정 전 dist 에서는 메인 스레드가 멈추므로 모든 대기에 짧은 타임아웃을 둔다.

test('loginPage 가 보호 페이지(auth:false 누락): E_LOGIN_PAGE_PROTECTED 보고 + 그 페이지가 렌더된다 (루프 없음)', async ({ page }) => {
  const c = collectConsole(page)
  await useOptions(page, { auth: { enabled: true, loginPage: '/dashboard' } })
  await page.goto('/', { waitUntil: 'commit', timeout: 5000 })
  await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)', { timeout: 5000 })
  const entry = (await vzErrors(page)).find((e) => e.code === 'E_LOGIN_PAGE_PROTECTED')
  expect(entry).toMatchObject({ stage: 'auth', file: '/pages/dashboard.vue', level: 'error' })
  expect(entry.hint).toContain('auth: false')
  expect(entry.hint).toContain('/pages/dashboard.vue')
  expect(c.errors.filter((e) => e.includes('E_LOGIN_PAGE_PROTECTED'))).toHaveLength(1)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('loginPage 에 해당하는 페이지가 없고 404 가 보호 상태: E_LOGIN_PAGE_MISSING 으로 끊는다', async ({ page }) => {
  await useOptions(page, { auth: { enabled: true, loginPage: '/nowhere' } })
  await page.route('**/pages/404.vue', (r) => r.fulfill({ contentType: 'text/plain', body: '<template><h1 data-testid="not-found">nf</h1></template>\n<script>\nexport default {}\n</script>\n' }))
  await page.goto('/anything', { waitUntil: 'commit', timeout: 5000 })
  await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 5000 })
  const entry = (await vzErrors(page)).find((e) => e.code === 'E_LOGIN_PAGE_MISSING')
  expect(entry).toMatchObject({ stage: 'auth' })
})

test('정상 구성(loginPage 가 auth:false)에서는 보고가 없다', async ({ page }) => {
  await useOptions(page, { auth: { enabled: true } })
  await page.goto('/dashboard')
  await expect(page.getByTestId('login-form')).toBeVisible()
  expect((await vzErrors(page)).filter((e) => e.stage === 'auth')).toEqual([])
})

// v1.4.0: 인증 검사를 SFC 파싱 직후로 당겼다 — 미인증이면 그 페이지의 컴포넌트·레이아웃은 받지 않는다.
test('미인증으로 보호 페이지 진입: 리다이렉트 전에 컴포넌트·레이아웃을 받지 않는다', async ({ page }) => {
  await useOptions(page, { auth: { enabled: true, loginPage: '/bare-login' } })
  const reqs = trackAll(page)
  await page.goto('/vault')
  await expect(page.getByTestId('page')).toHaveText('bare-login')
  await expect(page).toHaveURL(/\/bare-login$/)
  const urls = reqs.map((r) => r.url)
  expect(urls).toContain('/pages/vault.vue')          // 인증 여부는 SFC 의 auth 옵션을 읽어야 알 수 있다
  expect(urls).not.toContain('/components/Secret.vue')
  expect(urls).not.toContain('/layouts/default.vue')
})

test('인증된 상태에서는 보호 페이지의 컴포넌트·레이아웃을 정상적으로 받는다', async ({ page, request }) => {
  await useOptions(page, { auth: { enabled: true, loginPage: '/bare-login' } })
  const { token } = await (await request.get('/api/token?kind=valid')).json()
  await page.addInitScript((t) => localStorage.setItem('token', t), token)
  await page.goto('/vault')
  await expect(page.getByTestId('secret')).toBeVisible()
  await expect(page.getByTestId('layout')).toBeVisible()
})
