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
