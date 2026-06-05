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

function extractBlock(source: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = source.match(re)
  return m ? m[1].trim() : ''
}

function evalScript(scriptStr: string): Record<string, unknown> {
  if (!scriptStr.trim()) return {}
  const normalized = scriptStr.replace(/export\s+default\s*/, 'return ')
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(normalized)
    return fn() ?? {}
  } catch (e) {
    console.error('[vue-zero] SfcParser: script eval failed', e)
    return {}
  }
}

export async function parseSfc(url: string, scopeId: string, scope: StyleScope = 'component'): Promise<SfcBlock> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`[vue-zero] failed to fetch ${url} (${res.status})`)
  const source = await res.text()

  const template = extractBlock(source, 'template')
  const scriptStr = extractBlock(source, 'script')
  const style = extractBlock(source, 'style')

  const componentOptions = evalScript(scriptStr)

  if (style) {
    styleInjector.inject(style, scopeId, scope)
  }

  return { template, componentOptions, style }
}
