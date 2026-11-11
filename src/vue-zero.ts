import { RouteScanner } from './core/RouteScanner'
import { ComponentLoader } from './core/ComponentLoader'
import { AuthGuard } from './core/AuthGuard'
import { parseSfc, getStyleInjector, net } from './core/SfcParser'
import { shared, type Inflight } from './core/Inflight'
import { loadManifest, createPersistentCache, isDevHost } from './core/Manifest'
import { report, reportCaught, errors as diagErrors, VzError } from './core/Diagnostics'

declare const Vue: typeof import('vue')
declare const VueRouter: typeof import('vue-router')
declare const __VZ_VERSION__: string

export const version: string = __VZ_VERSION__
/** 최근 진단(에러·경고) 링 버퍼 사본 (최대 50개). 경로·상태코드만 담고 토큰/사용자 데이터는 담지 않는다. */
export const errors = diagErrors

export interface CreateAppOptions {
  baseDir?: string
  pagesDir?: string
  componentsDir?: string
  layoutsDir?: string
  /** true 또는 매니페스트 경로 — vz-manifest.json 을 쓴다(기본 off) */
  manifest?: boolean | string
  auth?: {
    enabled?: boolean
    loginPage?: string
    tokenKey?: string  // localStorage 키 (기본값: 'token')
  }
}

function validateOptions(options: CreateAppOptions): void {
  for (const key of ['pagesDir', 'componentsDir', 'layoutsDir'] as const) {
    const val = options[key]
    if (val !== undefined && val.includes('\\')) {
      report({ code: 'E_OPTION_INVALID', stage: 'config', file: '', message: `"${key}" must use "/" as separator (got: "${val}")`, hint: `use "/" in createApp({ ${key} })` })
    }
  }
  if (options.auth && !options.auth.enabled) {
    if (options.auth.loginPage || options.auth.tokenKey) {
      report({ code: 'E_AUTH_CONFIG', stage: 'config', file: '', message: 'auth options are set but "enabled" is false — auth guard will not run', hint: 'set auth: { enabled: true }' }, 'warn')
    }
  }
}

const PROGRESS_STYLE = `
.vue-zero-progress {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 99999;
  background: #42b883; transform-origin: left; transform: scaleX(0);
  transition: transform 0.2s ease; pointer-events: none;
}
.vue-zero-progress.loading { transform: scaleX(0.8); transition: transform 8s cubic-bezier(0.1, 0.05, 0, 1); }
.vue-zero-progress.done { transform: scaleX(1); opacity: 0; transition: transform 0.1s ease, opacity 0.4s ease 0.1s; }
`

function createProgressBar(): { start: () => void; done: () => void } {
  const style = document.createElement('style')
  style.textContent = PROGRESS_STYLE
  document.head.appendChild(style)

  const bar = document.createElement('div')
  bar.className = 'vue-zero-progress'
  document.body.appendChild(bar)

  return {
    start() {
      bar.className = 'vue-zero-progress'
      void bar.offsetWidth
      bar.classList.add('loading')
    },
    done() {
      bar.classList.remove('loading')
      bar.classList.add('done')
    },
  }
}

// 컴포넌트 인스턴스 → 정의된 .vue 파일 경로 (옵션의 __file, 없으면 부모를 거슬러 올라간다)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fileOf(instance: any): string {
  for (let i = instance?.$; i; i = i.parent) {
    if (i.type?.__file) return String(i.type.__file)
  }
  return ''
}

function lineFromStack(err: unknown, file: string): number | undefined {
  const stack = err instanceof Error ? err.stack : undefined
  const at = file && stack ? stack.indexOf(file + ':') : -1
  if (at < 0) return undefined
  const m = /^\d+/.exec(stack!.slice(at + file.length + 1))
  return m ? Number(m[0]) : undefined
}

// prod 빌드의 Vue.warn 은 NOOP(인자 0개)이라 템플릿 경고(미등록 컴포넌트·미정의 속성 등)가 전부 사라진다
function hintDevBuild(): void {
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|.+\.localhost)$/.test(location.hostname)
  if (local && typeof Vue.warn === 'function' && Vue.warn.length === 0) {
    console.info('[vue-zero] Vue prod build: template warnings (unknown components, undefined properties) are hidden. Load vue.global.js (dev build) in development to see them.')
  }
}

