import { test, expect } from '@playwright/test'
import { collectConsole, appMounted, gate, computedColor, spaPush, settle } from '../helpers.js'

test('index: / -> index.vue, /about', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await page.locator('a[data-link="/about"]').click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('users/index -> /users, 링크로 [id] 와 [id]/posts 로 이동', async ({ page }) => {
  await page.goto('/users')
  await expect(page.getByTestId('page')).toHaveText('Users')
  await page.click('.u1')
  await expect(page.getByTestId('param')).toHaveText('1')
  await spaPush(page, '/users')
  await page.click('.u2posts')
  await expect(page.getByTestId('page')).toHaveText('Posts')
  await expect(page.getByTestId('param')).toHaveText('2')
})

test('동적 라우트 [id] 직접 진입 + query/hash 보존', async ({ page }) => {
  await page.goto('/users/42?tab=info#sec')
  await expect(page.getByTestId('param')).toHaveText('42')
  await expect(page.getByTestId('query')).toHaveText('info')
  await expect(page.getByTestId('hash')).toHaveText('#sec')
})

test('[id]/posts 직접 진입', async ({ page }) => {
  await page.goto('/users/abc-7/posts')
  await expect(page.getByTestId('page')).toHaveText('Posts')
  await expect(page.getByTestId('param')).toHaveText('abc-7')
})

test('query/hash 만 바뀌는 이동도 반영된다', async ({ page }) => {
  await page.goto('/search?q=first')
  await expect(page.getByTestId('q')).toHaveText('first')
  await page.click('.go')
  await expect(page.getByTestId('q')).toHaveText('next')
  await expect(page.getByTestId('hash')).toHaveText('#frag')
  await expect(page).toHaveURL(/\/search\?q=next#frag$/)
})

test('history 모드: 새로고침해도 같은 페이지, 뒤로/앞으로 가기', async ({ page }) => {
  await page.goto('/users/42')
  await expect(page.getByTestId('param')).toHaveText('42')
  await page.reload()
  await expect(page.getByTestId('param')).toHaveText('42')

  await page.locator('a[data-link="/about"]').click()
  await expect(page.getByTestId('page')).toHaveText('About')
  await page.goBack()
  await expect(page.getByTestId('param')).toHaveText('42')
  await page.goForward()
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('title: 페이지 title 이 document.title 이 된다', async ({ page }) => {
  await page.goto('/title-page')
  await expect(page).toHaveTitle('Custom Title')
  await page.locator('a[data-link="/about"]').click()
  await expect(page).toHaveTitle('About Title')
})

test('404.vue 있음: 알 수 없는 경로는 404 페이지 (레이아웃 유지)', async ({ page }) => {
  await page.goto('/no/such/page')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await page.locator('a[data-link="/"]').click()
  await expect(page.getByTestId('page')).toHaveText('Home')
})

test('404.vue 없음: 앱은 마운트되고 크래시 없이 빈 본문 (에러 페이지 아님)', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/404.vue', (r) => r.fulfill({ status: 404, body: 'nope' }))
  await page.goto('/no/such/page')
  await appMounted(page)
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('not-found')).toHaveCount(0)
  await expect(page.getByTestId('page')).toHaveCount(0)
  expect(c.pageErrors).toEqual([])
  // 이후 정상 페이지로 이동 가능
  await page.locator('a[data-link="/about"]').click()
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('error.vue: 페이지 fetch 실패(500) 시 error 페이지, 이후 다른 페이지로 정상 이동', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/slow-b.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await page.locator('a[data-link="/slow-b"]').click()
  await expect(page.getByTestId('error-page')).toBeVisible()
  expect(c.errors.some((e) => e.includes('E_PAGE_FETCH') && e.includes('/pages/slow-b.vue') && e.includes('500'))).toBe(true)
  // v1.3.1: 비활성 상태로 주입되는 페이지 스타일도 error 페이지에서는 활성화되어야 한다
  expect(await computedColor(page.getByTestId('error-page'))).toBe('rgb(200, 0, 100)')

  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await expect(page.getByTestId('error-page')).toHaveCount(0)
})

test('error.vue: 페이지 script 문법 오류도 error 페이지로', async ({ page }) => {
  await page.goto('/')
  await spaPush(page, '/syntax-error')
  await expect(page.getByTestId('error-page')).toBeVisible()
})

test('pages.json 에 ".vue" 확장자를 넣으면 명확한 에러 메시지 (라우팅은 계속 동작)', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/pages.json', (r) => r.fulfill({ json: ['index', 'about.vue'] }))
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  const msg = c.errors.find((e) => e.includes('should not include ".vue"'))
  expect(msg).toBeTruthy()
  expect(msg).toContain('about.vue')
  expect(msg).toContain('Use "about"')
})

test('pages.json 없음: 경고, 앱은 마운트됨 (404.vue 로 폴백)', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/pages.json', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto('/about')
  await appMounted(page)
  await expect(page.getByTestId('not-found')).toBeVisible()
  expect(c.warns.some((w) => w.includes('pages.json not found'))).toBe(true)
  expect(c.warns.some((w) => w.includes('No pages found'))).toBe(true)
})

test('빠른 연속 이동: 먼저 시작한 느린 이동이 나중 이동을 덮어쓰지 않는다 (레이아웃/스타일/title)', async ({ page }) => {
  // v1.3.1 회귀: beforeEach 가 취소된 이전 이동(A)의 지연 완료 후에도 currentLayout/switchPage/document.title 을 덮어썼고,
  // 늦게 도착한 A 의 페이지 스타일이 활성 상태로 주입되어 현재 페이지(B)에 적용되었다.
  // slow-a: layout alt + title + 스타일 / slow-b: default 레이아웃. A 가 늦게 도착해도 최종 상태는 B 여야 한다.
  await page.goto('/layout-alt') // alt 레이아웃을 미리 캐시 -> A 의 지연된 guard 는 네트워크 없이 빠르게 끝난다
  await spaPush(page, '/')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  const g = await gate(page, '**/pages/slow-a.vue')
  await page.locator('a[data-link="/slow-a"]').click()
  await g.reached
  await page.locator('a[data-link="/slow-b"]').click()
  await expect(page.getByTestId('page')).toHaveText('Slow B')
  g.release()
  // A 의 SFC 로드 완료(스타일 주입) 를 신호로 삼고, 그 뒤 guard 의 후속 부수효과(마이크로태스크)가 반영될 프레임을 흘려보낸다
  await expect(page.locator('style[data-vue-zero="page-slow-a"]')).toHaveCount(1)
  await settle(page, 10)
  await expect(page).toHaveURL(/\/slow-b$/)
  expect.soft(await page.getByTestId('layout-alt').count(), '레이아웃: alt 가 남지 않아야 함').toBe(0)
  expect.soft(await page.getByTestId('layout-default').count(), '레이아웃: default 여야 함').toBe(1)
  expect.soft(await page.title(), 'document.title').toBe('Slow B Title')
  expect.soft(await computedColor(page.getByTestId('page')), 'B 페이지 스타일 유지').toBe('rgb(0, 0, 255)')
})

test('빠른 연속 클릭: A -> B -> A 최종 URL/내용 일치, 에러 없음', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/')
  await page.locator('a[data-link="/about"]').click()
  await page.locator('a[data-link="/users"]').click()
  await page.locator('a[data-link="/"]').click()
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page).toHaveURL(/\/$/)
  expect(c.pageErrors).toEqual([])
})

