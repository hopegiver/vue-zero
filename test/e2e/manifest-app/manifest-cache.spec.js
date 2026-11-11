import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { useOptions, trackAll, spaPush, vzErrors, settle, serveAsProd, PROD, bootReqs, vueReqs, cacheDump, editManifest } from '../helpers.js'

// v1.5.0: 영속 캐시 — prod 호스트에서 files 해시가 있는 .vue 는 Cache Storage 에 `<경로>?v=<해시>` 키로 저장·조회한다.
// 테스트 서버(127.0.0.1)는 dev 호스트라 캐시가 꺼진다 → 같은 앱을 가짜 https 출처(PROD)로 서빙해 prod 호스트를 흉내 낸다.

test.beforeEach(async ({ context, baseURL, page }) => {
  await serveAsProd(context, baseURL)
  await useOptions(page, { manifest: true })
})

// 명세와 같은 정규화: CRLF→LF 뒤 sha256 앞 10자
const h10 = (t) => createHash('sha256').update(t.replace(/\r\n/g, '\n'), 'utf8').digest('hex').slice(0, 10)
const badgeSfc = (tag) => `<template><span data-testid="badge">${tag} {{ label }}</span></template>\n<script>\nexport default { props: { label: { type: String, default: '' } } }\n</script>\n`
const manifestOf = async (request) => (await request.get('/vz-manifest.json')).json()
const FILES = ['components/AppNav.vue', 'components/Badge.vue', 'components/Panel.vue', 'layouts/default.vue', 'pages/index.vue']

test('v1.5.0 캐시 미적중(콜드): 해시 URL(?v=)로 받아 캐시 이름 vue-zero-<버전> 에 저장한다', async ({ page, request }) => {
  const m = await manifestOf(request)
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(vueReqs(reqs).sort()).toEqual(FILES.map((f) => `/${f}?v=${m.files[f]}`).sort())
  const version = await page.evaluate(() => window.VueZero.version)
  await expect.poll(async () => Object.keys(await cacheDump(page))).toEqual([`vue-zero-${version}`])
  const dump = await cacheDump(page)
  await expect.poll(async () => (await cacheDump(page))[`vue-zero-${version}`]).toEqual(FILES.map((f) => `/${f}?v=${m.files[f]}`).sort())
  // 같은 출처의 정적 .vue 소스만 — API 응답·토큰·매니페스트는 저장하지 않는다
  expect(Object.values(dump).flat().every((k) => /^\/(pages|components|layouts)\/[^?]+\.vue\?v=[0-9a-f]{10}$/.test(k))).toBe(true)
  expect(await vzErrors(page)).toEqual([])
})

test('v1.5.0 캐시 적중(웜): 재방문에서 .vue 요청 0건 — 부팅 요청은 매니페스트 1건, 화면은 동일', async ({ page }) => {
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  await settle(page)
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  await expect(page.getByTestId('panel')).toBeVisible()
  await expect(page.getByTestId('app-nav')).toBeVisible()
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  expect(vueReqs(reqs)).toEqual([])
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
})

test('v1.5.0 새 탭(같은 컨텍스트)에서도 적중 — 캐시는 페이지가 아니라 출처에 영속', async ({ page, context }) => {
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  const p2 = await context.newPage()
  await useOptions(p2, { manifest: true })
  const reqs = trackAll(p2)
  await p2.goto(PROD + '/')
  await expect(p2.getByTestId('panel')).toBeVisible()
  expect(vueReqs(reqs)).toEqual([])
})

test('v1.5.0 해시 변경: 바뀐 파일만 새 키로 다시 요청하고 옛 항목은 유휴 정리로 지운다', async ({ page, request }) => {
  const m = await manifestOf(request)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  const version = await page.evaluate(() => window.VueZero.version)
  await expect.poll(async () => ((await cacheDump(page))[`vue-zero-${version}`] || []).length).toBe(FILES.length)
  // 새 배포 흉내: Badge 의 내용과 해시만 바뀐다
  const v2 = badgeSfc('v2')
  const H2 = h10(v2)
  await editManifest(page, (x) => { x.files['components/Badge.vue'] = H2 })
  await page.route('**/components/Badge.vue*', (r) => r.fulfill({ contentType: 'text/plain', body: v2 }))
  const reqs = trackAll(page)
  await page.reload()
  await expect(page.getByTestId('badge').first()).toContainText('v2 ')
  expect(vueReqs(reqs)).toEqual([`/components/Badge.vue?v=${H2}`])
  await expect.poll(async () => (await cacheDump(page))[`vue-zero-${version}`]).toEqual(
    FILES.map((f) => `/${f}?v=${f === 'components/Badge.vue' ? H2 : m.files[f]}`).sort())
})

