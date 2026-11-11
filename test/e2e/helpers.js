import { expect } from '@playwright/test'

/** createApp 옵션을 페이지 로드 전에 주입 (각 앱의 index.html 이 window.__VZ_OPTIONS__ 를 읽는다) */
export async function useOptions(page, options) {
  await page.addInitScript((o) => { window.__VZ_OPTIONS__ = o }, options)
}

/** localStorage 값을 페이지 로드 전에 주입 */
export async function seedStorage(page, entries) {
  await page.addInitScript((e) => {
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v)
  }, entries)
}

/** `/<dir>/<Name>.vue` 요청 기록 (이름 배열). 이미 시작된 요청도 잡히도록 goto 전에 호출한다. */
export function trackVue(page, dir = 'components') {
  const names = []
  const re = new RegExp(`/${dir}/([^/?]+)\\.vue(\\?|$)`)
  page.on('request', (req) => {
    const m = req.url().match(re)
    if (m) names.push(m[1])
  })
  return names
}

/** 모든 요청 [{method,url}] 기록 */
export function trackAll(page) {
  const reqs = []
  page.on('request', (r) => reqs.push({ method: r.method(), url: new URL(r.url()).pathname + new URL(r.url()).search }))
  return reqs
}

export function collectConsole(page) {
  const c = { errors: [], warns: [], pageErrors: [] }
  page.on('console', (m) => {
    if (m.type() === 'error') c.errors.push(m.text())
    if (m.type() === 'warning') c.warns.push(m.text())
  })
  page.on('pageerror', (e) => c.pageErrors.push(String(e)))
  return c
}

/** 앱 마운트 완료 (vue 가 #app 에 data-v-app 을 붙인다) */
export const appMounted = (page) => expect(page.locator('#app[data-v-app]')).toBeAttached()

/** 라우트 응답을 test 가 release() 할 때까지 붙잡는 게이트 (고정 sleep 대신 결정적 제어) */
export async function gate(page, urlGlob) {
  let release
  const released = new Promise((r) => { release = r })
  let hit
  const reached = new Promise((r) => { hit = r })
  await page.route(urlGlob, async (route) => {
    hit()
    await released
    await route.continue()
  })
  return { release, reached }
}

export const computedColor = (locator) => locator.evaluate((el) => getComputedStyle(el).color)

/** 현재 페이지 요청 중 특정 경로 정규식에 맞는 개수 */
export const count = (arr, name) => arr.filter((n) => n === name).length

/** 앱의 vue-router 로 SPA 이동 (링크가 없는 경로용) */
export async function spaPush(page, path) {
  await page.locator('#app[data-v-app]').waitFor({ state: 'attached' })
  await page.evaluate((p) => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(p), path)
}

export const sorted = (arr) => [...arr].sort()

/** 몇 프레임 흘려보내 직전 렌더/마이크로태스크 부수효과가 반영되게 한다 (고정 sleep 아님) */
export const settle = (page, frames = 5) =>
  page.evaluate(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)) }, frames)

/** localStorage 읽기 (페이지가 열려 있어야 함) */
export const readToken = (page, key = 'token') => page.evaluate((k) => localStorage.getItem(k), key)

/** 서버 픽스처에서 토큰을 받아온다 (kind: valid|b64url|expired|noExp|badSignature|garbage|badPayload) */
export async function fetchToken(request, kind) {
  const res = await request.get(`/api/token?kind=${kind}`)
  if (!res.ok()) throw new Error(`token fixture ${kind}: ${res.status()}`)
  return (await res.json()).token
}

/** Date.now 에 오프셋을 더해 "시간 경과"를 흉내 낸다 (페이지 타이머는 건드리지 않음). window.__skewMs 를 바꿔 조절. */
export async function installClockSkew(page) {
  await page.addInitScript(() => {
    window.__skewMs = 0
    const real = Date.now.bind(Date)
    Date.now = () => real() + window.__skewMs
  })
}

/** console 메시지(JSHandle 인자 포함)를 모두 수집한다 — Error 인자의 스택 확인용 */
export function collectMessages(page) {
  const all = []
  page.on('console', (m) => all.push(m))
  return all
}

/** 앱이 쌓은 진단 버퍼 (VueZero.errors()) */
export const vzErrors = (page) => page.evaluate(() => window.VueZero.errors())

/** `.vue` 파일(test/apps/<app>/<rel>)에서 `needle` 이 있는 줄 번호(1-based) */
export async function lineOf(app, rel, needle) {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL(`../apps/${app}/${rel}`, import.meta.url), 'utf8').split('\n')
  const i = src.findIndex((l) => l.includes(needle))
  if (i < 0) throw new Error(`${needle} not found in ${rel}`)
  return i + 1
}

/** spaPush 와 달리 이동 완료를 기다리지 않는다 (게이트로 붙잡힌 이동 시작용) */
export async function spaStart(page, path) {
  await page.locator('#app[data-v-app]').waitFor({ state: 'attached' })
  await page.evaluate((p) => { document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(p).catch(() => {}) }, path)
}

/** 테스트 서버(127.0.0.1)는 dev 호스트라 영속 캐시가 꺼진다. 같은 앱을 prod 호스트처럼 보이게 하는 가짜 https 출처. */
export const PROD = 'https://app.example'

/** `PROD` 로 가는 모든 요청을 baseURL(로컬 테스트 서버)로 중계한다 — https 라 Cache Storage 도 쓸 수 있다. 컨텍스트 단위라 같은 context 의 새 페이지도 적용된다. */
export async function serveAsProd(context, baseURL) {
  await context.route(`${PROD}/**`, async (route) => {
    const u = new URL(route.request().url())
    await route.fulfill({ response: await route.fetch({ url: baseURL + u.pathname + u.search }) })
  })
}

/** `.vue` 요청만 [url...] (쿼리 포함) */
export const vueReqs = (reqs) => reqs.map((r) => r.url).filter((u) => /\.vue(\?|$)/.test(u))

/** 부팅 요청 중 .json (매니페스트·pages.json·components.json) */
export const bootReqs = (reqs) => reqs.map((r) => r.url).filter((u) => /\.json(\?|$)/.test(u))

/** 현재 출처의 Cache Storage 요약 { 캐시이름: [키...] } */
export const cacheDump = (page) => page.evaluate(async () => {
  const out = {}
  for (const n of await caches.keys()) {
    const c = await caches.open(n)
    out[n] = (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search).sort()
  }
  return out
})

/** 요청 N개가 모두 도착할 때까지 응답을 붙잡았다가 한꺼번에 푼다 — 모두 "동시에" 요청됐다는 결정적 증거(직렬이면 영원히 안 풀려 테스트가 실패한다). */
export async function barrier(page, globs) {
  const seen = new Set()
  let open
  const opened = new Promise((r) => { open = r })
  for (const g of globs) {
    await page.route(g, async (route) => {
      seen.add(g)
      if (seen.size === globs.length) open()
      await opened
      await route.fallback()
    })
  }
  return { seen, opened }
}

/** 매니페스트 응답을 고쳐서 내려준다: edit(manifest) 로 객체를 수정. 원본은 생성기가 만든 파일(디스크)에서 읽는다 — prod 가짜 출처에서도 동작 */
export async function editManifest(page, edit, glob = '**/vz-manifest.json') {
  const { readFileSync } = await import('node:fs')
  const m = JSON.parse(readFileSync(new URL('../apps/manifest-app/vz-manifest.json', import.meta.url), 'utf8'))
  edit(m)
  await page.route(glob, (route) => route.fulfill({ contentType: 'application/json', json: m }))
}
