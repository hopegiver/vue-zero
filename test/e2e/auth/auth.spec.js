import { test, expect } from '@playwright/test'
import { useOptions, seedStorage, fetchToken, readToken, trackAll, collectConsole, spaPush, installClockSkew, settle } from '../helpers.js'

const ON = { auth: { enabled: true } }

async function login(page, { email = 'user@example.com', password = 'pass' } = {}) {
  await page.getByTestId('login-form').waitFor()
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await page.click('button[type=submit]')
}

test.describe('활성/비활성', () => {
  test('auth 미설정: 토큰 없이도 보호 대상 페이지 접근 가능', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
  })

  test('enabled=true, 토큰 없음: 보호 페이지는 /login 으로, 로그인 폼 렌더', async ({ page }) => {
    await useOptions(page, ON)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('login-form')).toBeVisible()
  })

  test('auth:false 페이지(/public)와 404 는 토큰 없이 접근 가능', async ({ page }) => {
    await useOptions(page, ON)
    await page.goto('/public')
    await expect(page.getByTestId('page')).toHaveText('Public')
    await page.goto('/no-such-page')
    await expect(page.getByTestId('not-found')).toBeVisible()
    await expect(page).toHaveURL(/\/no-such-page$/)
  })

  test('SPA 이동으로 보호 페이지에 가도 가드가 동작', async ({ page }) => {
    await useOptions(page, ON)
    await page.goto('/public')
    await spaPush(page, '/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('토큰 검증', () => {
  test('유효 토큰: 접근 가능 + 보호된 API(/api/me)가 실제로 200', async ({ page, request }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'valid') })
    await page.goto('/dashboard')
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
    await expect(page.getByTestId('api-status')).toHaveText('200')
    await expect(page.getByTestId('api-name')).toHaveText('tester')
  })

  test('exp 없는 토큰은 유효로 취급', async ({ page, request }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'noExp') })
    await page.goto('/')
    await expect(page.getByTestId('page')).toHaveText('Home (protected)')
  })

  test('만료 토큰: /login 으로 보내고 localStorage 에서 자동 제거', async ({ page, request }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'expired') })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    expect(await readToken(page)).toBeNull()
  })

  test('세션 중 만료: 유효하던 토큰이 시간이 지나 만료되면 다음 이동에서 차단 + 제거', async ({ page, request }) => {
    await installClockSkew(page)
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'valid') }) // exp = +1h
    await page.goto('/')
    await expect(page.getByTestId('page')).toHaveText('Home (protected)')
    await page.evaluate(() => { window.__skewMs = 2 * 3600 * 1000 })
    await spaPush(page, '/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    expect(await readToken(page)).toBeNull()
  })

  for (const kind of ['garbage', 'badPayload']) {
    test(`변조/깨진 토큰(${kind}): 인증 실패로 /login`, async ({ page, request }) => {
      await useOptions(page, ON)
      await seedStorage(page, { token: await fetchToken(request, kind) })
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  test('payload 만 정상이고 서명이 틀린 토큰: 클라이언트 가드는 통과(서명 검증 안 함)하지만 서버 API 는 401', async ({ page, request }) => {
    // 클라이언트 가드는 UX 용이며 보안 경계는 서버다 — 이 계약을 고정해 둔다.
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'badSignature') })
    await page.goto('/dashboard')
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
    await expect(page.getByTestId('api-status')).toHaveText('401')
  })

  test('빈 문자열 토큰은 미인증', async ({ page }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: '' })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('base64url JWT payload (v1.2.1 회귀, 406f99b)', () => {
  test('payload 에 "-" 또는 "_" 가 있는 토큰으로 보호 페이지 접근 + 서버 API 200', async ({ page, request }) => {
    const token = await fetchToken(request, 'b64url')
    expect(token.split('.')[1]).toMatch(/[-_]/) // 픽스처가 실제로 base64url 특수문자를 포함하는지 확인
    await useOptions(page, ON)
    await seedStorage(page, { token })
    await page.goto('/dashboard')
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
    await expect(page.getByTestId('api-status')).toHaveText('200')
    await expect(page.getByTestId('api-name')).toHaveText('홍길동~~??>>')
  })

  test('실제 로그인 플로우(UI -> /api/login -> 토큰 저장 -> 이동) 후 새로고침해도 세션 유지', async ({ page }) => {
    const c = collectConsole(page)
    await useOptions(page, ON)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await login(page)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByTestId('api-status')).toHaveText('200')
    expect((await readToken(page)).split('.')[1]).toMatch(/[-_]/)
    await page.reload()
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
    await expect(page.getByTestId('api-name')).toHaveText('홍길동~~??>>')
    expect(c.pageErrors).toEqual([])
  })

  test('잘못된 자격증명: 서버 401 이 화면에 표시되고 토큰은 저장되지 않는다 (하드코딩 아님)', async ({ page }) => {
    await useOptions(page, ON)
    await page.goto('/login')
    await login(page, { password: 'wrong' })
    await expect(page.getByTestId('login-error')).toHaveText('login failed 401')
    expect(await readToken(page)).toBeNull()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('옵션: tokenKey / loginPage', () => {
  test('커스텀 tokenKey: 다른 키의 토큰은 무시, 지정한 키의 토큰만 인정', async ({ page, request }) => {
    const valid = await fetchToken(request, 'valid')
    await useOptions(page, { auth: { enabled: true, tokenKey: 'my_jwt' } })
    await seedStorage(page, { token: valid })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/) // 'token' 키는 보지 않는다

    await page.evaluate((t) => localStorage.setItem('my_jwt', t), valid)
    await spaPush(page, '/dashboard')
    await expect(page.getByTestId('page')).toHaveText('Dashboard (protected)')
    await expect(page.getByTestId('api-status')).toHaveText('200')
  })

  test('커스텀 tokenKey: 로그인이 그 키에 저장, 만료 시 그 키만 제거', async ({ page, request }) => {
    await useOptions(page, { auth: { enabled: true, tokenKey: 'my_jwt' } })
    await seedStorage(page, { token: 'untouched' })
    await page.goto('/login')
    await login(page)
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(await readToken(page, 'my_jwt')).toBeTruthy()

    await page.evaluate((t) => localStorage.setItem('my_jwt', t), await fetchToken(request, 'expired'))
    await spaPush(page, '/')
    await expect(page).toHaveURL(/\/login$/)
    expect(await readToken(page, 'my_jwt')).toBeNull()
    expect(await readToken(page, 'token')).toBe('untouched')
  })

  test('커스텀 loginPage(/signin)로 리다이렉트', async ({ page }) => {
    await useOptions(page, { auth: { enabled: true, loginPage: '/signin' } })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.locator('.signin-form')).toBeVisible()
  })
})

test.describe('리다이렉트 루프 없음', () => {
  test('미인증으로 보호 페이지 진입: 로그인 페이지를 1번만 받고 안정화, 히스토리 항목 1개 증가', async ({ page }) => {
    const reqs = trackAll(page)
    const c = collectConsole(page)
    await useOptions(page, ON)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    await settle(page, 15)
    expect(reqs.filter((r) => r.url === '/pages/login.vue').length).toBe(1)
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2)
    expect(c.errors.filter((e) => /redirect/i.test(e))).toEqual([])
  })

  test('로그인한 사용자가 /login 을 열어도 튕기거나 루프하지 않는다', async ({ page, request }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'valid') })
    await page.goto('/login')
    await expect(page.getByTestId('login-form')).toBeVisible()
    await settle(page, 10)
    await expect(page).toHaveURL(/\/login$/)
  })

  test('로그인 후 보호 페이지 -> 로그아웃(토큰 제거) -> 다시 보호 페이지: 정확히 /login 으로', async ({ page, request }) => {
    await useOptions(page, ON)
    await seedStorage(page, { token: await fetchToken(request, 'valid') })
    await page.goto('/')
    await expect(page.getByTestId('page')).toHaveText('Home (protected)')
    await page.evaluate(() => localStorage.removeItem('token'))
    await spaPush(page, '/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})