test('v1.5.0 유휴 정리: 현재 매니페스트에 없는 옛 항목과 다른 버전의 캐시를 지우고, 이 앱 경로 밖 항목·무관한 캐시는 남긴다', async ({ page }) => {
  await page.goto(PROD + '/lib/vue.js')  // 앱을 띄우지 않고 출처만 확보 — 심는 도중 앱의 정리가 끼어들지 않게
  const v = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version
  await page.evaluate(async (v) => {
    const cur = await caches.open(`vue-zero-${v}`)
    await cur.put('/components/Gone.vue?v=0000000000', new Response('x'))
    await cur.put('/pages/index.vue?v=00000000aa', new Response('old'))
    await cur.put('/other/keep.js?v=1', new Response('k'))
    await (await caches.open('vue-zero-0.0.1')).put('/components/Badge.vue?v=1', new Response('old version'))
    await (await caches.open('my-own-cache')).put('/x', new Response('mine'))
  }, v)
  await page.goto(PROD + '/no/such/page')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect.poll(async () => Object.keys(await cacheDump(page)).sort()).toEqual(['my-own-cache', `vue-zero-${v}`].sort())
  const dump = await cacheDump(page)
  const cur = Object.entries(dump).find(([n]) => n.startsWith('vue-zero-'))[1]
  expect(cur).not.toContain('/components/Gone.vue?v=0000000000')
  expect(cur).not.toContain('/pages/index.vue?v=00000000aa')
  expect(cur).toContain('/other/keep.js?v=1')
  expect(dump['my-own-cache']).toEqual(['/x'])
})

test('v1.5.0 dev 호스트에서는 해시·영속 캐시를 쓰지 않는다 (127.0.0.1, ?vzdev)', async ({ page, baseURL }) => {
  const reqs = trackAll(page)
  await page.goto(baseURL + '/')  // 127.0.0.1 = dev
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(vueReqs(reqs).every((u) => !u.includes('?'))).toBe(true)
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])  // 매니페스트는 쓰되 해시는 쓰지 않는다
  expect(Object.keys(await cacheDump(page)).filter((n) => n.startsWith('vue-zero-'))).toEqual([])
  // prod 호스트라도 ?vzdev 면 dev
  const reqs2 = trackAll(page)
  await page.goto(PROD + '/?vzdev')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(bootReqs(reqs2)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs2).length).toBe(5)
  expect(vueReqs(reqs2).every((u) => !u.includes('?'))).toBe(true)
  expect(Object.keys(await cacheDump(page)).filter((n) => n.startsWith('vue-zero-'))).toEqual([])
})

test('v1.5.0 caches 미지원(비보안 컨텍스트 등): 조용히 일반 fetch — 앱 정상, 오류 없음', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'caches', { value: undefined, configurable: true }) })
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs).length).toBe(5)
  expect(vueReqs(reqs).every((u) => !u.includes('?'))).toBe(true)
  expect(await vzErrors(page)).toEqual([])
})

test('v1.5.0 caches 예외(사설 모드·SecurityError): open 이 거부돼도 앱 정상, 오류 없음, 해시 URL 로 받는다', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => Promise.reject(new DOMException('denied', 'SecurityError'))
    CacheStorage.prototype.open = boom
    CacheStorage.prototype.keys = boom
  })
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs)).toHaveLength(5)
  expect(vueReqs(reqs).every((u) => /\?v=[0-9a-f]{10}$/.test(u))).toBe(true)
  expect(await vzErrors(page)).toEqual([])
})

test('v1.5.0 쿼터 초과(put 거부): 앱 정상, 오류 없음, 저장만 건너뛴다', async ({ page }) => {
  await page.addInitScript(() => { Cache.prototype.put = () => Promise.reject(new DOMException('full', 'QuotaExceededError')) })
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  await spaPush(page, '/about')
  await expect(page.getByTestId('page')).toHaveText('About')
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs).every((u) => /\?v=[0-9a-f]{10}$/.test(u))).toBe(true)
  expect(await vzErrors(page)).toEqual([])
  expect(Object.values(await cacheDump(page)).flat().filter((k) => k.endsWith('.vue') || k.includes('.vue?'))).toEqual([])
})

test('v1.5.0 형식이 이상한 해시 값은 무시한다 (해당 파일은 일반 URL 로 요청)', async ({ page }) => {
  await editManifest(page, (x) => { x.files['pages/index.vue'] = '../x&y=1' })
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('page')).toHaveText('Home')
  expect(bootReqs(reqs)).toEqual(['/vz-manifest.json'])
  expect(vueReqs(reqs)).toContain('/pages/index.vue')
  expect(vueReqs(reqs).filter((u) => u.includes('?v='))).toHaveLength(4)
})

test('v1.5.0 off 에서는 prod 호스트라도 캐시를 쓰지 않는다 (옵트인)', async ({ page }) => {
  await useOptions(page, {})
  const reqs = trackAll(page)
  await page.goto(PROD + '/')
  await expect(page.getByTestId('panel')).toBeVisible()
  expect(vueReqs(reqs).every((u) => !u.includes('?'))).toBe(true)
  expect(bootReqs(reqs).sort()).toEqual(['/components/components.json', '/pages/pages.json'])
  expect(Object.keys(await cacheDump(page))).toEqual([])
})

