import { test, expect } from '@playwright/test'
import { trackAll, collectConsole, appMounted, spaPush } from '../helpers.js'

// 과거 버그 회귀. 근거는 `git log` 의 커밋 (테스트 이름의 버전 = 수정이 들어간 package.json 버전)

test('v1.2.0 회귀(91ef704): 최초 네비게이션이 실패해도 앱이 마운트되어 흰 화면이 아니다 — error.vue 있음', async ({ page }) => {
  // 직접 URL 진입(= 최초 네비게이션)에서 페이지 로드가 실패하는 경우. 과거엔 router.isReady() reject 로 mount() 가 호출되지 않았다.
  await page.goto('/syntax-error')
  await appMounted(page)
  await expect(page.getByTestId('error-page')).toBeVisible()
})

test('v1.2.0 회귀(91ef704): 최초 네비게이션 실패 + error.vue 없음 — 앱은 마운트되고 이후 이동 가능', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/error.vue', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto('/syntax-error')
  await appMounted(page)
  await expect.poll(() => c.errors.some((e) => e.includes('E_SCRIPT_EVAL') && e.includes('/pages/syntax-error.vue'))).toBe(true)
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/about'))
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('v1.1.0 회귀(7d98b01, 067df5f): 중첩 <template> 에서 첫 </template> 에 조기 종료하지 않는다', async ({ page }) => {
  await page.goto('/nested-template')
  await expect(page.getByTestId('nt-deep')).toHaveText('deep')
  await expect(page.getByTestId('after')).toHaveText('after-nested')
})

test('v1.1.2 회귀(74f7941): 404.vue 존재 확인은 HEAD 가 아니라 GET (서버는 HEAD 를 405 로 거부)', async ({ page }) => {
  const reqs = trackAll(page)
  await page.goto('/definitely-not-a-page')
  await expect(page.getByTestId('not-found')).toBeVisible() // HEAD 였다면 405 -> has404=false -> 이 페이지가 없다
  const to404 = reqs.filter((r) => r.url === '/pages/404.vue')
  expect(to404.length).toBeGreaterThan(0)
  expect(to404.every((r) => r.method === 'GET')).toBe(true)
  expect(reqs.filter((r) => r.method === 'HEAD')).toEqual([])
  // error.vue 존재 확인도 GET
  expect(reqs.filter((r) => r.url === '/pages/error.vue').every((r) => r.method === 'GET')).toBe(true)
})

// v1.4.0 (실패 후 같은 URL 로 이동): 이동 실패로 에러 화면이 떠 있는 상태에서 현재 URL 로 push 하면
// 라우터가 duplicated 로 처리해 beforeEach 가 돌지 않아 에러 화면이 그대로 남았다.
test('v1.4.0: 이동 실패 후 현재 URL 로 다시 이동하면 에러 화면이 걷히고 원래 페이지가 보인다', async ({ page }) => {
  await page.route('**/pages/slow-b.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await spaPush(page, '/slow-b')
  await expect(page.getByTestId('error-page')).toBeVisible()
  await expect(page).toHaveURL(/\/about$/)   // 실패한 이동이라 URL 은 그대로
  await spaPush(page, '/about')               // duplicated
  await expect(page.getByTestId('error-page')).toHaveCount(0)
  await expect(page.getByTestId('page')).toHaveText('About')
  // 페이지 스타일도 되돌아와 있어야 한다 (error 페이지 스타일만 활성인 채 남지 않는다)
  expect(await page.locator('style[data-vue-zero="page-error"]').evaluate((el) => el.disabled)).toBe(true)
})
