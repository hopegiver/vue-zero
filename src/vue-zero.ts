import { RouteScanner } from './core/RouteScanner'
import { ComponentLoader } from './core/ComponentLoader'
import { AuthGuard } from './core/AuthGuard'
import { parseSfc, getStyleInjector } from './core/SfcParser'

declare const Vue: typeof import('vue')
declare const VueRouter: typeof import('vue-router')

export interface CreateAppOptions {
  pagesDir?: string
  componentsDir?: string
  layoutsDir?: string
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
      console.error(`[vue-zero] "${key}" must use "/" as separator (got: "${val}")`)
    }
  }
  if (options.auth && !options.auth.enabled) {
    if (options.auth.loginPage || options.auth.tokenKey) {
      console.warn('[vue-zero] auth options are set but "enabled" is false — auth guard will not run')
    }
  }
}

export async function createApp(options: CreateAppOptions = {}): Promise<void> {
  validateOptions(options)

  const pagesDir = (options.pagesDir ?? 'pages').replace(/\/$/, '')
  const componentsDir = (options.componentsDir ?? 'components').replace(/\/$/, '')
  const layoutsDir = (options.layoutsDir ?? 'layouts').replace(/\/$/, '')

  const authGuard = new AuthGuard(options.auth)
  const componentLoader = new ComponentLoader(componentsDir)
  const routeScanner = new RouteScanner(pagesDir)

  // 1. components.json + pages.json 병렬 fetch
  const [compNames, records] = await Promise.all([
    componentLoader.readManifest(),
    routeScanner.scan(),
  ])

  // 2. 전역 컴포넌트 로드 (pages.json 결과와 무관하게 병렬 처리됨)
  const globalComponents = await componentLoader.loadAll(compNames)

  // 3. 레이아웃 로드 (캐시)
  const layoutCache = new Map<string, string | null>()
  async function loadLayout(name: string): Promise<string | null> {
    if (layoutCache.has(name)) return layoutCache.get(name)!
    const url = `${layoutsDir}/${name}.vue`
    try {
      const { template } = await parseSfc(url, `layout-${name}`, 'layout')
      layoutCache.set(name, template)
      return template
    } catch {
      layoutCache.set(name, null)
      return null
    }
  }

  if (records.length === 0) {
    console.warn('[vue-zero] No pages found. Create pages/pages.json: ["index", "about", ...]')
  }

  // 4. Vue Router 라우트 배열 생성 — SFC는 실제 라우팅 시점에 lazy 로드
  const sfcCache = new Map<string, Awaited<ReturnType<typeof parseSfc>>>()
  const componentCache = new Map<string, ReturnType<typeof Vue.defineComponent>>()
  const requiresAuthCache = new Map<string, boolean>()  // 라우트명 → requiresAuth (첫 방문 후 고정)
  const titleCache = new Map<string, string | null>()   // 라우트명 → title (첫 방문 후 고정)
  const recordByName = new Map(records.map(r => [r.name, r]))
  const styleInjector = getStyleInjector()

  async function loadSfc(record: (typeof records)[number]) {
    if (sfcCache.has(record.name)) return sfcCache.get(record.name)!
    try {
      const sfc = await parseSfc(record.filePath, `page-${record.name}`, 'page')
      sfcCache.set(record.name, sfc)
      return sfc
    } catch {
      console.error(`[vue-zero] pages.json에 "${record.name}"이 등록되어 있지만 파일을 찾을 수 없습니다: ${record.filePath}`)
      throw new Error(`page not found: ${record.filePath}`)
    }
  }

  const routes: import('vue-router').RouteRecordRaw[] = records.map(record => ({
    path: record.path,
    name: record.name,
    component: async () => {
      if (componentCache.has(record.name)) return componentCache.get(record.name)!

      const { template, style, componentOptions } = await loadSfc(record)

      if (style) {
        styleInjector.inject(style, `page-${record.name}`, 'page')
      }

      const layoutName: string = (componentOptions as Record<string, unknown>).layout as string ?? 'default'
      const layoutTemplate = await loadLayout(layoutName)

      let finalTemplate = template
      if (layoutTemplate) {
        if (layoutTemplate.includes('<slot />') || layoutTemplate.includes('<slot/>')) {
          finalTemplate = layoutTemplate.replace(/<slot\s*\/>/, template)
        } else {
          console.warn(`[vue-zero] layout "${layoutName}.vue" has no <slot /> — appending page after layout`)
          finalTemplate = layoutTemplate + template
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const component = Vue.defineComponent({
        ...(componentOptions as any),
        name: record.name,
        template: finalTemplate,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        components: globalComponents as any,
      })
      componentCache.set(record.name, component)
      return component
    },
  }))

  // 5. 라우터 생성
  const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
  })

  // 6. 페이지 전환 시 스타일 전환 + title 설정 + 인증 가드
  router.beforeEach(async (to) => {
    styleInjector.switchPage(`page-${String(to.name)}`)

    const name = String(to.name)
    const record = recordByName.get(name)

    if (record && (!titleCache.has(name) || !requiresAuthCache.has(name))) {
      const sfc = await loadSfc(record)
      const opts = sfc.componentOptions as Record<string, unknown>
      if (!titleCache.has(name)) titleCache.set(name, (opts.title as string) ?? null)
      if (!requiresAuthCache.has(name)) requiresAuthCache.set(name, !!opts.requiresAuth)
    }

    const title = titleCache.get(name)
    if (title) document.title = title

    if (authGuard.isEnabled() && requiresAuthCache.get(name) && !authGuard.isAuthenticated()) {
      return authGuard.getLoginPage()
    }
  })

  // 7. Vue 앱 마운트
  const app = Vue.createApp({})
  app.use(router)

  // 전역 컴포넌트 등록
  Object.entries(globalComponents).forEach(([name, comp]) => {
    app.component(name, comp as Parameters<typeof app.component>[1])
  })

  app.mount('#app')
}
