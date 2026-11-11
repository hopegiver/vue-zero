// raw jsonl → results/<name>.summary.json + results/<name>.tables.md (중앙값/p90/min/max, 승패표)
// 사용: node bench/summarize.mjs results/raw-main.jsonl
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const bench = dirname(fileURLToPath(import.meta.url))
const inFile = resolve(bench, process.argv[2] || 'results/raw-main.jsonl')
const base = inFile.replace(/\.jsonl$/, '').replace(/raw-/, '')
const lines = readFileSync(inFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const sessions = lines.filter((l) => l.type === 'session')
const meta = lines.find((l) => l.type === 'meta'), end = lines.find((l) => l.type === 'end')
const ok = sessions.filter((s) => !s.error)

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] }
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const stat = (a) => { a = a.filter((v) => v != null && Number.isFinite(v)); return a.length ? { n: a.length, min: Math.min(...a), median: med(a), p90: q(a, 0.9), max: Math.max(...a) } : null }

export const METRICS = {
  'cold.ready_ms': (s) => s.cold.readyMs, 'cold.fcp_ms': (s) => s.cold.fcpMs, 'cold.lcp_ms': (s) => s.cold.lcpMs,
  'cold.bytes': (s) => s.cold.bytes, 'cold.requests': (s) => s.cold.requests, 'cold.script_ms': (s) => s.cold.scriptMs, 'cold.task_ms': (s) => s.cold.taskMs,
  'warm.ready_ms': (s) => s.warm.readyMs, 'warm.fcp_ms': (s) => s.warm.fcpMs, 'warm.lcp_ms': (s) => s.warm.lcpMs,
  'warm.bytes': (s) => s.warm.bytes, 'warm.requests': (s) => s.warm.requests, 'warm.n304': (s) => s.warm.n304, 'warm.cache_hits': (s) => s.warm.cached,
  'nav.first_ms': (s) => s.nav.firstMs, 'nav.first_requests': (s) => s.nav.firstReq, 'nav.revisit_ms': (s) => s.nav.revisitMs, 'nav.seq_avg_ms': (s) => s.nav.seqAvgMs,
  'nav.seq_total_requests': (s) => s.nav.seqTotalReq, 'nav.seq_total_bytes': (s) => s.nav.seqTotalBytes,
  'mem.home_heap_mb': (s) => s.memory.afterHome.heapUsedMB, 'mem.nav_heap_mb': (s) => s.memory.afterNav.heapUsedMB, 'mem.nav_nodes': (s) => s.memory.afterNav.nodes,
  'mem.nav_listeners': (s) => s.memory.afterNav.listeners, 'mem.nav_style_nodes': (s) => s.memory.afterNav.styleNodes, 'mem.nav_link_css': (s) => s.memory.afterNav.linkCss,
}
const sizes = [...new Set(ok.map((s) => s.size))], profiles = [...new Set(ok.map((s) => s.profile))].sort(), variants = [...new Set(ok.map((s) => s.variant))]
const out = { meta, end, sessions: sessions.length, errors: sessions.filter((s) => s.error).map((s) => ({ v: s.variant, size: s.size, p: s.profile, rep: s.rep, error: s.error })),
  compMismatch: ok.filter((s) => !s.cold.compOk || !s.warm.compOk).length, pageErrors: ok.filter((s) => s.cold.pageErrors?.length).length,
  unsettled: ok.filter((s) => !s.cold.settled || !s.warm.settled).length,
  loadavg: { min: Math.min(...ok.map((s) => s.loadavgStart)), median: med(ok.map((s) => s.loadavgStart)), max: Math.max(...ok.map((s) => s.loadavgEnd)) }, cells: {} }
for (const size of sizes) for (const p of profiles) for (const v of variants) {
  const g = ok.filter((s) => s.size === size && s.profile === p && s.variant === v)
  if (!g.length) continue
  out.cells[`${size}|${p}|${v}`] = Object.fromEntries(Object.entries(METRICS).map(([k, f]) => [k, stat(g.map((s) => { try { return f(s) } catch { return null } }))]))
}
writeFileSync(resolve(bench, 'results', `${basename(base)}.summary.json`), JSON.stringify(out, null, 1))

// 승패표: 중앙값 비율 = vz / nuxt (낮을수록 vz 유리). ±10% 이내 = 비슷
const fmt = (v) => (v == null ? '-' : v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2))
let md = `# ${basename(base)} 표 (자동 생성)\n\n세션 ${sessions.length}, 오류 ${out.errors.length}, 컴포넌트 렌더 불일치 ${out.compMismatch}, 페이지 오류 ${out.pageErrors}, 미안정(settle 실패) ${out.unsettled}, load avg(시작 중앙값/최대 끝) ${out.loadavg.median.toFixed(1)}/${out.loadavg.max.toFixed(1)}\n\n`
const key = ['cold.ready_ms', 'cold.lcp_ms', 'cold.bytes', 'cold.requests', 'warm.ready_ms', 'warm.requests', 'warm.bytes', 'nav.first_ms', 'nav.revisit_ms', 'nav.seq_avg_ms', 'mem.nav_heap_mb', 'mem.nav_nodes']
for (const cmp of variants.filter((v) => v !== 'nuxt')) {
  if (!variants.includes(cmp) || !variants.includes('nuxt')) continue
  md += `## 승패표: ${cmp} vs nuxt (중앙값 비율 ${cmp}/nuxt, <0.9 승, >1.1 패, 그 사이 비슷)\n\n| 지표 | 규모 | ` + profiles.map((p) => `P${p}`).join(' | ') + ' |\n|---|---|' + profiles.map(() => '---').join('|') + '|\n'
  for (const k of key) for (const size of sizes) {
    md += `| ${k} | ${size} | ` + profiles.map((p) => {
      const a = out.cells[`${size}|${p}|${cmp}`]?.[k]?.median, b = out.cells[`${size}|${p}|nuxt`]?.[k]?.median
      if (a == null || b == null) return '-'
      if (b === 0) return a === 0 ? '동률' : `패(nuxt 0, vz ${fmt(a)})`
      const r = a / b
      return `${r < 0.9 ? '승' : r > 1.1 ? '패' : '≈'} ${r.toFixed(2)}x`
    }).join(' | ') + ' |\n'
  }
  md += '\n'
}
md += `## 원값 (중앙값 [p90])\n\n`
for (const k of Object.keys(METRICS)) {
  md += `### ${k}\n\n| 규모 | 프로필 | ` + variants.join(' | ') + ' |\n|---|---|' + variants.map(() => '---').join('|') + '|\n'
  for (const size of sizes) for (const p of profiles) md += `| ${size} | P${p} | ` + variants.map((v) => { const s = out.cells[`${size}|${p}|${v}`]?.[k]; return s ? `${fmt(s.median)} [${fmt(s.p90)}]` : '-' }).join(' | ') + ' |\n'
  md += '\n'
}
writeFileSync(resolve(bench, 'results', `${basename(base)}.tables.md`), md)
console.log(`[summarize] ${sessions.length} sessions -> results/${basename(base)}.summary.json, .tables.md`)
