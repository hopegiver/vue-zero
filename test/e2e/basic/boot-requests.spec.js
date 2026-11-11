import { test, expect } from '@playwright/test'
import { trackAll, appMounted, spaPush, vzErrors, settle } from '../helpers.js'

// v1.5.0: 404.vue / error.vue 를 부팅 시 존재 확인(fetch)하지 않는다 — 처음 필요할 때만 받는다.
// 부팅 요청 수가 v1.4.0 보다 정확히 2건 줄어든다(옵트인과 무관하게 모두에게).

// blob: 모듈 URL(.vue 스크립트 평가)과 favicon 은 제외
const urls = (reqs) => reqs.map((r) => r.url).filter((u) => u !== '/favicon.ico' && !u.startsWith('http'))
const hits = (reqs, path) => reqs.filter((r) => r.url === path).length

test('v1.5.0: 첫 방문 요청 목록 — 404.vue/error.vue 존재 확인 2건이 없다', async ({ page }) => {
  const reqs = trackAll(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await settle(page)
  // v1.4.0 은 이 목록 + /pages/404.vue + /pages/error.vue (총 8건)
  expect(urls(reqs).sort()).toEqual([
    '/',
    '/components/components.json',
    '/layouts/default.vue',
    '/lib/vue-router.js',
    '/lib/vue-zero.js',
    '/lib/vue.js',
    '/pages/index.vue',
    '/pages/pages.json',
  ])
  expect(hits(reqs, '/pages/404.vue') + hits(reqs, '/pages/error.vue')).toBe(0)
})

test('v1.5.0: 알 수 없는 경로 — 404.vue 는 그때 처음, 1회만 받고(캐시) 화면은 v1.4.0 과 같다', async ({ page }) => {
  const reqs = trackAll(page)
  await page.goto('/no/such/page')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toBeVisible()
  expect(hits(reqs, '/pages/404.vue')).toBe(1)
  expect(hits(reqs, '/pages/error.vue')).toBe(0)
  await spaPush(page, '/another/missing')
  await expect(page).toHaveURL(/another\/missing$/)
  await settle(page)
  await expect(page.getByTestId('not-found')).toBeVisible()
  expect(hits(reqs, '/pages/404.vue')).toBe(1)
})

test('v1.5.0: 404.vue 없음 — 알 수 없는 경로를 두 번 방문해도 404.vue 는 1회만 요청, 경고 E_NOT_FOUND_PAGE 1건, 빈 본문', async ({ page }) => {
  const reqs = trackAll(page)
  await page.route('**/pages/404.vue', (r) => r.fulfill({ status: 404, body: 'nope' }))
  await page.goto('/no/such/page')
  await appMounted(page)
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('not-found')).toHaveCount(0)
  await spaPush(page, '/second/missing')
  await expect(page).toHaveURL(/second\/missing$/)
  await settle(page)
  await expect(page.getByTestId('layout-default')).toBeVisible()
  expect(hits(reqs, '/pages/404.vue')).toBe(1)
  const notFound = (await vzErrors(page)).filter((e) => e.code === 'E_NOT_FOUND_PAGE')
  expect(notFound).toHaveLength(1)
  expect(notFound[0]).toMatchObject({ stage: 'load', level: 'warn' })
  expect(notFound[0].file).toContain('/pages/404.vue')
  // 이후 정상 페이지로 이동 가능
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('v1.5.0: error.vue 는 페이지 로드가 실패했을 때만 받는다', async ({ page }) => {
  const reqs = trackAll(page)
  await page.route('**/pages/slow-b.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  expect(hits(reqs, '/pages/error.vue')).toBe(0)
  await spaPush(page, '/slow-b')
  await expect(page.getByTestId('error-page')).toBeVisible()
  expect(hits(reqs, '/pages/error.vue')).toBe(1)
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await spaPush(page, '/slow-b')
  await expect(page.getByTestId('error-page')).toBeVisible()
  expect(hits(reqs, '/pages/error.vue')).toBe(1) // 성공한 error.vue 는 캐시
})

test('v1.5.0: error.vue 없음 + 로드 실패 — 조용히 폴백(E_ERROR_PAGE 없음), 없다는 사실은 캐시해 다시 요청하지 않는다', async ({ page }) => {
  const reqs = trackAll(page)
  await page.route('**/pages/error.vue', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/pages/slow-b.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await spaPush(page, '/slow-b')
  await expect.poll(async () => (await vzErrors(page)).some((e) => e.code === 'E_PAGE_FETCH')).toBe(true)
  await settle(page)
  await spaPush(page, '/slow-b')
  await settle(page)
  expect(hits(reqs, '/pages/error.vue')).toBe(1)
  const errs = await vzErrors(page)
  expect(errs.filter((e) => e.code === 'E_ERROR_PAGE')).toEqual([])
  await expect(page.getByTestId('error-page')).toHaveCount(0)
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
})
