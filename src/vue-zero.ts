import { RouteScanner } from './core/RouteScanner'
import { ComponentLoader } from './core/ComponentLoader'
import { AuthGuard } from './core/AuthGuard'
import { parseSfc, getStyleInjector } from './core/SfcParser'

declare const Vue: typeof import('vue')
declare const VueRouter: typeof import('vue-router')

export interface CreateAppOptions {
  baseDir?: string
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

  // 1. components.json + pages.json 병렬 fetch
  const [compNames, records] = await Promise.all([
    componentLoader.readManifest(),
    routeScanner.scan(),
  ])

  // 2. 전역 컴포넌트 로드
  const globalComponents = await componentLoader.loadAll(compNames)

  if (records.length === 0) {
    console.warn('[vue-zero] No pages found. Create pages/pages.json: ["index", "about", ...]')
  }

  // 3. 캐시
  const sfcCache = new Map<string, Awaited<ReturnType<typeof parseSfc>>>()
  const componentCache = new Map<string, ReturnType<typeof Vue.defineComponent>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layoutComponentCache = new Map<string, any>()
  const layoutNameCache = new Map<string, string | false>()
  const titleCache = new Map<string, string | null>()
  const requiresAuthCache = new Map<string, boolean>()
  const recordByName = new Map(records.map(r => [r.name, r]))

  // 4. SFC/컴포넌트 로더
  async function loadSfc(name: string, filePath: string) {
    if (sfcCache.has(name)) return sfcCache.get(name)!
    const sfc = await parseSfc(filePath, `page-${name}`, 'page')
    sfcCache.set(name, sfc)
    return sfc
  }

  function buildPageComponent(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sfc: { template: string; componentOptions: any },
  ) {
    if (componentCache.has(name)) return componentCache.get(name)!

    const comp = Vue.defineComponent({
      ...sfc.componentOptions,
      name,
      template: sfc.template,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      components: globalComponents as any,
    })
    componentCache.set(name, comp)

    // 페이지 메타 캐시 (layout, title, requiresAuth)
    const opts = sfc.componentOptions as Record<string, unknown>
    const layoutOption = opts.layout
    layoutNameCache.set(name, layoutOption === false ? false : (layoutOption as string) ?? 'default')
    titleCache.set(name, (opts.title as string) ?? null)
    requiresAuthCache.set(name, !!opts.requiresAuth)

    return comp
  }

  async function loadLayoutComponent(name: string) {
    if (layoutComponentCache.has(name)) return layoutComponentCache.get(name)
    const url = `${layoutsDir}/${name}.vue`
    try {
      const { template, componentOptions } = await parseSfc(url, `layout-${name}`, 'layout')
      const layoutTemplate = template
        .replace(/<slot\s*\/>/, '<router-view />')
        .replace(/<slot><\/slot>/, '<router-view />')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp = Vue.defineComponent({
        ...(componentOptions as any),
        name: `layout-${name}`,
        template: layoutTemplate,
        components: globalComponents as any,
      })
      layoutComponentCache.set(name, comp)
      return comp
    } catch {
      console.warn(`[vue-zero] layout "${name}.vue" not found — rendering page without layout`)
      layoutComponentCache.set(name, null)
      return null
    }
  }

  // 5. 라우트 배열 생성
  const notFoundUrl = `${pagesDir}/404.vue`
  const has404 = (await fetch(notFoundUrl, { method: 'HEAD' })).ok

  const routes: import('vue-router').RouteRecordRaw[] = records.map(record => ({
    path: record.path,
    name: record.name,
    component: async () => {
      const sfc = await loadSfc(record.name, record.filePath)
      return buildPageComponent(record.name, sfc)
    },
  }))

  if (has404) {
    routes.push({
      path: '/:pathMatch(.*)*',
      name: '404',
      component: async () => {
        const sfc = await loadSfc('404', notFoundUrl)
        return buildPageComponent('404', sfc)
      },
    })
  }

  // 6. 라우터 생성
  const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes,
  })

  // 7. 페이지 전환 전에 리소스 준비 (SFC, 레이아웃)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLayout = Vue.shallowRef(null as any)
  const currentLayoutName = Vue.ref('__pending__')

  router.beforeEach(async (to) => {
    progress.start()

    const name = String(to.name)
    const record = recordByName.get(name)

    try {
      // 페이지 SFC 로드 + 컴포넌트 빌드
      if (record) {
        const sfc = await loadSfc(record.name, record.filePath)
        buildPageComponent(name, sfc)
      } else if (name === '404' && has404) {
        const sfc = await loadSfc('404', notFoundUrl)
        buildPageComponent('404', sfc)
      }

      // 레이아웃 로드
      const layoutName = layoutNameCache.get(name)
      if (layoutName === false) {
        currentLayout.value = null
        currentLayoutName.value = '__none__'
      } else {
        const resolved = layoutName ?? 'default'
        const comp = await loadLayoutComponent(resolved)
        currentLayout.value = comp
        currentLayoutName.value = resolved
      }

      // 스타일 전환
      styleInjector.switchPage(`page-${name}`)

      // title
      const title = titleCache.get(name)
      if (title) document.title = title

      // 인증 가드
      if (authGuard.isEnabled() && requiresAuthCache.get(name) && !authGuard.isAuthenticated()) {
        progress.done()
        return authGuard.getLoginPage()
      }
    } catch (err) {
      console.error(`[vue-zero] 페이지 로드 실패: ${to.fullPath}`, err)
      progress.done()
      return false
    }
  })

  router.afterEach(() => {
    progress.done()
  })

  router.onError((err) => {
    console.error('[vue-zero] navigation error:', err)
  })

  // 8. LayoutWrapper + 앱 마운트
  const LayoutWrapper = Vue.defineComponent({
    name: 'LayoutWrapper',
    setup() {
      return { currentLayout, currentLayoutName }
    },
    template: `
      <component v-if="currentLayout" :is="currentLayout" :key="currentLayoutName" />
      <router-view v-else-if="currentLayoutName !== '__pending__'" />
    `,
  })

  const app = Vue.createApp({
    template: '<LayoutWrapper />',
    components: { LayoutWrapper },
  })
  app.use(router)

  app.config.errorHandler = (err, instance, info) => {
    console.error(`[vue-zero] runtime error (${info}):`, err)
  }

  Object.entries(globalComponents).forEach(([name, comp]) => {
    app.component(name, comp as Parameters<typeof app.component>[1])
  })

  await router.isReady()
  app.mount('#app')
}
