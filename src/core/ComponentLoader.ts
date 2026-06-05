import { parseSfc } from './SfcParser'

/**
 * components/components.json 에 선언된 전역 컴포넌트를 로드해 Vue 앱에 등록.
 *
 * components.json 예시: ["AppButton", "UserCard"]
 * 각 컴포넌트는 componentsDir/Name.vue 파일로 존재해야 함.
 */
export class ComponentLoader {
  private componentsDir: string
  private cache = new Map<string, Record<string, unknown>>()

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

  /** 이름 목록을 받아 Vue 컴포넌트 객체 맵으로 반환 */
  async loadAll(names: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    await Promise.all(
      names.map(async name => {
        try {
          result[name] = await this.load(name)
        } catch (e) {
          console.warn(`[vue-zero] ComponentLoader: failed to load ${name}`, e)
        }
      })
    )
    return result
  }

  private async load(name: string): Promise<Record<string, unknown>> {
    if (this.cache.has(name)) return this.cache.get(name)!
    const url = `${this.componentsDir}/${name}.vue`
    const { template, componentOptions } = await parseSfc(url, `component-${name}`)
    const component = { ...componentOptions, name, template }
    this.cache.set(name, component)
    return component
  }
}
