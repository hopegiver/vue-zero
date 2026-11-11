import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { collectConsole, collectMessages, vzErrors, lineOf, spaPush, appMounted } from '../helpers.js'

// v1.4.0: AI 가 틀렸을 때 "어느 파일 몇 번째 줄이 왜 틀렸는지"를 기계가 읽을 수 있게 알려 준다.
// 새 공개 API: VueZero.errors()(링 버퍼 50), VueZero.version. 콘솔 형식: `[vue-zero] CODE file:line — message` + 다음 줄 `hint: …`

const byCode = (list, code) => list.find((e) => e.code === code)
const pkgVersion = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version

test('VueZero.version 은 package.json 버전과 같다', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => window.VueZero.version)).toBe(pkgVersion)
})

test.describe('sourceURL + 줄 정렬: 런타임 에러 스택이 실제 .vue 파일 줄을 가리킨다', () => {
  // [url, 파일, 던지는 줄의 문자열, 파일 경로]
  const cases = [
    ['/err-runtime', 'pages/err-runtime.vue', 'boom-page', '/pages/err-runtime.vue'],
    ['/err-layout', 'layouts/boom.vue', 'boom-layout', '/layouts/boom.vue'],
    ['/err-component', 'components/Boom.vue', 'boom-component', '/components/Boom.vue'],
  ]
  for (const [url, rel, needle, filePath] of cases) {
    test(`${rel}: 스택에 ${filePath}:<줄>:<열>`, async ({ page }) => {
      const msgs = collectMessages(page)
      await page.goto(url)
      await appMounted(page)
      await expect.poll(() => msgs.some((m) => m.type() === 'error' && m.text().includes(needle))).toBe(true)
      const line = await lineOf('basic', rel, needle)
      const m = msgs.find((x) => x.type() === 'error' && x.text().includes(needle))
      const errArg = m.args()[1]
      const stack = await errArg.evaluate((e) => e.stack)
      expect(stack).toContain(`${filePath}:${line}:`)
      expect(stack).not.toContain('blob:')
      // 구조화 항목에도 파일·줄이 들어간다
      const entry = byCode(await vzErrors(page), 'E_RUNTIME')
      expect(entry).toMatchObject({ stage: 'render', file: filePath, line, level: 'error' })
    })
  }
})

test('콘솔 형식: `[vue-zero] CODE file:line — message` + 다음 줄 `hint: …`', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/err-runtime')
  await appMounted(page)
  await expect.poll(() => c.errors.some((e) => e.includes('E_RUNTIME'))).toBe(true)
  const line = await lineOf('basic', 'pages/err-runtime.vue', 'boom-page')
  const text = c.errors.find((e) => e.includes('E_RUNTIME'))
  expect(text).toMatch(new RegExp(`^\\[vue-zero\\] E_RUNTIME /pages/err-runtime\\.vue:${line} — boom-page`))
  expect(text.split('\n')[1]).toMatch(/^hint: /)
})

test('렌더 에러(template 의 null 참조): E_RENDER + 파일명', async ({ page }) => {
  await page.goto('/err-render')
  await appMounted(page)
  await expect.poll(async () => byCode(await vzErrors(page), 'E_RENDER')).toMatchObject({ stage: 'render', file: '/pages/err-render.vue' })
})

test.describe('script 오류 원인 힌트 (에러 화면으로 가고, 코드·파일·hint 가 붙는다)', () => {
  const cases = [
    ['/err-setup', 'E_SCRIPT_SETUP', '/pages/err-setup.vue', /Options API/],
    ['/err-import', 'E_RELATIVE_IMPORT', '/pages/err-import.vue', /import/],
    ['/err-ts', 'E_SCRIPT_TS', '/pages/err-ts.vue', /TypeScript/],
  ]
  for (const [url, code, file, hint] of cases) {
    test(`${url} → ${code}`, async ({ page }) => {
      const c = collectConsole(page)
      await page.goto(url)
      await appMounted(page)
      await expect(page.getByTestId('error-page')).toBeVisible()
      const entry = byCode(await vzErrors(page), code)
      expect(entry).toMatchObject({ stage: 'eval', file, level: 'error' })
      expect(entry.hint).toMatch(hint)
      expect(c.errors.some((e) => e.startsWith(`[vue-zero] ${code} ${file} — `) && e.includes('\nhint: '))).toBe(true)
    })
  }
})

test('<style scoped>: E_STYLE_SCOPED 경고(파일 포함), 페이지는 렌더되고 스타일은 전역 적용', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/err-scoped')
  await expect(page.getByTestId('page')).toHaveText('err-scoped')
  expect(await page.getByTestId('page').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(9, 9, 9)')
  const entry = byCode(await vzErrors(page), 'E_STYLE_SCOPED')
  expect(entry).toMatchObject({ stage: 'parse', file: '/pages/err-scoped.vue', level: 'warn' })
  expect(c.warns.some((w) => w.includes('E_STYLE_SCOPED') && w.includes('/pages/err-scoped.vue'))).toBe(true)
})

