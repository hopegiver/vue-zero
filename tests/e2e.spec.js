// @ts-check
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:8787'

// 모든 페이지가 에러 없이 로드되는지 확인
const pages = [
  { path: '/', title: 'vue-zero Home', has: 'vue-zero 예제 앱입니다.' },
  { path: '/about', title: null, has: 'vue-zero — 제로빌드 Vue 3 라우터' },
  { path: '/contact', title: '문의하기', has: '문의하기' },
  { path: '/counter', title: '카운터', has: '카운터' },
  { path: '/dashboard', title: '대시보드', has: '대시보드' },
  { path: '/datatable', title: '데이터 테이블', has: '데이터 테이블' },
  { path: '/gallery', title: '갤러리', has: '이미지 갤러리' },
  { path: '/login', title: '로그인', has: '로그인' },
  { path: '/minimal', title: null, has: '미니멀 페이지' },
  { path: '/search', title: '검색', has: '검색' },
  { path: '/search?q=vue', title: '검색', has: 'vue' },
  { path: '/settings', title: '설정', has: '설정' },
  { path: '/tabs', title: '탭 컴포넌트', has: '프로필' },
  { path: '/tabs?tab=security', title: '탭 컴포넌트', has: '보안' },
  { path: '/timer', title: '타이머', has: '타이머' },
  { path: '/todo', title: '할일 관리', has: '할일 관리' },
  { path: '/users', title: null, has: 'Users' },
  { path: '/users/1', title: '유저 상세', has: '다른 유저' },
  { path: '/users/1/posts', title: '유저 게시글', has: '게시글' },
  { path: '/admin', title: '관리자 대시보드', has: '관리자 대시보드' },
  { path: '/admin/members', title: '회원 관리', has: '회원 관리' },
]

for (const p of pages) {
  test(`페이지 로드: ${p.path}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(BASE + p.path, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText(p.has, { timeout: 5000 })

    if (p.title) {
      await expect(page).toHaveTitle(p.title, { timeout: 3000 })
    }

    expect(errors).toEqual([])
  })
}

// 404 페이지
test('404 페이지', async ({ page }) => {
  await page.goto(BASE + '/nonexistent', { waitUntil: 'networkidle' })
  await expect(page.locator('body')).toContainText('페이지를 찾을 수 없습니다', { timeout: 5000 })
})

// 레이아웃 전환: default → admin → default
test('레이아웃 전환 (default → admin → default)', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await expect(page.locator('.layout-default')).toBeVisible()

  await page.click('a[href="/admin"]')
  await expect(page.locator('.layout-admin')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.layout-default')).not.toBeVisible()

  await page.click('a[href="/"]')
  await expect(page.locator('.layout-default')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.layout-admin')).not.toBeVisible()
})

// layout: false (로그인 페이지에 레이아웃 없음)
test('layout: false — 로그인 페이지에 레이아웃 없음', async ({ page }) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await expect(page.locator('.layout-default')).not.toBeVisible()
  await expect(page.locator('.layout-admin')).not.toBeVisible()
  await expect(page.locator('.page-login')).toBeVisible()
})

// 같은 레이아웃 내 페이지 이동 (admin 레이아웃 유지)
test('같은 레이아웃 내 이동 (admin 유지)', async ({ page }) => {
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
  await expect(page.locator('.admin-sidebar')).toBeVisible()

  await page.click('a[href="/admin/members"]')
  await expect(page.locator('.admin-sidebar')).toBeVisible()
  await expect(page.locator('.page-admin-members')).toBeVisible({ timeout: 5000 })
})

// 동적 라우트 파라미터 변경 (같은 컴포넌트 재사용)
test('동적 라우트 파라미터 변경 (/users/1 → /users/2)', async ({ page }) => {
  await page.goto(BASE + '/users/1', { waitUntil: 'networkidle' })
  await expect(page.locator('.page-user-detail')).toBeVisible()

  await page.click('a[href="/users/2"]')
  await page.waitForTimeout(500)
  // URL이 변경되었는지 확인
  expect(page.url()).toContain('/users/2')
})

// 히스토리 모드 새로고침
test('히스토리 모드 — 서브페이지 새로고침', async ({ page }) => {
  const errors = []
  page.on('pageerror', err => errors.push(err.message))

  await page.goto(BASE + '/users/1', { waitUntil: 'networkidle' })
  await expect(page.locator('.page-user-detail')).toBeVisible({ timeout: 5000 })

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('.page-user-detail')).toBeVisible({ timeout: 5000 })

  expect(errors).toEqual([])
})

// counter computed + watch
test('counter — computed, watch 동작', async ({ page }) => {
  await page.goto(BASE + '/counter', { waitUntil: 'networkidle' })

  await page.click('text=+1')
  await expect(page.locator('.count')).toHaveText('1')
  await expect(page.locator('.double')).toHaveText('x2 = 2')
  await expect(page.locator('.history')).toContainText('변경 횟수: 1')

  await page.click('text=+1')
  await expect(page.locator('.count')).toHaveText('2')
  await expect(page.locator('.history')).toContainText('변경 횟수: 2')

  await page.click('text=초기화')
  await expect(page.locator('.count')).toHaveText('0')
})

// search 쿼리스트링
test('search — 쿼리스트링 동기화', async ({ page }) => {
  await page.goto(BASE + '/search?q=vue', { waitUntil: 'networkidle' })
  const input = page.locator('.page-search input')
  await expect(input).toHaveValue('vue')
  await expect(page.locator('.page-search')).toContainText('vue-zero')
})

// todo CRUD
test('todo — 추가, 완료, 삭제', async ({ page }) => {
  await page.goto(BASE + '/todo', { waitUntil: 'networkidle' })

  // 추가
  await page.fill('.todo-input input', '테스트 할일')
  await page.click('text=추가')
  await expect(page.locator('.page-todo li')).toContainText('테스트 할일')

  // 완료
  await page.click('.page-todo li input[type="checkbox"]')
  await expect(page.locator('.page-todo li.done')).toBeVisible()

  // 완료 항목 삭제
  await page.click('text=완료 항목 삭제')
  await expect(page.locator('.page-todo li')).not.toBeVisible()
})

// gallery 모달
test('gallery — 모달 열기/닫기', async ({ page }) => {
  await page.goto(BASE + '/gallery', { waitUntil: 'networkidle' })
  await expect(page.locator('.gallery-item').first()).toBeVisible({ timeout: 5000 })

  await page.click('.gallery-item >> nth=0')
  await expect(page.locator('.modal-overlay')).toBeVisible()

  await page.click('text=닫기')
  await expect(page.locator('.modal-overlay')).not.toBeVisible()
})

// 콘솔 에러 없이 전체 네비게이션
test('전체 네비게이션 — 콘솔 에러 없음', { timeout: 60000 }, async ({ page }) => {
  const errors = []
  page.on('pageerror', err => errors.push(err.message))

  const links = ['/about', '/contact', '/counter', '/search', '/settings',
                 '/minimal', '/todo', '/datatable', '/gallery', '/timer',
                 '/tabs', '/dashboard', '/users', '/admin', '/login', '/']

  for (const link of links) {
    await page.goto(BASE + link, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForTimeout(500)
  }

  expect(errors).toEqual([])
})
