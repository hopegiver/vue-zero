import { test, expect } from '@playwright/test'
import { useOptions, trackAll, appMounted, spaPush, vzErrors, settle, bootReqs, vueReqs, barrier, editManifest } from '../helpers.js'

// v1.5.0: createApp({ manifest }) — vz-manifest.json 한 개로 pages.json/components.json 을 대신한다(옵트인, 기본 off).
// 앱: test/apps/manifest-app (매니페스트는 서버 시작 전에 test/scripts/gen-manifest.mjs 가 만든다)

const HOME_VUE = ['/components/AppNav.vue', '/components/Badge.vue', '/components/Panel.vue', '/layouts/default.vue', '/pages/index.vue']

test('v1.5.0 off(기본): 매니페스트를 요청하지 않고 pages.json/components.json 을 받는다 (v1.4.0 과 같은 패턴)', async ({ page }) => {
  const reqs = trackAll(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('badge').first()).toBeVisible()
  expect(bootReqs(reqs).sort()).toEqual(['/components/components.json', '/pages/pages.json'])
  expect(vueReqs(reqs).sort()).toEqual(HOME_VUE)
  expect(vueReqs(reqs).some((u) => u.includes('?'))).toBe(false)
  expect((await vzErrors(page)).filter((e) => e.code === 'E_MANIFEST_FETCH')).toEqual([])
})

test('v1.5.0 on: 부팅 요청(HTML/라이브러리/.vue 제외)은 vz-manifest.json 1건뿐 — pages.json/components.json 요청 없음', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const reqs = trackAll(page)
  const manifestReqs = []
  page.on('request', (r) => { if (r.url().endsWith('/vz-manifest.json')) manifestReqs.push(r) })
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs).sort()).toEqual(HOME_VUE)
  // 항상 재검증: fetch(cache:'no-cache') 는 max-age=0 요청 헤더를 붙인다
  expect(manifestReqs).toHaveLength(1)
  expect((await manifestReqs[0].allHeaders())['cache-control']).toBe('max-age=0')
  expect(await vzErrors(page)).toEqual([])
  // 이후 이동도 정상 (about 은 매니페스트 pages 에서 만든 라우트)
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
})

test('v1.5.0 on: manifest 에 경로 문자열을 주면 그 경로를 쓴다', async ({ page }) => {
  await useOptions(page, { manifest: '/alt/manifest-copy.json' })
  const reqs = trackAll(page)
  await page.route('**/alt/manifest-copy.json', async (route) => route.fulfill({ response: await route.fetch({ url: new URL('/vz-manifest.json', route.request().url()).href }) }))
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  expect(bootReqs(reqs)).toEqual(['/alt/manifest-copy.json'])
})

for (const [label, handler] of [
  ['404', (r) => r.fulfill({ status: 404, body: 'nope' })],
  ['깨진 JSON', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"v":1,' })],
  ['형식 v2(알 수 없는 버전)', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"v":2,"pages":[],"components":[]}' })],
  ['네트워크 오류', (r) => r.abort()],
]) {
  test(`v1.5.0 on: 매니페스트 ${label} → E_MANIFEST_FETCH 경고 1건 + pages.json/components.json 으로 폴백해 앱은 정상`, async ({ page }) => {
    await useOptions(page, { manifest: true })
    const reqs = trackAll(page)
    await page.route('**/vz-manifest.json', handler)
    await page.goto('/')
    await expect(page.getByTestId('page')).toHaveText('Home')
    await expect(page.getByTestId('layout-default')).toBeVisible()
    const warns = (await vzErrors(page)).filter((e) => e.code === 'E_MANIFEST_FETCH')
    expect(warns).toHaveLength(1)
    expect(warns[0]).toMatchObject({ stage: 'manifest', file: '/vz-manifest.json', level: 'warn' })
    expect(warns[0].hint).toContain('scan')
    expect(bootReqs(reqs).sort()).toEqual(['/components/components.json', '/pages/pages.json', '/vz-manifest.json'])
    expect(vueReqs(reqs).sort()).toEqual(HOME_VUE)
    await spaPush(page, '/about')
    await expect(page.getByTestId('page')).toHaveText('About')
  })
}

test('v1.5.0 on: 404 페이지 — 매니페스트 pages 에 없는 경로는 404.vue 를 그때 처음 받는다', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const reqs = trackAll(page)
  await page.goto('/no/such')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('layout-default')).toBeVisible()
  expect(vueReqs(reqs).filter((u) => u.includes('404.vue'))).toEqual(['/pages/404.vue'])
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
})

