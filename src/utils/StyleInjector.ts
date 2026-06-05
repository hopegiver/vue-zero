type StyleScope = 'page' | 'component' | 'layout'

interface StyleEntry {
  el: HTMLStyleElement
  scope: StyleScope
}

export class StyleInjector {
  private injected = new Map<string, StyleEntry>()
  private activePageId: string | null = null

  inject(css: string, scopeId: string, scope: StyleScope = 'component'): void {
    if (!css.trim()) return
    if (this.injected.has(scopeId)) return  // 이미 주입된 스타일은 재주입 안 함
    const el = document.createElement('style')
    el.setAttribute('data-vue-zero', scopeId)
    el.setAttribute('data-scope', scope)
    el.textContent = css
    document.head.appendChild(el)
    this.injected.set(scopeId, { el, scope })
  }

  remove(scopeId: string): void {
    const entry = this.injected.get(scopeId)
    if (entry) {
      entry.el.remove()
      this.injected.delete(scopeId)
    }
  }

  // 페이지 전환 시 이전 페이지 스타일만 숨기고, 새 페이지 스타일만 표시
  switchPage(nextScopeId: string): void {
    for (const [scopeId, entry] of this.injected) {
      if (entry.scope === 'page') {
        entry.el.disabled = (scopeId !== nextScopeId)
      }
    }
    this.activePageId = nextScopeId
  }

  // clearPages는 하위 호환용으로 유지 (실제로는 아무것도 지우지 않음)
  clearPages(): void {}

  clear(): void {
    this.injected.forEach(entry => entry.el.remove())
    this.injected.clear()
  }
}
