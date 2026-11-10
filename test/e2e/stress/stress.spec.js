import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { trackVue, trackAll, spaPush, sorted, settle } from '../helpers.js'

// 컴포넌트 300개 규모. 시간 기준 없이 "요청 집합과 횟수"만 본다 (결정적).
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../apps/stress/components/components.json', import.meta.url)), 'utf8'))
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => 'C' + String(from + i).padStart(3, '0'))
const assertNoDuplicates = (req) => expect(req.length, `중복 요청: ${req}`).toBe(new Set(req).size)

test('전제: 컴포넌트 300개가 components.json 에 선언되어 있다', () => {
  expect(manifest).toHaveLength(300)
})

test('초기 로드(컴포넌트 안 쓰는 페이지): 컴포넌트 요청 0건, components.json 은 1회', async ({ page }) => {
  const req = trackVue(page)
  const all = trackAll(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('index')
  await settle(page)
  expect(req).toEqual([])
  expect(all.filter((r) => r.url === '/components/components.json')).toHaveLength(1)
})

test('페이지가 쓰는 3개만 요청, 중복 없음', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/small')
  await expect(page.locator('.c')).toHaveCount(3)
  expect(sorted(req)).toEqual(['C010', 'C011', 'C012'])
})

test('깊이 10 체인(C100 -> C109): 정확히 10개, 각 1회, 끝까지 렌더', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/chain')
  await expect(page.locator('[data-c="C109"]')).toBeVisible()
  expect(sorted(req)).toEqual(range(100, 109))
  assertNoDuplicates(req)
})

test('20개 병렬 사용: 정확히 그 20개, 각 1회', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/many')
  await expect(page.locator('.c')).toHaveCount(20)
  expect(sorted(req)).toEqual(range(200, 219))
  assertNoDuplicates(req)
})

test('300개 전부 쓰는 페이지: 300개 각 1회(중복 없음), 모두 렌더', async ({ page }) => {
  test.setTimeout(60_000)
  const req = trackVue(page)
  await page.goto('/all')
  await expect(page.locator('[data-testid="page"] ~ .c')).toHaveCount(300, { timeout: 30_000 })
  expect(sorted(req)).toEqual(sorted(manifest))
  assertNoDuplicates(req)
})

test('SPA 이동 연쇄: 요청 합집합 = 사용한 것들, 재방문 시 재요청 없음', async ({ page }) => {
  const req = trackVue(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('index')
  for (const [path, text] of [['/small', 'small'], ['/many', 'many'], ['/small', 'small'], ['/', 'index'], ['/many', 'many']]) {
    await spaPush(page, path)
    await expect(page.getByTestId('page')).toHaveText(text)
  }
  expect(sorted(req)).toEqual(sorted(['C010', 'C011', 'C012', ...range(200, 219)]))
  assertNoDuplicates(req)
})
