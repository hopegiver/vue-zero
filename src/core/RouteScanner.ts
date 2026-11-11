import { report } from './Diagnostics'

// 페이지 파일명(= 컴포넌트 이름)으로 쓸 수 없는 HTML 예약 태그
export const HTML_RESERVED = new Set([
  'html','body','head','base','meta','link','style','script','noscript',
  'template','slot','component',
  'div','span','p','a','br','hr','img','input','button','select','option',
  'textarea','form','label','fieldset','legend','table','thead','tbody',
  'tfoot','tr','th','td','caption','colgroup','col',
  'ul','ol','li','dl','dt','dd',
  'h1','h2','h3','h4','h5','h6',
  'header','footer','main','nav','section','article','aside',
  'details','summary','dialog','figure','figcaption',
  'video','audio','source','canvas','svg','iframe','embed','object',
  'pre','code','blockquote','strong','em','small','sub','sup','mark',
])

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
      return this.toRecords(await res.json(), manifestUrl)
    } catch (e) {
      report({ code: 'E_MANIFEST_MISSING', stage: 'manifest', file: manifestUrl, message: `pages.json not found at ${manifestUrl}`, hint: 'Create it: ["index", "about", ...]' }, 'warn')
      return []
    }
  }

  /** 페이지 이름 목록(pages.json 또는 vz-manifest.json 의 pages) → 라우트 + 시작 시 전체 검사 */
  toRecords(list: string[], manifestUrl: string): RouteRecord[] {
    list.forEach(entry => {
      if (entry.endsWith('.vue')) {
        report({ code: 'E_MANIFEST_ENTRY', stage: 'manifest', file: manifestUrl, message: `pages.json entry should not include ".vue" extension (got: "${entry}")`, hint: `Use "${entry.replace(/\.vue$/, '')}"` })
      }
    })
    const records = list.map(f => this.fileToRoute(f))
    // 시작 시 전체 검사 — 방문하지 않은 페이지도 잡는다
    records.forEach(r => {
      if (HTML_RESERVED.has(r.name)) {
        report({ code: 'E_RESERVED_TAG', stage: 'manifest', file: r.filePath, message: `page file name "${r.name}" conflicts with an HTML reserved tag`, hint: `Rename ${r.filePath} and its pages.json entry (e.g. ${r.name}-page)` })
      }
    })
    return records
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
