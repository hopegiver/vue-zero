import { test, expect } from '@playwright/test'
import { collectConsole } from '../helpers.js'

test('layout 미지정 -> default 레이아웃', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('page')).toHaveText('Home')
})

test('layout: "alt" -> 다른 이름의 레이아웃', async ({ page }) => {
  await page.goto('/layout-alt')
  await expect(page.getByTestId('layout-alt')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toHaveCount(0)
  await expect(page.getByTestId('page')).toHaveText('Layout alt page')
})

test('layout: false -> 레이아웃 없이 페이지만 렌더', async ({ page }) => {
  await page.goto('/layout-none')
  await expect(page.getByTestId('page')).toHaveText('Layout none page')
  await expect(page.getByTestId('layout-default')).toHaveCount(0)
  await expect(page.getByTestId('layout-alt')).toHaveCount(0)
})

test('존재하지 않는 레이아웃: 경고 후 레이아웃 없이 렌더 (폴백)', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/layout-missing')
  await expect(page.getByTestId('page')).toHaveText('Layout missing page')
  await expect(page.getByTestId('layout-default')).toHaveCount(0)
  expect(c.warns.some((w) => w.includes('layout "nope.vue" not found'))).toBe(true)
})

test('레이아웃 전환 default -> alt -> none -> default, 같은 레이아웃 내 이동은 재마운트하지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('layout-default').evaluate((el) => { el.__marker = 'same-instance' })
  await page.locator('a[data-link="/about"]').click()
  await expect(page.getByTestId('page')).toHaveText('About')
  expect(await page.getByTestId('layout-default').evaluate((el) => el.__marker)).toBe('same-instance')

  await page.locator('a[data-link="/layout-alt"]').click()
  await expect(page.getByTestId('layout-alt')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toHaveCount(0)
  await page.goBack()
  await expect(page.getByTestId('page')).toHaveText('About')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await page.locator('a[data-link="/layout-none"]').click()
  await expect(page.getByTestId('page')).toHaveText('Layout none page')
  await expect(page.getByTestId('layout-default')).toHaveCount(0)
})
