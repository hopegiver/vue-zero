export interface RouteRecord {
  path: string
  filePath: string  // e.g. /pages/users/[id].vue
  name: string      // e.g. users-id
}

/**
 * pages/pages.json 목록을 라우트로 변환.
 *
 * 변환 규칙 (Nuxt 동일):
 *   index        → /
 *   about        → /about
 *   users/index  → /users
 *   users/[id]   → /users/:id
 *   [...slug]    → /:slug*
 */
export class RouteScanner {
  private pagesDir: string

  constructor(pagesDir: string) {
    this.pagesDir = pagesDir.replace(/\/$/, '')
  }

  /** pages.json에서 파일 목록을 읽어 라우트 목록 반환 */
  async scan(): Promise<RouteRecord[]> {
    const manifestUrl = `${this.pagesDir}/pages.json`
    try {
      const res = await fetch(manifestUrl)
      if (!res.ok) throw new Error(`${res.status}`)
      const list: string[] = await res.json()
      list.forEach(entry => {
        if (entry.endsWith('.vue')) {
          console.error(`[vue-zero] pages.json entry should not include ".vue" extension (got: "${entry}"). Use "${entry.replace(/\.vue$/, '')}"`)
        }
      })
      return list.map(f => this.fileToRoute(f))
    } catch (e) {
      console.warn(`[vue-zero] pages.json not found at ${manifestUrl}. Create it: ["index", "about", ...]`)
      return []
    }
  }

  private fileToRoute(file: string): RouteRecord {
    // 확장자 제거
    const noExt = file.replace(/\.vue$/, '')
    const segments = noExt.split('/')
    const routeSegments = segments.map(seg => this.segmentToPath(seg))

    // index 처리
    const last = routeSegments[routeSegments.length - 1]
    let routePath: string
    if (last === '') {
      // index → 폴더 루트
      routeSegments.pop()
      routePath = routeSegments.length === 0 ? '/' : '/' + routeSegments.join('/')
    } else {
      routePath = '/' + routeSegments.join('/')
    }

    const name = noExt.replace(/\//g, '-').replace(/[\[\]\.]/g, '').replace(/\.\.\./g, '')

    return {
      path: routePath,
      filePath: `${this.pagesDir}/${file.endsWith('.vue') ? file : file + '.vue'}`,
      name,
    }
  }

  private segmentToPath(seg: string): string {
    // [...slug] → :slug*
    if (seg.startsWith('[...') && seg.endsWith(']')) {
      return ':' + seg.slice(4, -1) + '*'
    }
    // [id] → :id
    if (seg.startsWith('[') && seg.endsWith(']')) {
      return ':' + seg.slice(1, -1)
    }
    // index → '' (호출자에서 처리)
    if (seg === 'index') return ''
    return seg
  }
}
