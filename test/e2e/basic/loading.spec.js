import { test, expect } from '@playwright/test'
import { collectConsole, spaPush, spaStart, gate, settle, count, trackVue, vzErrors } from '../helpers.js'

// v1.4.0: 같은 파일의 동시 요청 병합, 레이아웃 실패 캐시 범위.

test('같은 페이지 SFC 는 A→B→A 로 이동해도 진행 중인 요청을 재사용한다 (1회 요청)', async ({ page }) => {
  const pages = trackVue(page, 'pages')
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  const g = await gate(page, '**/pages/slow-a.vue')
  await spaStart(page, '/slow-a')
  await g.reached
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await spaStart(page, '/slow-a')
  await settle(page)
  g.release()
  await expect(page.getByTestId('page')).toHaveText('Slow A')
  expect(count(pages, 'slow-a')).toBe(1)
})

test('같은 레이아웃을 동시에 요청하는 연속 이동은 레이아웃을 1회만 받는다', async ({ page }) => {
  const layouts = trackVue(page, 'layouts')
  await page.goto('/layout-none')
  await expect(page.getByTestId('page')).toHaveText('Layout none page')
  const g = await gate(page, '**/layouts/default.vue')
  await spaStart(page, '/about')
  await g.reached
  await spaStart(page, '/')
  await settle(page)
  g.release()
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  expect(count(layouts, 'default')).toBe(1)
})

test('레이아웃 5xx 는 캐시하지 않는다: 다음 이동에서 다시 받아 레이아웃이 적용된다 + 상태 코드 경고', async ({ page }) => {
  const c = collectConsole(page)
  let fail = true
  await page.route('**/layouts/alt.vue', (r) => { if (fail) { fail = false; return r.fulfill({ status: 503, body: 'down' }) } return r.continue() })
  await page.goto('/')
  await spaPush(page, '/layout-alt')
  await expect(page.getByTestId('page')).toHaveText('Layout alt page')
  await expect(page.getByTestId('layout-alt')).toHaveCount(0)   // 첫 방문: 레이아웃 없이 렌더
  const entry = (await vzErrors(page)).find((e) => e.code === 'E_LAYOUT_FETCH')
  expect(entry).toMatchObject({ stage: 'load', file: '/layouts/alt.vue' })
  expect(entry.message).toContain('503')
  expect(c.errors.some((e) => e.includes('E_LAYOUT_FETCH') && e.includes('503'))).toBe(true)
  await spaPush(page, '/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await spaPush(page, '/layout-alt')
  await expect(page.getByTestId('layout-alt')).toBeVisible()    // 재시도 성공
})

test('레이아웃 404 는 캐시한다: 같은 없는 레이아웃을 다시 요청하지 않는다', async ({ page }) => {
  const layouts = trackVue(page, 'layouts')
  await page.goto('/layout-missing')
  await expect(page.getByTestId('page')).toHaveText('Layout missing page')
  await spaPush(page, '/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await spaPush(page, '/layout-missing')
  await expect(page.getByTestId('page')).toHaveText('Layout missing page')
  expect(count(layouts, 'nope')).toBe(1)
})
