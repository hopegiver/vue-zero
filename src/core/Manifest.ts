import { report } from './Diagnostics'

export interface Manifest {
  v: number
  pages: string[]
  components: string[]
  files?: Record<string, string>
  deps?: Record<string, { layout?: string | false; components?: string[] }>
}

const PREFIX = 'vue-zero-'

/** localhost/127.0.0.1/[::1] 또는 ?vzdev — 템플릿 index.html 과 같은 규칙 */
export const isDevHost = (): boolean =>
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]vzdev\b/.test(location.search)

/** vz-manifest.json 을 항상 재검증(no-cache)으로 받는다. 없거나 깨졌으면 E_MANIFEST_FETCH 경고 후 null (호출자가 legacy 경로로 폴백) */
export async function loadManifest(url: string): Promise<Manifest | null> {
  const fail = (message: string): null => {
    report({ code: 'E_MANIFEST_FETCH', stage: 'manifest', file: url, message: `${message} — using pages.json`, hint: 'run npm run scan and deploy vz-manifest.json, or remove the "manifest" option' }, 'warn')
    return null
  }
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-cache' })
  } catch {
    return fail('network error')
  }
  if (!res.ok) return fail(`HTTP ${res.status}`)
  try {
    const m = await res.json()
    if (m && m.v === 1 && Array.isArray(m.pages) && Array.isArray(m.components)) return m
  } catch { /* 아래에서 보고 */ }
  return fail('invalid format (expected v1)')
}

/**
 * 콘텐츠 해시 키(`<경로>?v=<해시>`)로 .vue 소스를 Cache Storage 에 영속 저장한다.
 * 같은 출처의 정적 소스만 다룬다 — 토큰·사용자 데이터·API 응답은 이 경로를 지나지 않는다.
 * caches 미지원/쿼터/예외는 전부 일반 fetch 로 폴백한다.
 */
export function createPersistentCache(hashes: Map<string, string>, dirs: string[], version: string) {
  const name = PREFIX + version

  async function get(url: string): Promise<Response> {
    const hash = hashes.get(url)
    if (!hash) return fetch(url)
    const key = `${url}?v=${hash}`
    let cache: Cache | undefined
    try {
      cache = await caches.open(name)
      const hit = await cache.match(key)
      if (hit) return hit
    } catch { /* 폴백: 일반 fetch */ }
    const res = await fetch(key)
    if (cache && res.ok) cache.put(key, res.clone()).catch(() => {})
    return res
  }

  /** 다른 버전의 캐시와, 현재 매니페스트에 없는 옛 항목을 지운다 (이 앱의 pages/components/layouts 경로만) */
  async function sweep(): Promise<void> {
    try {
      for (const n of await caches.keys()) if (n.startsWith(PREFIX) && n !== name) await caches.delete(n)
      const cache = await caches.open(name)
      const valid = new Set([...hashes].map(([u, h]) => `${u}?v=${h}`))
      for (const req of await cache.keys()) {
        const u = new URL(req.url)
        if (dirs.some(d => u.pathname.startsWith(d + '/')) && !valid.has(u.pathname + u.search)) await cache.delete(req)
      }
    } catch { /* 정리 실패는 무시 */ }
  }

  return { get, sweep }
}
