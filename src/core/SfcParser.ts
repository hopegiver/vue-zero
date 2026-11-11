import { StyleInjector } from '../utils/StyleInjector'
import { VzError, report, type Diag } from './Diagnostics'

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
interface Blocks { template: string; script: string; scriptLine: number; scriptAttrs: string; style: string; styleAttrs: string }

function parseSfcBlocks(source: string): Blocks {
  const result: Blocks = { template: '', script: '', scriptLine: 0, scriptAttrs: '', style: '', styleAttrs: '' }

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
    if (closeIdx !== -1) {
      // trim 하지 않는다 — 앞쪽 줄 수를 보존해야 런타임 스택의 줄 번호가 .vue 파일과 일치한다
      result.script = source.slice(contentStart, closeIdx)
      result.scriptLine = source.slice(0, contentStart).split('\n').length - 1
      result.scriptAttrs = scriptOpen[1] ?? ''
    }
  }

  // style — 소스 전체에서 첫 번째 블록만 사용
  const styleOpen = /<style(\s[^>]*)?>/.exec(source)
  if (styleOpen) {
    const contentStart = styleOpen.index + styleOpen[0].length
    const closeIdx = source.indexOf('</style>', contentStart)
    if (closeIdx !== -1) {
      result.style = source.slice(contentStart, closeIdx).trim()
      result.styleAttrs = styleOpen[1] ?? ''
    }
  }

  return result
}

const SETUP_HINT = 'No <script setup>/Composition API/import. Use <script>export default { data(), methods, ... }</script> (Options API); Vue is global'
const IMPORT_HINT = 'import is impossible in .vue scripts (run as Blob URL). Remove it; call shared code via globals (window)'
const VUE_IMPORT_HINT = 'Vue is global (use Vue.xxx), not importable; write Options API: export default { data(), methods, ... }'

function classifyEval(msg: string, attrs: string, file: string, isSyntax: boolean): Diag {
  const base = { stage: 'eval' as const, file }
  const spec = /Failed to resolve module specifier ["']([^"']+)["']/.exec(msg)
  const text = `script eval failed: ${msg}`
  if (/\bsetup\b/.test(attrs)) return { ...base, code: 'E_SCRIPT_SETUP', message: text, hint: SETUP_HINT }
  if (/Invalid relative url/i.test(msg) || (spec && /^\.{0,2}\//.test(spec[1]))) return { ...base, code: 'E_RELATIVE_IMPORT', message: text, hint: IMPORT_HINT }
  if (spec) return { ...base, code: 'E_BARE_IMPORT', message: text, hint: spec[1] === 'vue' ? VUE_IMPORT_HINT : IMPORT_HINT }
  if (/lang\s*=\s*["']?tsx?\b/.test(attrs) && isSyntax) {
    return { ...base, code: 'E_SCRIPT_TS', message: text, hint: 'TypeScript is not supported. Remove lang="ts" and type annotations' }
  }
  return { ...base, code: 'E_SCRIPT_EVAL', message: text, hint: 'Syntax or top-level error in <script>; it must be a plain export default { ... } object' }
}

async function evalScript(raw: string, line: number, attrs: string, file: string): Promise<Record<string, unknown>> {
  if (!raw.trim()) return {}
  // 앞쪽 줄 수만큼 \n 을 채우고 sourceURL 을 달아 스택이 `/pages/foo.vue:<실제 줄>:<열>` 로 나오게 한다
  const code = '\n'.repeat(line) + raw + '\n//# sourceURL=' + file
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  let module: { default?: Record<string, unknown> }
  try {
    module = await import(/* @vite-ignore */ url)
  } catch (e) {
    throw new VzError(classifyEval(e instanceof Error ? e.message : String(e), attrs, file, e instanceof SyntaxError))
  } finally {
    URL.revokeObjectURL(url)
  }
  if (module.default === undefined && /\bsetup\b/.test(attrs)) {
    throw new VzError({ code: 'E_SCRIPT_SETUP', stage: 'eval', file, message: '<script setup> has no export default; component is empty', hint: SETUP_HINT })
  }
  return module.default ?? {}
}

export async function parseSfc(url: string, scopeId: string, scope: StyleScope = 'component'): Promise<SfcBlock> {
  const code = scope === 'page' ? 'E_PAGE_FETCH' : scope === 'layout' ? 'E_LAYOUT_FETCH' : 'E_COMPONENT_FETCH'
  const fetchDiag = (message: string, hint: string): Diag => ({ code, stage: 'load', file: url, message, hint })
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new VzError(fetchDiag('network error while fetching', 'check server connection and path'))
  }
  if (!res.ok) {
    throw new VzError(
      fetchDiag(`failed to fetch (HTTP ${res.status})`, res.status === 404 ? `${url} is missing or does not match pages.json/components.json` : 'server error response'),
      res.status,
    )
  }
  const source = await res.text()

  const blocks = parseSfcBlocks(source)
  const template = blocks.template
  const style = blocks.style

  if (/\bscoped\b/.test(blocks.styleAttrs)) {
    report({ code: 'E_STYLE_SCOPED', stage: 'parse', file: url, message: '<style scoped> is not supported; styles apply globally', hint: 'Remove scoped; use unique class names' }, 'warn')
  }

  const componentOptions = await evalScript(blocks.script, blocks.scriptLine, blocks.scriptAttrs, url)

  if (style) {
    styleInjector.inject(style, scopeId, scope)
  }

  return { template, componentOptions, style }
}