// v1.5.0 RV-001: 캐시 키는 콘텐츠 해시다 — 해시와 내용이 맞는 정적 소스만 저장한다.
// 불일치·HTML(SPA fallback)·리다이렉트·비정상 상태 응답은 화면에는 그대로 쓰이되(v1.4.0 과 같은 결과) 저장하지 않아, 서버가 정상화되면 다음 방문에 회복된다.
const pb = (page) => page.getByTestId('panel').getByTestId('badge')
const NEW = badgeSfc('NEW')
const bad = {
  '해시 불일치(옛 내용)': { fulfill: { contentType: 'text/plain', body: badgeSfc('OLD') }, shows: 'OLD panel' },
  'HTML(SPA fallback 200 text/html)': { fulfill: { contentType: 'text/html', body: '<!DOCTYPE html><html><body><div id="app"></div></body></html>' }, shows: null },
  // Playwright 는 리다이렉트 중간 요청을 가로채지 못해 실제 3xx 대신 fetch 응답의 redirected 플래그만 세운다(내용·해시는 일치)
  '리다이렉트를 거친 응답': { redirect: true, fulfill: { contentType: 'text/plain', body: NEW }, shows: 'NEW panel' },
  // 본문이 해시와 일치해도 ok 가 아니면 저장하지 않는다 (res.ok 분기)
  '404(본문은 해시와 일치)': { fulfill: { status: 404, body: NEW }, shows: null },
  '500(본문은 해시와 일치)': { fulfill: { status: 500, body: NEW }, shows: null },
}
for (const [label, c] of Object.entries(bad)) {
  test(`v1.5.0 저장 검증: ${label} 은 저장하지 않는다 — 서버 정상화 후 재방문에서 새 내용으로 회복`, async ({ page }) => {
    const H = h10(NEW)
    await editManifest(page, (x) => { x.files['components/Badge.vue'] = H })
    if (c.redirect) await page.addInitScript(() => { const f = window.fetch; window.fetch = async (...a) => { const r = await f(...a); if (String(a[0]).includes('Badge.vue') && !localStorage.getItem('fixed')) Object.defineProperty(r, 'redirected', { value: true }); return r } })
    let serve = (r) => r.fulfill(c.fulfill)
    await page.route('**/components/Badge.vue*', (r) => serve(r))
    await page.goto(PROD + '/')
    await expect(page.getByTestId('page')).toHaveText('Home')
    if (c.shows) await expect(pb(page)).toHaveText(c.shows)
    else await expect(pb(page)).toHaveCount(0)
    const version = await page.evaluate(() => window.VueZero.version)
    // 정상 파일 4건이 저장될 때까지 기다린 뒤 Badge 키가 없음을 본다
    await expect.poll(async () => ((await cacheDump(page))[`vue-zero-${version}`] || []).length).toBeGreaterThanOrEqual(4)
    expect((await cacheDump(page))[`vue-zero-${version}`].some((k) => k.includes('Badge.vue'))).toBe(false)
    // 서버 정상화 → 재방문: 고착 없이 Badge 를 다시 요청해 새 내용을 보여 준다
    serve = (r) => r.fulfill({ contentType: 'text/plain', body: NEW })
    await page.evaluate(() => localStorage.setItem('fixed', '1'))
    const reqs = trackAll(page)
    await page.reload()
    await expect(pb(page)).toHaveText('NEW panel')
    expect(vueReqs(reqs)).toEqual([`/components/Badge.vue?v=${H}`])
    await expect.poll(async () => (await cacheDump(page))[`vue-zero-${version}`]).toContain(`/components/Badge.vue?v=${H}`)
    // 정상 저장된 뒤에는 적중(요청 0건)
    const reqs2 = trackAll(page)
    await page.reload()
    await expect(pb(page)).toHaveText('NEW panel')
    expect(vueReqs(reqs2)).toEqual([])
  })
}

test('v1.5.0 저장 검증: CRLF 로 서빙된 소스도 해시(정규화)가 맞으면 저장된다', async ({ page }) => {
  const crlf = NEW.replace(/\n/g, '\r\n')
  const H = h10(NEW)
  await editManifest(page, (x) => { x.files['components/Badge.vue'] = H })
  await page.route('**/components/Badge.vue*', (r) => r.fulfill({ contentType: 'text/plain', body: crlf }))
  await page.goto(PROD + '/')
  await expect(pb(page)).toHaveText('NEW panel')
  const version = await page.evaluate(() => window.VueZero.version)
  await expect.poll(async () => (await cacheDump(page))[`vue-zero-${version}`]).toContain(`/components/Badge.vue?v=${H}`)
})
