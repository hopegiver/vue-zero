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

  // 1. 전역 컴포넌트 로드 — components.json
  const compNames = await componentLoader.readManifest()
  const globalComponents = await componentLoader.loadAll(compNames)

  // 2. 레이아웃 로드 (캐시)
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

  // 3. 라우트 목록 확보 — pages.json
  const records = await routeScanner.scan()

  if (records.length === 0) {
    console.warn('[vue-zero] No pages found. Create pages/pages.json: ["index", "about", ...]')
  }

  // 4. 모든 페이지 SFC를 미리 파싱 — requiresAuth/layout을 라우트 등록 전에 확보
  const sfcCache = new Map<string, Awaited<ReturnType<typeof parseSfc>>>()
  await Promise.all(records.map(async record => {
    try {
      sfcCache.set(record.name, await parseSfc(record.filePath, `page-${record.name}`, 'page'))
    } catch (e) {
      console.error(`[vue-zero] failed to load page "${record.filePath}"`, e)
    }
  }))

  // 5. Vue Router 라우트 배열 생성 (컴포넌트 캐시)
  const componentCache = new Map<string, ReturnType<typeof Vue.defineComponent>>()
  const styleInjector = getStyleInjector()
  const routes: import('vue-router').RouteRecordRaw[] = records.map(record => {
    const sfc = sfcCache.get(record.name)
    const opts = sfc?.componentOptions as Record<string, unknown> ?? {}
    return {
      path: record.path,
      name: record.name,
      meta: { requiresAuth: !!opts.requiresAuth },
      component: async () => {
        if (componentCache.has(record.name)) return componentCache.get(record.name)!

        const { template, style, componentOptions } = sfcCache.get(record.name)!

        // 페이지 스타일 미리 주입 (캐시 이후엔 inject가 no-op)
        if (style) {
          styleInjector.inject(style, `page-${record.name}`, 'page')
        }

        // 레이아웃 결정
        const layoutName: string = (componentOptions as Record<string, unknown>).layout as string ?? 'default'
        const layoutTemplate = await loadLayout(layoutName)

        // 레이아웃 + 페이지 template 합성: <slot /> 위치에 삽입
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
    }
  })

  // 5. 라우터 생성
  const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
  })

  // 6. 페이지 전환 시 이전 페이지 스타일 전환 + 인증 가드
  router.beforeEach((to) => {
    styleInjector.switchPage(`page-${String(to.name)}`)

    if (authGuard.isEnabled()) {
      if (to.meta.requiresAuth && !authGuard.isAuthenticated()) {
        return authGuard.getLoginPage()
      }
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
