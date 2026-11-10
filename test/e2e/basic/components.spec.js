import { test, expect } from '@playwright/test'
import { trackVue, collectConsole, spaPush, sorted, count, settle } from '../helpers.js'

// 컴포넌트 지연 로딩 (v1.3.0 기능) — 결정적 기준: 요청 이름/횟수만 본다 (시간 기준 없음)

test('컴포넌트를 쓰지 않는 페이지: 컴포넌트 요청 0건 (components.json 의 11개 전부 미요청)', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await settle(page)
  expect(req).toEqual([])
})

test('중첩: Wrapper -> Card 둘 다 1회씩만 요청, 렌더됨', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/comp-nested')
  await expect(page.getByTestId('card')).toHaveText('card:inner')
  await expect(page.getByTestId('wrapper')).toBeVisible()
  expect(sorted(req)).toEqual(['Card', 'Wrapper'])
})

test('순환 참조 Ping <-> Pong: 교착 없이 각 1회 요청, 끝까지 렌더', async ({ page }) => {
  const req = trackVue(page)
  const c = collectConsole(page)
  await page.goto('/comp-cycle')
  await expect(page.locator('.ping').first()).toContainText('ping0')
  await expect(page.locator('.pong').first()).toContainText('pong1')
  await expect(page.locator('.ping')).toHaveCount(2) // ping0, ping2
  expect(sorted(req)).toEqual(['Ping', 'Pong'])
  expect(c.pageErrors).toEqual([])
})

test('자기 재귀 Tree: 1회 요청, 트리 4노드 렌더', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/comp-recursive')
  await expect(page.locator('.tree-node')).toHaveCount(4)
  expect(req).toEqual(['Tree'])
})

test('kebab-case / PascalCase 표기 둘 다 같은 컴포넌트로 해석, 중복 요청 없음', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/comp-kebab')
  await expect(page.locator('.user-card')).toHaveText(['user:kebab', 'user:pascal'])
  await expect(page.getByTestId('styled-box')).toBeVisible() // <styled-box> 도 해석
  expect(sorted(req)).toEqual(['StyledBox', 'UserCard'])
})

test('동적 <component :is>: 렌더 시점에 로드 (초기 0건 -> 클릭 후 1건)', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/comp-dynamic')
  await expect(page.getByTestId('page')).toHaveText('comp-dynamic')
  await settle(page)
  expect(req).toEqual([])
  await page.click('.show')
  await expect(page.getByTestId('dynamic-widget')).toHaveText('dyn-widget')
  expect(req).toEqual(['DynamicWidget'])
})

test('컴포넌트 스타일 포함: 적용되고, 페이지를 떠나도 유지된다 (component 스코프)', async ({ page }) => {
  await page.goto('/comp-styled')
  const box = page.getByTestId('styled-box')
  await expect(box).toHaveCSS('background-color', 'rgb(0, 128, 0)')
  const style = page.locator('style[data-vue-zero="component-StyledBox"]')
  await expect(style).toHaveAttribute('data-scope', 'component')
  await page.locator('a[data-link="/about"]').click()
  await expect(page.getByTestId('page')).toHaveText('About')
  expect(await style.evaluate((el) => el.disabled)).toBe(false)
})

test('컴포넌트 파일 누락(404): console.error, 페이지의 나머지는 정상 렌더', async ({ page }) => {
  const c = collectConsole(page)
  const req = trackVue(page)
  await page.goto('/comp-missing')
  await expect(page.getByTestId('page')).toHaveText('comp-missing')
  await expect(page.getByTestId('card')).toHaveText('card:alive')
  await expect.poll(() => c.errors.some((e) => e.includes('Ghost'))).toBe(true)
  expect(sorted(req)).toContain('Ghost')
})

test('레이아웃과 페이지가 같은 컴포넌트(SharedBadge) 사용: 요청은 1회', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/comp-shared')
  await expect(page.getByTestId('shared-badge')).toHaveCount(2) // 레이아웃 1 + 페이지 1
  await expect(page.getByTestId('layout-alt')).toBeVisible()
  expect(req).toEqual(['SharedBadge'])
})

test('SPA 이동 시점에 로드하고, 이미 받은 컴포넌트는 재요청하지 않는다', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  expect(req).toEqual([])

  await spaPush(page, '/comp-nested')
  await expect(page.getByTestId('card')).toBeVisible()
  expect(sorted(req)).toEqual(['Card', 'Wrapper'])

  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await spaPush(page, '/comp-nested')
  await expect(page.getByTestId('card')).toBeVisible()
  expect(sorted(req)).toEqual(['Card', 'Wrapper']) // 캐시
  expect(count(req, 'Unused')).toBe(0)
})

test('로드 실패해도 페이지 이동은 막히지 않는다 (v1.3.0 계약)', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/components/Card.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/about')
  await spaPush(page, '/comp-nested')
  await expect(page.getByTestId('page')).toHaveText('comp-nested')
  await expect(page).toHaveURL(/\/comp-nested$/)
  await expect.poll(() => c.errors.some((e) => e.includes('Card'))).toBe(true)
})
