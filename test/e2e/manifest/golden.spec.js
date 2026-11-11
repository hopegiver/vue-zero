import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate } from '../../scripts/gen-manifest.mjs'

// vz-manifest.json 형식 v1 골든 테스트 (브라우저 불필요).
// 같은 픽스처·기대 파일이 vue-zero-template 의 tests/fixtures/manifest-golden 에 동일 사본으로 있고,
// 거기서는 참조 생성기 bin/scan.js 가 같은 출력을 내는지 bin/scan.test.js 가 검증한다. 두 사본은 바이트 동일해야 한다.
const golden = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'manifest-golden')
const read = (p) => readFileSync(p, 'utf8')
const walk = (d) => readdirSync(d).flatMap((e) => (statSync(join(d, e)).isDirectory() ? walk(join(d, e)) : [join(d, e)]))
const put = (dir, rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body) }
const sfc = (tpl, script = 'export default {}') => `<template>${tpl}</template>\n<script>\n${script}\n</script>\n`
const tmp = () => mkdtempSync(join(tmpdir(), 'vz-manifest-'))
const withGolden = () => { const d = tmp(); cpSync(join(golden, 'app'), join(d, 'app'), { recursive: true }); return d }

test('골든: 픽스처 앱에서 test/scripts/gen-manifest.mjs 출력 == 기대 vz-manifest.json / pages.json / components.json (바이트 동일)', () => {
  const dir = withGolden()
  try {
    const out = generate(join(dir, 'app'))
    expect(out.manifest).toBe(read(join(golden, 'expected', 'vz-manifest.json')))
    expect(out.pages).toBe(read(join(golden, 'expected', 'pages.json')))
    expect(out.components).toBe(read(join(golden, 'expected', 'components.json')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('CRLF 정규화: 모든 .vue 를 CRLF 로 바꿔도 해시·build·전체 출력이 같다', () => {
  const dir = withGolden()
  try {
    for (const f of walk(join(dir, 'app')).filter((p) => p.endsWith('.vue'))) writeFileSync(f, read(f).replace(/\n/g, '\r\n'))
    expect(generate(join(dir, 'app')).manifest).toBe(read(join(golden, 'expected', 'vz-manifest.json')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('해시는 정규화한 내용의 sha256 앞 10자, 내용이 바뀌면 그 파일과 build 만 바뀐다', () => {
  const dir = withGolden()
  try {
    const a = JSON.parse(generate(join(dir, 'app')).manifest)
    expect(Object.values(a.files).every((h) => /^[0-9a-f]{10}$/.test(h))).toBe(true)
    expect(a.build).toMatch(/^[0-9a-f]{64}$/)
    writeFileSync(join(dir, 'app', 'components', 'Avatar.vue'), read(join(dir, 'app', 'components', 'Avatar.vue')) + ' ')
    const b = JSON.parse(generate(join(dir, 'app')).manifest)
    expect(b.build).not.toBe(a.build)
    expect(Object.keys(a.files).filter((k) => a.files[k] !== b.files[k])).toEqual(['components/Avatar.vue'])
    expect(b.deps).toEqual(a.deps)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('deps: 전이 폐포 · 순환 종료 · 레이아웃 컴포넌트 포함 · layout:false 는 레이아웃 제외 · 동적 layout 은 deps 생략', () => {
  const dir = withGolden()
  try {
    const m = JSON.parse(generate(join(dir, 'app')).manifest)
    expect(m.deps['pages/about.vue']).toEqual({ layout: 'admin', components: ['AdminNav', 'AppButton', 'AppHeader', 'Avatar', 'UserCard'] })
    expect(m.deps['pages/users/[id].vue']).toEqual({ layout: false, components: ['Avatar', 'UserCard'] })
    expect('pages/dynamic.vue' in m.deps).toBe(false)
    expect('pages/error.vue' in m.deps).toBe(false)
    expect([m.has404, m.hasError]).toEqual([true, true])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('layout 판정: 큰따옴표 · 주석 처리된 layout · 키 2회 등장(판정 불가) · pages 가 없는 앱', () => {
  const dir = tmp()
  try {
    put(dir, 'app/pages/a.vue', sfc('<div/>', 'export default {\n  layout: "x",\n}'))
    put(dir, 'app/pages/b.vue', sfc('<div/>', "export default {\n  // layout: 'nope'\n  data() { return {} }\n}"))
    put(dir, 'app/pages/c.vue', sfc('<div/>', "export default {\n  layout: 'p',\n  data() { return { layout: 'q' } }\n}"))
    put(dir, 'app/pages/d.vue', '<template><div/></template>\n')
    const m = JSON.parse(generate(join(dir, 'app')).manifest)
    expect(m.deps['pages/a.vue'].layout).toBe('x')
    expect(m.deps['pages/b.vue'].layout).toBe('default')
    expect('pages/c.vue' in m.deps).toBe(false)
    expect(m.deps['pages/d.vue'].layout).toBe('default')
    expect([m.has404, m.components]).toEqual([false, []])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
