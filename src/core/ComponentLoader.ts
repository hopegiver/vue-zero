import { parseSfc } from './SfcParser'
import { reportCaught } from './Diagnostics'
import { shared, type Inflight } from './Inflight'

declare const Vue: typeof import('vue')

/**
 * components/components.json 에 선언된 전역 컴포넌트를 지연 로딩으로 등록.
 *
 * components.json 예시: ["AppButton", "UserCard"]
 * 각 컴포넌트는 componentsDir/Name.vue 파일로 존재해야 함.
 *
 * 앱 시작 시에는 fetch하지 않고, 페이지/레이아웃 템플릿에서 사용된 컴포넌트만
 * preload()로 미리 받는다. 템플릿에서 찾지 못한 동적 사용(<component :is>)은
 * defineAsyncComponent가 렌더 시점에 로드한다.
 */
export class ComponentLoader {
  private componentsDir: string
  private cache = new Map<string, Record<string, unknown>>()
  private inflight: Inflight<Record<string, unknown>> = new Map()
  // 태그 정규화 키(소문자, 하이픈 제거) → 등록된 컴포넌트 이름
  private lookup = new Map<string, string>()

  constructor(componentsDir: string) {
    this.componentsDir = componentsDir.replace(/\/$/, '')
  }

  /** components.json 읽기 → 컴포넌트 이름 목록 반환 */
  async readManifest(): Promise<string[]> {
    const url = `${this.componentsDir}/components.json`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      return await res.json()
    } catch {
      return []
    }
  }

  /** 이름 목록을 받아 비동기 컴포넌트 맵 반환 (fetch 없음) */
  createAsyncComponents(names: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const name of names) {
      this.lookup.set(name.replace(/-/g, '').toLowerCase(), name)
      result[name] = Vue.defineAsyncComponent(async () => {
        await this.preloadDeep(name, new Set())
        return this.cache.get(name) as Record<string, unknown>
      })
    }
    return result
  }

  /** 템플릿 문자열에서 사용된 등록 컴포넌트를 찾아 미리 로드 */
  async preload(template: string): Promise<void> {
    const seen = new Set<string>()
    // 실패는 fetchOne에서 이미 로그됨 — 페이지 이동은 막지 않는다
    await Promise.allSettled(this.findUsed(template).map(name => this.preloadDeep(name, seen)))
  }

  /** 매니페스트 deps 힌트: 이름 목록을 동시에 요청 시작한다. 힌트가 시작한 요청의 실패는 보고하지 않는다(실제로 필요하면 정규 경로가 다시 받아 보고한다) */
  prefetch(names: string[]): void {
    for (const n of names) {
      const name = this.lookup.get(String(n).replace(/-/g, '').toLowerCase())
      if (name && !this.cache.has(name)) shared(this.inflight, name, q => this.fetchOne(name, q), true).catch(() => {})
    }
  }

  private findUsed(template: string): string[] {
    const used = new Set<string>()
    const tagRe = /<([A-Za-z][\w-]*)/g
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(template)) !== null) {
      const name = this.lookup.get(m[1].replace(/-/g, '').toLowerCase())
      if (name) used.add(name)
    }
    return [...used]
  }

  // seen으로 순환 참조(A→B→A, 자기 재귀)에서 대기가 맞물리는 것을 막는다
  private async preloadDeep(name: string, seen: Set<string>): Promise<void> {
    if (seen.has(name)) return
    seen.add(name)
    const comp = await this.load(name)
    const children = this.findUsed(String(comp.template ?? ''))
    await Promise.all(children.map(child => this.preloadDeep(child, seen)))
  }

  private load(name: string): Promise<Record<string, unknown>> {
    const cached = this.cache.get(name)
    if (cached) return Promise.resolve(cached)
    return shared(this.inflight, name, q => this.fetchOne(name, q))
  }

  private async fetchOne(name: string, quiet: boolean): Promise<Record<string, unknown>> {
    const url = `${this.componentsDir}/${name}.vue`
    try {
      const { template, componentOptions } = await parseSfc(url, `component-${name}`)
      const component = { ...componentOptions, name, template, __file: url }
      this.cache.set(name, component)
      return component
    } catch (e) {
      if (!quiet) reportCaught(e, { code: 'E_COMPONENT_LOAD', stage: 'load', file: url, message: `component "${name}" load failed`, hint: `check ${url}` })
      throw e
    }
  }
}
