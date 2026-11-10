import { test, expect } from '@playwright/test'
import { collectConsole } from '../helpers.js'

test('중첩 <template> (v-if / v-for / 이중 중첩) 뒤의 내용까지 파싱된다', async ({ page }) => {
  await page.goto('/nested-template')
  await expect(page.getByTestId('nt-a')).toHaveText('A')
  await expect(page.locator('.nt-item')).toHaveText(['1', '2', '3'])
  await expect(page.getByTestId('nt-deep')).toHaveText('deep')
  await expect(page.getByTestId('after')).toHaveText('after-nested')
})

test('블록 순서가 뒤바뀐 SFC (script -> style -> template)', async ({ page }) => {
  await page.goto('/block-order')
  const h = page.getByTestId('page')
  await expect(h).toHaveText('order-ok')
  await expect(h).toHaveCSS('color', 'rgb(10, 20, 30)')
})

test('script 블록이 없는 SFC', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/no-script')
  await expect(page.getByTestId('page')).toHaveText('no-script-ok')
  expect(c.errors).toEqual([])
})

test('style 블록이 없는 SFC: <style> 태그를 만들지 않는다', async ({ page }) => {
  await page.goto('/no-style')
  await expect(page.getByTestId('page')).toHaveText('no-style-ok')
  await expect(page.locator('style[data-vue-zero="page-no-style"]')).toHaveCount(0)
})

test('페이지 전환 시 페이지 스타일 교체 (A -> B -> A)', async ({ page }) => {
  await page.goto('/style-a')
  const h = page.getByTestId('page')
  await expect(h).toHaveCSS('color', 'rgb(255, 0, 0)')

  await page.locator('a[data-link="/style-b"]').click()
  await expect(h).toHaveText('Style B')
  await expect(h).toHaveCSS('color', 'rgb(0, 0, 255)')
  expect(await page.locator('style[data-vue-zero="page-style-a"]').evaluate((e) => e.disabled)).toBe(true)
  expect(await page.locator('style[data-vue-zero="page-style-b"]').evaluate((e) => e.disabled)).toBe(false)

  await page.locator('a[data-link="/style-a"]').click()
  await expect(h).toHaveText('Style A')
  await expect(h).toHaveCSS('color', 'rgb(255, 0, 0)')
  // 재방문해도 <style> 이 중복 주입되지 않는다
  await expect(page.locator('style[data-vue-zero="page-style-a"]')).toHaveCount(1)
})

test('레이아웃 스타일은 페이지 전환에 영향받지 않는다 (layout 스코프)', async ({ page }) => {
  await page.goto('/layout-alt')
  await expect(page.locator('.alt-header')).toHaveCSS('border-bottom-color', 'rgb(1, 2, 3)')
  await expect(page.locator('style[data-vue-zero="layout-alt"]')).toHaveAttribute('data-scope', 'layout')
})
