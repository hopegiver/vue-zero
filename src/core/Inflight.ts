/** 같은 키의 동시 로드를 하나의 Promise 로 합친다. quiet(매니페스트 deps 힌트)로 시작한 요청이 실패했는데 정규 경로가 같은 키를 필요로 하면, 정규 경로가 직접 다시 받아 보고한다 */
export type Inflight<T> = Map<string, { p: Promise<T>; quiet: boolean }>

export function shared<T>(map: Inflight<T>, key: string, run: (quiet: boolean) => Promise<T>, quiet = false): Promise<T> {
  const e = map.get(key)
  if (e) return e.quiet && !quiet ? e.p.catch(() => shared(map, key, run)) : e.p
  const p = run(quiet).finally(() => map.delete(key))
  map.set(key, { p, quiet })
  return p
}