export async function createApp(options: CreateAppOptions = {}): Promise<void> {
  validateOptions(options)

  const baseDir = (options.baseDir ?? '/').replace(/\/$/, '')
  const pagesDir = baseDir + '/' + (options.pagesDir ?? 'pages').replace(/^\//, '').replace(/\/$/, '')
  const componentsDir = baseDir + '/' + (options.componentsDir ?? 'components').replace(/^\//, '').replace(/\/$/, '')
  const layoutsDir = baseDir + '/' + (options.layoutsDir ?? 'layouts').replace(/^\//, '').replace(/\/$/, '')

  const authGuard = new AuthGuard(options.auth)
  const componentLoader = new ComponentLoader(componentsDir)
  const routeScanner = new RouteScanner(pagesDir)
  const styleInjector = getStyleInjector()
  const progress = createProgressBar()

  const notFoundUrl = `${pagesDir}/404.vue`
  const errorUrl = `${pagesDir}/error.vue`

  // 1. 매니페스트(옵트인, 항상 재검증) 또는 components.json + pages.json 병렬 fetch (404.vue/error.vue 는 필요할 때 처음 받는다)
  const manifestUrl = typeof options.manifest === 'string' ? options.manifest : baseDir + '/vz-manifest.json'
  const manifest = options.manifest ? await loadManifest(manifestUrl) : null
  const [compNames, records] = manifest
    ? [manifest.components, routeScanner.toRecords(manifest.pages, manifestUrl)]
    : await Promise.all([componentLoader.readManifest(), routeScanner.scan()])

  // 매니페스트 files/deps 의 키(pages/x.vue, components/X.vue, layouts/y.vue)를 실제 요청 URL 로 바꾼다
  const dirOf: Record<string, string> = { pages: pagesDir, components: componentsDir, layouts: layoutsDir }
  const urlOf = (key: string) => {
    const m = /^(pages|components|layouts)(\/.+)$/.exec(key)
    return m ? dirOf[m[1]] + m[2] : ''
  }
  const hashes = new Map<string, string>()
  const depsOf = new Map<string, NonNullable<NonNullable<typeof manifest>['deps']>[string]>()
  if (manifest) {
    for (const [k, h] of Object.entries(manifest.files ?? {})) if (urlOf(k) && /^[\w-]{1,64}$/.test(h)) hashes.set(urlOf(k), h)
    for (const [k, d] of Object.entries(manifest.deps ?? {})) if (urlOf(k) && d) depsOf.set(urlOf(k), d)
  }
  // 영속 캐시: prod 호스트 + Cache Storage 지원일 때만 (dev 는 파일이 수시로 바뀌므로 해시를 쓰지 않는다)
  const persist = hashes.size && !isDevHost() && typeof caches !== 'undefined'
    ? createPersistentCache(hashes, [pagesDir, componentsDir, layoutsDir], __VZ_VERSION__) : null
  if (persist) net.get = persist.get

  // 2. 전역 컴포넌트 등록 (지연 로딩 — 여기서는 fetch하지 않음)
  const globalComponents = componentLoader.createAsyncComponents(compNames)

  if (records.length === 0) {
    report({ code: 'E_NO_PAGES', stage: 'manifest', file: `${pagesDir}/pages.json`, message: 'No pages found', hint: 'Create pages/pages.json: ["index", "about", ...]' }, 'warn')
  }

  // 3. 캐시
  const sfcCache = new Map<string, Awaited<ReturnType<typeof parseSfc>>>()
  const componentCache = new Map<string, ReturnType<typeof Vue.defineComponent>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layoutComponentCache = new Map<string, any>()
  const layoutNameCache = new Map<string, string | false>()
  const titleCache = new Map<string, string | null>()
  const authCache = new Map<string, boolean>()  // true = 보호, false = 공개
  const recordByName = new Map(records.map(r => [r.name, r]))

  // 4. SFC/컴포넌트 로더 — 같은 파일의 동시 요청은 진행 중인 Promise 로 합치고, 실패하면 맵에서 지워 다시 시도할 수 있게 한다
  const sfcInflight = new Map<string, Promise<Awaited<ReturnType<typeof parseSfc>>>>()
  function loadSfc(name: string, filePath: string) {
    const cached = sfcCache.get(name)
    if (cached) return Promise.resolve(cached)
    let pending = sfcInflight.get(name)
    if (!pending) {
      pending = parseSfc(filePath, `page-${name}`, 'page')
        .then(sfc => { sfcCache.set(name, sfc); return sfc })
        .finally(() => sfcInflight.delete(name))
      sfcInflight.set(name, pending)
    }
    return pending
  }

  // 404.vue/error.vue 는 처음 필요할 때 받는다. 파일이 없다(404)는 사실만 캐시해 다시 요청하지 않는다
  let notFoundAbsent = false
  let errorPageAbsent = false
  async function loadSpecial(name: '404' | 'error') {
    if (name === '404' ? notFoundAbsent : errorPageAbsent) return null
    const url = name === '404' ? notFoundUrl : errorUrl
    try {
      return await loadSfc(name, url)
    } catch (e) {
      if (!(e instanceof VzError && e.status === 404)) throw e
      if (name === '404') {
        notFoundAbsent = true
        report({ code: 'E_NOT_FOUND_PAGE', stage: 'load', file: url, message: '404.vue not found — unmatched URLs render an empty page', hint: `create ${url} (optional)` }, 'warn')
      } else errorPageAbsent = true
      return null
    }
  }

  function buildPageComponent(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sfc: { template: string; componentOptions: any },
    file: string,
  ) {
    if (componentCache.has(name)) return componentCache.get(name)!

    const comp = Vue.defineComponent({
      ...sfc.componentOptions,
      name,
      template: sfc.template,
      __file: file,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      components: globalComponents as any,
    })
    componentCache.set(name, comp)

    // 페이지 메타 캐시 (layout, title, auth)
    const opts = sfc.componentOptions as Record<string, unknown>
    const layoutOption = opts.layout
    layoutNameCache.set(name, layoutOption === false ? false : (layoutOption as string) ?? 'default')
    titleCache.set(name, (opts.title as string) ?? null)
    authCache.set(name, opts.auth !== false)  // auth: false 인 페이지만 공개, 나머지는 보호

    return comp
  }

  const layoutInflight: Inflight<unknown> = new Map()
  function loadLayoutComponent(name: string, quiet = false): Promise<unknown> {
    if (layoutComponentCache.has(name)) return Promise.resolve(layoutComponentCache.get(name))
    return shared(layoutInflight, name, q => fetchLayout(name, q), quiet)
  }

  async function fetchLayout(name: string, quiet: boolean) {
    const url = `${layoutsDir}/${name}.vue`
    try {
      const { template, componentOptions } = await parseSfc(url, `layout-${name}`, 'layout')
      await componentLoader.preload(template)
      const layoutTemplate = template
        .replace(/<slot\s*\/>/, '<router-view />')
        .replace(/<slot><\/slot>/, '<router-view />')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp = Vue.defineComponent({
        ...(componentOptions as any),
        name: `layout-${name}`,
        template: layoutTemplate,
        __file: url,
        components: globalComponents as any,
      })
      layoutComponentCache.set(name, comp)
      return comp
    } catch (e) {
      if (quiet) throw e  // 힌트 요청의 실패는 보고·캐시하지 않는다
      if (e instanceof VzError && e.status === 404) {
        // 파일이 없다는 것(404)만 영구 캐시한다. 5xx/네트워크/스크립트 오류는 다음 이동에서 다시 시도한다.
        reportCaught(e, e.diag, { code: 'E_LAYOUT_NOT_FOUND', message: `layout "${name}.vue" not found — rendering page without layout`, hint: `create ${url} or fix the page layout option` }, 'warn')
        layoutComponentCache.set(name, null)
      } else {
        const fallback = { code: 'E_LAYOUT_FETCH', stage: 'load' as const, file: url, message: `layout "${name}.vue" load failed`, hint: `check ${url}` }
        reportCaught(e, fallback, e instanceof VzError ? { message: `layout "${name}.vue": ${e.diag.message} — rendering page without layout` } : undefined)
      }
      return null
    }
  }

  // 매니페스트 deps 힌트: 페이지 SFC 와 레이아웃·의존 컴포넌트를 동시에 요청 시작한다 (틀려도 정규 경로가 그대로 동작)
  function startDeps(file: string) {
    const d = depsOf.get(file)
    if (!d) return
    if (typeof d.layout === 'string') loadLayoutComponent(d.layout, true).catch(() => {})
    if (Array.isArray(d.components)) componentLoader.prefetch(d.components)
  }

  // 5. 라우트 배열 생성
  const routes: import('vue-router').RouteRecordRaw[] = records.map(record => ({
    path: record.path,
    name: record.name,
    component: async () => {
      const sfc = await loadSfc(record.name, record.filePath)
      return buildPageComponent(record.name, sfc, record.filePath)
    },
  }))

  routes.push({
    path: '/:pathMatch(.*)*',
    name: '404',
    component: async () => {
      const sfc = await loadSpecial('404')
      return sfc ? buildPageComponent('404', sfc, notFoundUrl) : { render: () => null }
    },
  })

  // 6. 라우터 생성
  const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
      return savedPosition || { top: 0 }
    },
  })

  // 7. 페이지 전환 전에 리소스 준비 (SFC, 레이아웃)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLayout = Vue.shallowRef(null as any)
  const currentLayoutName = Vue.ref('__pending__')
  const currentError = Vue.shallowRef(null as any)

  // 이동마다 번호를 매겨, 대기(await) 사이에 더 새로운 이동이 시작되면 이전 이동은 상태를 건드리지 않는다
  let navSeq = 0
  let loginReported = false

  router.beforeEach(async (to) => {
    const seq = ++navSeq
    const isStale = () => seq !== navSeq
    progress.start()
    currentError.value = null

    const name = String(to.name)
    const record = recordByName.get(name)
    const file = record ? record.filePath : name === '404' ? notFoundUrl : ''

    // 미인증 사용자에게는 인증 판단 전에 레이아웃·컴포넌트를 요청하지 않는다 (인증 판단은 SFC 의 auth 옵션을 읽어야 한다)
    const early = !authGuard.isEnabled() || authGuard.isAuthenticated()
    if (early) startDeps(file)

    try {
      // 페이지 SFC 로드(파싱까지) + 컴포넌트 빌드
      let sfc: Awaited<ReturnType<typeof parseSfc>> | undefined
      if (record) sfc = await loadSfc(record.name, record.filePath)
      else if (name === '404') sfc = (await loadSpecial('404')) ?? undefined
      if (sfc) buildPageComponent(name, sfc, file)
      if (isStale()) return  // 라우터가 취소 처리한다

      // 인증 가드 — 보호 페이지는 컴포넌트·레이아웃을 받기 전에 돌려보낸다
      if (authGuard.isEnabled() && authCache.get(name) && !authGuard.isAuthenticated()) {
        const loginPage = authGuard.getLoginPage()
        if (router.resolve(loginPage).path !== to.path) {
          progress.done()
          return loginPage
        }
        // 로그인 페이지로 해석되는 바로 이 경로의 이동만 통과시켜(공개 취급) 리다이렉트 반복을 끊는다 — 같은 라우트의 다른 경로는 계속 로그인으로 보낸다
        if (!loginReported) {
          loginReported = true
          if (name === '404') report({ code: 'E_LOGIN_PAGE_MISSING', stage: 'auth', file: `${pagesDir}/pages.json`, message: `loginPage "${loginPage}" matches no page — redirect loop`, hint: `Add a login page to pages.json with auth: false (404 treated as public meanwhile)` })
          else report({ code: 'E_LOGIN_PAGE_PROTECTED', stage: 'auth', file, message: `loginPage "${loginPage}" is a protected page — redirect loop`, hint: `add auth: false to ${file} (export default { auth: false }); it is treated as public meanwhile` })
        }
      }

      if (!early) startDeps(file)

      // 페이지 템플릿이 쓰는 컴포넌트 미리 받기
      if (sfc) await componentLoader.preload(sfc.template)
      if (isStale()) return

      // 레이아웃 로드
      const layoutName = layoutNameCache.get(name)
      if (layoutName === false) {
        currentLayout.value = null
        currentLayoutName.value = '__none__'
      } else {
        const resolved = layoutName ?? 'default'
        const comp = await loadLayoutComponent(resolved)
        if (isStale()) return
        currentLayout.value = comp
        currentLayoutName.value = resolved
      }

      // 스타일 전환
      styleInjector.switchPage(`page-${name}`)

      // title
      const title = titleCache.get(name)
      if (title) document.title = title
    } catch (err) {
      reportCaught(err, { code: 'E_PAGE_LOAD', stage: 'load', file, message: 'page load failed', hint: `check ${file || to.path}` }, err instanceof VzError ? { message: `${err.diag.message} (route ${to.path})` } : undefined)
      if (isStale()) return
      try {
        const errorSfc = await loadSpecial('error')
        if (errorSfc) {
          await componentLoader.preload(errorSfc.template)
          if (isStale()) return
          currentError.value = buildPageComponent('error', errorSfc, errorUrl)
          styleInjector.switchPage('page-error')
        }
      } catch (errorPageErr) {
        reportCaught(errorPageErr, { code: 'E_ERROR_PAGE', stage: 'load', file: errorUrl, message: 'error.vue load failed', hint: `check ${errorUrl}` })
      }
      progress.done()
      return false
    }
  })

  router.afterEach((to, _from, failure) => {
    // 취소된 이동이 늦게 끝나도 최신 이동의 진행 바를 끝내지 않는다
    if (failure && VueRouter.isNavigationFailure(failure, VueRouter.NavigationFailureType.cancelled)) return
    // 실패 화면이 떠 있는 채로 현재 URL 로 다시 이동하면(duplicated) beforeEach 가 돌지 않으므로 여기서 실패 화면을 걷는다
    if (failure && VueRouter.isNavigationFailure(failure, VueRouter.NavigationFailureType.duplicated) && currentError.value) {
      currentError.value = null
      styleInjector.switchPage(`page-${String(to.name)}`)
    }
    progress.done()
  })

  router.onError((err) => {
    if (err instanceof VzError && err.reported) return
    report({ code: 'E_ROUTE', stage: 'route', file: '', message: `navigation error: ${err instanceof Error ? err.message : String(err)}`, hint: 'exception during navigation; check page scripts' })
  })

  // 8. LayoutWrapper + 앱 마운트
  const LayoutWrapper = Vue.defineComponent({
    name: 'LayoutWrapper',
    setup() {
      return { currentLayout, currentLayoutName, currentError }
    },
    template: `
      <component v-if="currentError" :is="currentError" />
      <component v-else-if="currentLayout" :is="currentLayout" :key="currentLayoutName" />
      <router-view v-else-if="currentLayoutName !== '__pending__'" />
    `,
  })

  const app = Vue.createApp({
    template: '<LayoutWrapper />',
    components: { LayoutWrapper },
  })
  app.use(router)

  app.config.errorHandler = (err, instance, info) => {
    if (err instanceof VzError && err.reported) return
    const file = fileOf(instance)
    const msg = err instanceof Error ? err.message : String(err)
    // info: dev 는 'render function' 같은 문구, prod 는 'https://vuejs.org/error-reference/#runtime-<코드>' (render function = 1) — 번호표를 두지 않고 원문을 쓴다
    const isRender = /^render function|#runtime-1$/.test(info)
    report({
      code: isRender ? 'E_RENDER' : 'E_RUNTIME',
      stage: 'render',
      file,
      line: lineFromStack(err, file),
      message: `${msg} (${info})`,
      hint: isRender ? 'template uses an undefined/null data, computed or prop' : 'see file:line in the stack',
    }, 'error', err)
  }

  // dev 빌드의 Vue 경고도 파일명과 함께 버퍼에 담는다 (prod 빌드에서는 호출되지 않는다)
  app.config.warnHandler = (msg, instance) => {
    report({ code: 'E_VUE_WARN', stage: 'render', file: fileOf(instance), message: msg, hint: 'check the component template/props/registration' }, 'warn')
  }

  hintDevBuild()

  Object.entries(globalComponents).forEach(([name, comp]) => {
    app.component(name, comp as Parameters<typeof app.component>[1])
  })

  await router.isReady().catch(() => {})
  app.mount('#app')
  if (persist) {
    const ric = (window as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => void }).requestIdleCallback
    if (ric) ric(persist.sweep, { timeout: 1000 })
    else setTimeout(persist.sweep, 1000)
  }
}