test('E_PAGE_FETCH: 페이지 fetch 500 — 파일·HTTP 상태 포함, 토큰/쿼리는 담지 않는다', async ({ page }) => {
  await page.route('**/pages/slow-b.vue', (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')
  await spaPush(page, '/slow-b?token=SECRET123')
  await expect(page.getByTestId('error-page')).toBeVisible()
  const list = await vzErrors(page)
  const entry = byCode(list, 'E_PAGE_FETCH')
  expect(entry).toMatchObject({ stage: 'load', file: '/pages/slow-b.vue' })
  expect(entry.message).toContain('500')
  expect(JSON.stringify(list)).not.toContain('SECRET123')
})

test('E_RESERVED_TAG: pages.json 의 예약 태그 파일명은 방문하지 않아도 시작 시 보고된다', async ({ page }) => {
  const c = collectConsole(page)
  await page.route('**/pages/pages.json', (r) => r.fulfill({ json: ['index', 'about', 'table'] }))
  await page.goto('/about')
  await appMounted(page)
  const entry = byCode(await vzErrors(page), 'E_RESERVED_TAG')
  expect(entry).toMatchObject({ stage: 'manifest', file: '/pages/table.vue' })
  expect(c.errors.some((e) => e.includes('E_RESERVED_TAG') && e.includes('table'))).toBe(true)
})

test('에러 메시지에 섞인 JWT 모양 문자열은 버퍼/콘솔에서 가려진다', async ({ page }) => {
  const c = collectConsole(page)
  await page.goto('/err-secret')
  await expect.poll(async () => (await vzErrors(page)).some((e) => e.code === 'E_RUNTIME')).toBe(true)
  const entry = byCode(await vzErrors(page), 'E_RUNTIME')
  expect(entry.message).toContain('[jwt]')
  expect(JSON.stringify(entry)).not.toContain('eyJ')
  expect(c.errors.find((e) => e.includes('E_RUNTIME')).split('\n')[0]).not.toContain('eyJ')
})

test('링 버퍼: 최대 50개, 오래된 것부터 버린다', async ({ page }) => {
  const names = ['div', 'span', 'p', 'a', 'br', 'hr', 'img', 'input', 'button', 'select', 'option', 'textarea', 'form', 'label', 'fieldset', 'legend', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'nav', 'section', 'article', 'aside', 'details', 'summary', 'dialog', 'figure', 'figcaption', 'video', 'audio', 'source', 'canvas', 'svg', 'iframe', 'embed', 'object', 'pre', 'code']
  expect(names.length).toBe(60)
  await page.route('**/pages/pages.json', (r) => r.fulfill({ json: ['index', ...names] }))
  await page.goto('/')
  await appMounted(page)
  const list = await vzErrors(page)
  expect(list).toHaveLength(50)
  expect(list.every((e) => e.code === 'E_RESERVED_TAG')).toBe(true)
  expect(list[49].file).toBe('/pages/code.vue')   // 가장 최근
  expect(list[0].file).toBe('/pages/' + names[10] + '.vue')  // 앞의 10개는 밀려남
})

test('errors() 는 사본을 돌려준다 (바깥에서 바꿔도 버퍼는 그대로)', async ({ page }) => {
  await page.route('**/pages/pages.json', (r) => r.fulfill({ json: ['index', 'table'] }))
  await page.goto('/')
  await appMounted(page)
  const n = await page.evaluate(() => { const a = window.VueZero.errors(); a.length = 0; return window.VueZero.errors().length })
  expect(n).toBe(1)
})

test.describe('Vue dev/prod 빌드 안내와 dev 경고 수집', () => {
  const devVue = () => readFileSync(new URL('../../../node_modules/vue/dist/vue.global.js', import.meta.url))

  test('prod Vue + localhost: console.info 안내가 1회 나온다 (이동해도 반복 안 함)', async ({ page }) => {
    const msgs = collectMessages(page)
    await page.goto('/')
    await appMounted(page)
    await spaPush(page, '/about')
    await expect(page.getByTestId('page')).toHaveText('About')
    const infos = msgs.filter((m) => m.type() === 'info' && m.text().includes('[vue-zero]') && m.text().includes('dev build'))
    expect(infos).toHaveLength(1)
  })

  test('prod Vue 라도 localhost 가 아니면 안내하지 않는다', async ({ page, baseURL }) => {
    const msgs = collectMessages(page)
    await page.route('http://app.example.test/**', async (route) => {
      const u = new URL(route.request().url())
      await route.fulfill({ response: await route.fetch({ url: baseURL + u.pathname + u.search }) })
    })
    await page.goto('http://app.example.test/')
    await appMounted(page)
    expect(msgs.filter((m) => m.text().includes('dev build'))).toHaveLength(0)
  })

  test('dev Vue: 안내 없음, 템플릿 경고(미등록 컴포넌트)가 파일명과 함께 errors() 에 담긴다', async ({ page }) => {
    const msgs = collectMessages(page)
    await page.route('**/lib/vue.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: devVue() }))
    await page.goto('/err-unknown-comp')
    await expect(page.getByTestId('page')).toHaveText('err-unknown-comp')
    await expect.poll(async () => (await vzErrors(page)).some((e) => e.code === 'E_VUE_WARN' && /nope-widget/.test(e.message))).toBe(true)
    const w = (await vzErrors(page)).find((e) => e.code === 'E_VUE_WARN' && /nope-widget/.test(e.message))
    expect(w).toMatchObject({ stage: 'render', file: '/pages/err-unknown-comp.vue', level: 'warn' })
    expect(msgs.filter((m) => m.text().includes('vue.global.js'))).toHaveLength(0)
  })
})
