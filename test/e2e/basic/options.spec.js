import { test, expect } from '@playwright/test'
import { useOptions, collectConsole } from '../helpers.js'

test('경로 정규화: 앞/뒤 슬래시가 섞여도 동작', async ({ page }) => {
  await useOptions(page, { baseDir: '/', pagesDir: '/pages/', componentsDir: 'components/', layoutsDir: '/layouts' })
  await page.goto('/comp-nested')
  await expect(page.getByTestId('card')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toBeVisible()
})

for (const key of ['pagesDir', 'componentsDir', 'layoutsDir']) {
  test(`옵션 검증: ${key} 에 백슬래시를 쓰면 console.error`, async ({ page }) => {
    const c = collectConsole(page)
    await useOptions(page, { [key]: 'a\\b' })
    await page.goto('/')
    await expect.poll(() => c.errors.some((e) => e.includes(`"${key}" must use "/"`))).toBe(true)
    expect(c.errors.find((e) => e.includes(`"${key}"`))).toContain('a\\b')
  })
}

test('옵션 검증: auth 옵션이 있는데 enabled 가 false 면 경고하고 가드는 동작하지 않는다', async ({ page }) => {
  const c = collectConsole(page)
  await useOptions(page, { auth: { loginPage: '/signin', tokenKey: 'k' } })
  await page.goto('/about')
  await expect(page.getByTestId('page')).toHaveText('About') // 토큰 없이도 접근 가능
  expect(c.warns.some((w) => w.includes('auth options are set but "enabled" is false'))).toBe(true)
})

test('옵션 없이도 경고 없이 시작 (기본값)', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  expect(c.warns.filter((w) => w.includes('[vue-zero]'))).toEqual([])
  expect(c.errors).toEqual([])
})
