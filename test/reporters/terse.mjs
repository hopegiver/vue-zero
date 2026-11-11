// 토큰 절약용 Playwright 리포터: 전부 통과하면 1줄, 실패하면 실패한 테스트만 "위치 + 오류 첫 줄(+기대/실제)"로 출력한다.
// 전체 상세(전체 오류 메시지, 스택, 첨부)는 test/.results/last.json 에 저장한다.
//   사용: playwright test -c test/playwright.config.js --reporter=./test/reporters/terse.mjs   (또는 pnpm check)
import { mkdirSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'

const ANSI = /\u001b\[[0-9;]*m/g
const clean = s => String(s ?? '').replace(ANSI, '')
const MAX_FAILS = Number(process.env.VZ_MAX_FAILS || 10) // 한 번에 보여 줄 실패 수(나머지는 last.json)

export default class TerseReporter {
  constructor() {
    this.counts = { passed: 0, failed: 0, skipped: 0, flaky: 0, timedOut: 0, interrupted: 0 }
    this.failures = []
    this.flaky = []
    this.start = Date.now()
  }

  onBegin(config) { this.root = config.rootDir }

  onTestEnd(test, result) {
    const outcome = test.outcome() // expected | unexpected | flaky | skipped
    const rec = () => {
      const err = (result.errors?.[0]) || result.error || {}
      const full = clean(err.message || err.value || '')
      return {
        project: test.parent.project()?.name,
        file: relative(this.root, test.location.file),
        line: test.location.line,
        title: test.titlePath().slice(3).join(' › ') || test.title,
        message: full,
        stack: clean(err.stack || ''),
      }
    }
    if (outcome === 'skipped') this.counts.skipped++
    else if (outcome === 'expected') this.counts.passed++
    else if (outcome === 'flaky') { this.counts.flaky++; this.flaky.push(rec()) }
    else if (result.status === 'timedOut') { this.counts.timedOut++; this.counts.failed++; this.failures.push(rec()) }
    else if (result.status === 'interrupted') this.counts.interrupted++
    else { this.counts.failed++; this.failures.push(rec()) }
  }

  // 오류 메시지에서 필요한 핵심 줄만 추린다: 첫 줄 + Expected/Received/Locator/Timeout + (diff 형식이면) 달라진 줄 몇 개
  digest(msg) {
    const lines = msg.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return '(오류 메시지 없음)'
    const keep = [lines[0]]
    const isDiffHeader = l => /^[-+] (Expected|Received)/.test(l)
    for (const l of lines.slice(1)) {
      if (/^(Expected|Received|Locator|Error:|Timeout)/.test(l) && keep.length < 4) keep.push(l)
      else if (isDiffHeader(l)) keep.push(l.replace(/\s+/g, ' '))
    }
    const changed = lines.slice(1).filter(l => /^[-+]\s+\S/.test(l) && !isDiffHeader(l))
    keep.push(...changed.slice(0, 5))
    if (changed.length > 5) keep.push(`… diff ${changed.length - 5}줄 더`)
    return keep.join(' | ').slice(0, 420)
  }

  onEnd(result) {
    const secs = ((Date.now() - this.start) / 1000).toFixed(1)
    const c = this.counts
    const total = c.passed + c.failed + c.skipped + c.flaky
    const extra = [c.skipped && `skip ${c.skipped}`, c.flaky && `flaky ${c.flaky}`].filter(Boolean).join(', ')
    const out = []
    if (c.failed === 0 && c.interrupted === 0 && result.status === 'passed') {
      out.push(`✔ tests ${c.passed + c.flaky} passed${extra ? ` (${extra})` : ''} ${secs}s`)
    } else {
      out.push(`✘ tests ${c.failed} FAILED / ${total} ${secs}s${extra ? ` (${extra})` : ''}${result.status === 'timedout' ? ' [전체 시간 초과]' : ''}`)
      this.failures.slice(0, MAX_FAILS).forEach(f => {
        out.push(`  ✗ [${f.project}] ${f.file}:${f.line}  ${f.title}`)
        out.push(`      ${this.digest(f.message)}`)
      })
      if (this.failures.length > MAX_FAILS) out.push(`  … 외 ${this.failures.length - MAX_FAILS}건 (VZ_MAX_FAILS=${this.failures.length} 또는 last.json)`)
    }
    this.flaky.slice(0, 5).forEach(f => out.push(`  ⚠ flaky [${f.project}] ${f.file}:${f.line}  ${f.title}`))
    if (this.failures.length || this.flaky.length) out.push('  상세: test/.results/last.json  (재실행: pnpm check -- -g "<제목 일부>")')
    try {
      mkdirSync('test/.results', { recursive: true })
      writeFileSync('test/.results/last.json', JSON.stringify({ at: new Date().toISOString(), status: result.status, counts: this.counts, failures: this.failures, flaky: this.flaky }, null, 2))
    } catch { /* 결과 파일 저장 실패는 무시 */ }
    process.stdout.write(out.join('\n') + '\n')
  }

  printsToStdio() { return true }
}
