import { test, expect } from '@playwright/test'
import { useOptions, trackAll, collectConsole } from '../helpers.js'

const A = { baseDir: '/static/ui', pagesDir: 'views', componentsDir: 'parts', layoutsDir: 'shells' }

test('baseDir + pagesDir + componentsDir + layoutsDir 전부 변경', async ({ page }) => {
  const reqs = trackAll(page)
  await useOptions(page, A)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('custom Home')
  await expect(page.getByTestId('badge')).toHaveText('custom-badge')
  await expect(page.getByTestId('shell')).toBeVisible()
  const urls = reqs.map((r) => r.url)
  for (const u of ['/static/ui/views/pages.json', '/static/ui/parts/components.json', '/static/ui/parts/Badge.vue', '/static/ui/shells/default.vue', '/static/ui/views/index.vue']) {
    expect(urls, u).toContain(u)
  }
  // 기본 경로로는 한 번도 요청하지 않는다
  expect(urls.filter((u) => /^\/(pages|components|layouts)\//.test(u))).toEqual([])
})

test('앞/뒤 슬래시가 섞인 옵션도 같은 경로로 정규화', async ({ page }) => {
  await useOptions(page, { baseDir: '/static/ui/', pagesDir: '/views/', componentsDir: '/parts', layoutsDir: 'shells/' })
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('custom About')
  await expect(page.getByTestId('shell')).toBeVisible()
})

test('커스텀 pagesDir 아래의 404.vue 와 SPA 이동', async ({ page }) => {
  await useOptions(page, A)
  await page.goto('/nowhere')
  await expect(page.getByTestId('not-found')).toHaveText('custom 404')
  await page.goto('/')
  await page.locator('a[data-link="/about"]').click()
  await expect(page.getByTestId('page')).toHaveText('custom About')
})

test('pagesDir 만 중첩 경로로 변경 (baseDir 기본, components/layouts 기본 디렉터리)', async ({ page }) => {
  const reqs = trackAll(page)
  await useOptions(page, { pagesDir: 'content/pages' })
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('nested Home')
  await expect(page.getByTestId('badge')).toHaveText('default-dir-badge')
  await expect(page.getByTestId('shell-default')).toBeVisible()
  const urls = reqs.map((r) => r.url)
  expect(urls).toContain('/content/pages/pages.json')
  expect(urls).toContain('/components/Badge2.vue')
  expect(urls).toContain('/layouts/default.vue')
})

test('옵션 없이 기본 경로를 보면 pages.json 이 없어 경고 (앱은 마운트)', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/')
  await expect(page.locator('#app[data-v-app]')).toBeAttached()
  await expect.poll(() => c.warns.some((w) => w.includes('pages.json not found at /pages/pages.json'))).toBe(true)
})

test('경로가 틀린 옵션: 경고 메시지에 실제 조회한 URL 이 담긴다', async ({ page }) => {
  const c = collectConsole(page)
  await useOptions(page, { ...A, pagesDir: 'typo' })
  await page.goto('/')
  await expect.poll(() => c.warns.some((w) => w.includes('/static/ui/typo/pages.json'))).toBe(true)
})