test('v1.5.0 병렬 선행 로드: 페이지 SFC + 레이아웃 + 의존 컴포넌트 전이 폐포를 한꺼번에 요청한다 (장벽: 5건이 모두 도착해야 응답이 풀린다)', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const reqs = trackAll(page)
  const b = await barrier(page, HOME_VUE.map((u) => '**' + u))
  await page.goto('/', { waitUntil: 'commit' })
  await b.opened
  expect([...b.seen].sort()).toEqual(HOME_VUE.map((u) => '**' + u).sort())
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(vueReqs(reqs).sort()).toEqual(HOME_VUE) // 중복 요청 없음(in-flight 병합)
})

test('v1.5.0 병렬 선행 로드: off 에서는 선행하지 않는다 (페이지가 도착해야 컴포넌트를 요청)', async ({ page }) => {
  const reqs = trackAll(page)
  let release
  const held = new Promise((r) => { release = r })
  await page.route('**/pages/index.vue', async (route) => { await held; await route.fallback() })
  await page.goto('/', { waitUntil: 'commit' })
  await expect.poll(() => reqs.some((r) => r.url === '/pages/index.vue')).toBe(true)
  await settle(page)
  expect(vueReqs(reqs)).toEqual(['/pages/index.vue'])
  release()
  await expect(page.getByTestId('page')).toHaveText('Home')
})

test('v1.5.0 deps 는 힌트일 뿐: deps 가 없거나 틀려도 앱은 똑같이 동작한다', async ({ page }) => {
  await useOptions(page, { manifest: true })
  await editManifest(page, (m) => {
    m.deps['pages/index.vue'] = { layout: 'default', components: ['Ghost', 'Panel'] } // 없는 컴포넌트, 일부 누락
    delete m.deps['pages/about.vue']
    m.deps['pages/admin.vue'] = { layout: 5, components: 'AdminBar' } // 형식 오류
    m.deps['pages/login.vue'] = { layout: 'default', components: [5, null, { a: 1 }] } // 원소 형식 오류
  })
  const reqs = trackAll(page)
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('panel')).toBeVisible()
  await expect(page.getByTestId('badge').first()).toBeVisible()
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await expect(page.getByTestId('app-nav')).toBeVisible()
  await spaPush(page, '/admin')
  await expect(page.getByTestId('layout-admin')).toBeVisible()
  await expect(page.getByTestId('admin-bar')).toBeVisible()
  await spaPush(page, '/login')
  await expect(page.getByTestId('page')).toHaveText('Login')
  expect((await vzErrors(page)).filter((e) => e.level === 'error')).toEqual([])
})

test('v1.5.0 deps 가 생략된 페이지(layout 이 리터럴이 아님)도 정상 — 선행 로드 없이 기존 경로', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const reqs = trackAll(page)
  await page.goto('/dynamic-layout')
  await expect(page.getByTestId('page')).toHaveText('Dynamic layout')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('app-nav')).toBeVisible()
  expect(vueReqs(reqs).sort()).toEqual(['/components/AppNav.vue', '/components/Badge.vue', '/layouts/default.vue', '/pages/dynamic-layout.vue'])
})

test('v1.5.0 연속 이동: 선행 로드가 있어도 요청은 합집합이다(중복 없음)', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const reqs = trackAll(page)
  await page.goto('/')
  await appMounted(page)
  for (const p of ['/about', '/admin', '/', '/about', '/admin']) {
    await spaPush(page, p)
    await settle(page)
  }
  await expect(page.getByTestId('admin-bar')).toBeVisible()
  const v = vueReqs(reqs)
  expect(new Set(v).size).toBe(v.length)
  expect(v.sort()).toEqual([...HOME_VUE, '/components/AdminBar.vue', '/layouts/admin.vue', '/pages/about.vue', '/pages/admin.vue'].sort())
})
