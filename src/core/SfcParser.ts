import { StyleInjector } from '../utils/StyleInjector'

export type StyleScope = 'page' | 'component' | 'layout'

export interface SfcBlock {
  template: string
  componentOptions: Record<string, unknown>
  style: string
}

const styleInjector = new StyleInjector()

export function getStyleInjector(): StyleInjector {
  return styleInjector
}

// SFC 블록 파서 — 블록별 독립 탐색
// 각 블록을 소스 전체에서 독립적으로 탐색하므로 순서에 무관하다.
// 첫 번째로 발견된 블록만 사용하고 이후 중복은 무시한다.
// template만 깊이 카운팅으로 중첩 태그를 처리한다.
function parseSfcBlocks(source: string): Record<string, string> {
  const result: Record<string, string> = { template: '', script: '', style: '' }

  // template — 깊이 카운팅으로 중첩 처리
  const tmplOpen = /<template(\s[^>]*)?>/.exec(source)
  if (tmplOpen) {
    const contentStart = tmplOpen.index + tmplOpen[0].length
    const openTag = /<template(\s[^>]*)?>/gi
    const closeTag = /<\/template>/gi
    let depth = 1
    let i = contentStart
    while (i < source.length) {
      openTag.lastIndex = i
      closeTag.lastIndex = i
      const o = openTag.exec(source)
      const c = closeTag.exec(source)
      const oIdx = o ? o.index : Infinity
      const cIdx = c ? c.index : Infinity
      if (cIdx === Infinity) break
      if (oIdx < cIdx) {
        depth++
        i = oIdx + o![0].length
      } else {
        depth--
        if (depth === 0) { result.template = source.slice(contentStart, cIdx).trim(); break }
        i = cIdx + '</template>'.length
      }
    }
  }

  // script — 소스 전체에서 첫 번째 블록만 사용
  const scriptOpen = /<script(\s[^>]*)?>/.exec(source)
  if (scriptOpen) {
    const contentStart = scriptOpen.index + scriptOpen[0].length
    const closeIdx = source.indexOf('</script>', contentStart)
    if (closeIdx !== -1) result.script = source.slice(contentStart, closeIdx).trim()
  }

  // style — 소스 전체에서 첫 번째 블록만 사용
  const styleOpen = /<style(\s[^>]*)?>/.exec(source)
  if (styleOpen) {
    const contentStart = styleOpen.index + styleOpen[0].length
    const closeIdx = source.indexOf('</style>', contentStart)
    if (closeIdx !== -1) result.style = source.slice(contentStart, closeIdx).trim()
  }

  return result
}

async function evalScript(scriptStr: string): Promise<Record<string, unknown>> {
  if (!scriptStr.trim()) return {}
  const blob = new Blob([scriptStr], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    const module = await import(/* @vite-ignore */ url)
    return module.default ?? {}
  } catch (e) {
    console.error('[vue-zero] SfcParser: script eval failed', e)
    return {}
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function parseSfc(url: string, scopeId: string, scope: StyleScope = 'component'): Promise<SfcBlock> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`[vue-zero] failed to fetch ${url} (${res.status})`)
  const source = await res.text()

  const blocks = parseSfcBlocks(source)
  const template = blocks.template
  const scriptStr = blocks.script
  const style = blocks.style

  const componentOptions = await evalScript(scriptStr)

  if (style) {
    styleInjector.inject(style, scopeId, scope)
  }

  return { template, componentOptions, style }
}
