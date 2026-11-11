import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
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
  ['pages 원소가 문자열이 아님(RV-004)', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"v":1,"pages":[1],"components":[]}' })],
  ['components 원소가 문자열이 아님(RV-004)', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"v":1,"pages":["index"],"components":[null]}' })],
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

// v1.5.0 RV-002: 힌트(deps)로 시작한 선행 요청의 실패는 보고하지 않는다 — 틀린 힌트가 거짓 진단을 남기면 AI 가 없는 레이아웃을 만들러 간다.
test('v1.5.0 틀린 deps(없는 레이아웃·없는 컴포넌트 파일)는 진단을 남기지 않는다: VueZero.errors() 가 비어 있다', async ({ page }) => {
  await useOptions(page, { manifest: true })
  await editManifest(page, (m) => {
    m.components.push('Phantom')
    m.deps['pages/index.vue'] = { layout: 'ghostlayout', components: ['Phantom', 'Panel', 'AppNav', 'Badge'] }
  })
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('layout-default')).toBeVisible()
  await expect(page.getByTestId('panel')).toBeVisible()
  await settle(page)
  expect(await vzErrors(page)).toEqual([])
})

test('v1.5.0 힌트가 맞고 파일이 실제로 필요한데 없으면 정규 경로가 그대로 진단한다 (E_LAYOUT_NOT_FOUND 1건 / E_COMPONENT_FETCH)', async ({ page }) => {
  await useOptions(page, { manifest: true })
  await page.route('**/layouts/default.vue', (r) => r.fulfill({ status: 404, body: 'nope' }))
  await page.route('**/components/Badge.vue', (r) => r.fulfill({ status: 404, body: 'nope' }))
  await page.goto('/')
  await expect(page.getByTestId('page')).toHaveText('Home')
    await expect.poll(async () => (await vzErrors(page)).length).toBeGreaterThanOrEqual(2)
  await settle(page)
  const errs = await vzErrors(page)
  expect(errs.filter((e) => e.code === 'E_LAYOUT_NOT_FOUND')).toHaveLength(1)
  expect(errs.filter((e) => e.code === 'E_COMPONENT_FETCH').length).toBeGreaterThan(0)
  expect(errs.find((e) => e.code === 'E_LAYOUT_NOT_FOUND').file).toBe('/layouts/default.vue')
})

// Inflight.shared 의 재시도 분기: 선행 로드(quiet)가 먼저 시작한 요청에 정규 경로가 합류한 뒤 quiet 가 실패하면,
// 정규 경로가 직접 다시 받아 보고한다. 이 분기가 없으면 quiet 의 실패(무보고)가 정규 경로로 새어 레이아웃/컴포넌트가 조용히 사라진다.
const APP_DIR = new URL('../../apps/manifest-app/', import.meta.url)
for (const [label, first, second, expectErr] of [
  ['레이아웃 404→404: 정규 경로가 재시도하고 E_LAYOUT_NOT_FOUND 를 보고한다', 404, 404, ['E_LAYOUT_NOT_FOUND']],
  ['레이아웃 500→200: 정규 경로의 재시도가 성공해 레이아웃이 뜨고 진단은 없다', 500, 200, []],
]) {
  test(`v1.5.0 Inflight 재시도(합류 후 quiet 실패): ${label}`, async ({ page }) => {
    await useOptions(page, { manifest: true })
    const orig = readFileSync(new URL('layouts/default.vue', APP_DIR), 'utf8')
    let n = 0, release
    const held = new Promise((r) => { release = r })
    await page.route('**/layouts/default.vue', async (r) => {
      if (++n === 1) { await held; return r.fulfill({ status: first, body: 'x' }) }
      return second === 200 ? r.fulfill({ contentType: 'text/plain', body: orig }) : r.fulfill({ status: second, body: 'x' })
    })
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForLoadState('load')
    await settle(page, 15)
    expect(n).toBe(1) // 정규 경로가 quiet 요청에 합류했고 새 요청은 없다
    release()
    await settle(page, 20)
    const errs = (await vzErrors(page)).map((e) => e.code).filter((c) => c.startsWith('E_LAYOUT') || c === 'E_PAGE_LOAD')
    expect(errs).toEqual(expectErr)
    expect(await page.getByTestId('layout-default').count()).toBe(second === 200 ? 1 : 0)
    expect(n).toBe(2)
  })
}

test('v1.5.0 Inflight 재시도(합류 후 quiet 실패): 컴포넌트 500→200 — 재시도로 Badge 가 그려지고 진단은 없다', async ({ page }) => {
  await useOptions(page, { manifest: true })
  const orig = readFileSync(new URL('components/Badge.vue', APP_DIR), 'utf8')
  let n = 0, release
  const held = new Promise((r) => { release = r })
  await page.route('**/components/Badge.vue', async (r) => {
    if (++n === 1) { await held; return r.fulfill({ status: 500, body: 'x' }) }
    return r.fulfill({ contentType: 'text/plain', body: orig })
  })
  await page.goto('/', { waitUntil: 'commit' })
  await page.waitForLoadState('load')
  await settle(page, 30)
  release()
  await expect(page.getByTestId('page')).toHaveText('Home')
  await settle(page, 20)
  expect(await vzErrors(page)).toEqual([])
  expect(await page.getByTestId('badge').count()).toBeGreaterThan(0)
})
