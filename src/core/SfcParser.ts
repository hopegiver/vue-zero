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
  if (tag === 'template') {
    const open = new RegExp(`<template(\\s[^>]*)?>`, 'i')
    const startMatch = open.exec(source)
    if (!startMatch) return ''
    let depth = 0
    let i = startMatch.index
    const openTag = /<template(\s[^>]*)?>/gi
    const closeTag = /<\/template>/gi
    openTag.lastIndex = i
    closeTag.lastIndex = i
    while (i < source.length) {
      openTag.lastIndex = i
      closeTag.lastIndex = i
      const o = openTag.exec(source)
      const c = closeTag.exec(source)
      if (!c) break
      if (o && o.index < c.index) {
        depth++
        i = o.index + o[0].length
      } else {
        depth--
        if (depth === 0) {
          const contentStart = startMatch.index + startMatch[0].length
          return source.slice(contentStart, c.index).trim()
        }
        i = c.index + c[0].length
      }
    }
    return ''
  }
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = source.match(re)
  return m ? m[1].trim() : ''
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

  const template = extractBlock(source, 'template')
  const scriptStr = extractBlock(source, 'script')
  const style = extractBlock(source, 'style')

  const componentOptions = await evalScript(scriptStr)

  if (style) {
    styleInjector.inject(style, scopeId, scope)
  }

  return { template, componentOptions, style }
}
