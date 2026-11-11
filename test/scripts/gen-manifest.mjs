// vz-manifest.json(형식 v1) 테스트 전용 생성기. 배포하지 않는다(npm tarball 은 dist 1파일).
// 참조 구현은 템플릿 저장소의 bin/scan.js 이고, 이 파일은 같은 명세(README "Manifest")를 독립적으로 구현해
// 양쪽 저장소가 같은 픽스처(test/fixtures/manifest-golden ≡ template/tests/fixtures/manifest-golden)에서
// 같은 출력을 내는지 골든 테스트(e2e/manifest/golden.spec.js)로 묶는다.
// CLI: node test/scripts/gen-manifest.mjs <app 디렉토리>   → pages.json / components.json / vz-manifest.json 을 쓴다
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const sha256 = (t) => createHash('sha256').update(t, 'utf8').digest('hex')

function vueFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? vueFiles(join(dir, e.name)) : e.name.endsWith('.vue') ? [join(dir, e.name)] : [])
}

function block(src, tag) {
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`).exec(src)
  if (!open) return ''
  const from = open.index + open[0].length
  if (tag === 'script') {
    const end = src.indexOf('</script>', from)
    return end < 0 ? '' : src.slice(from, end)
  }
  let depth = 1
  let i = from
  for (;;) {
    const o = /<template(\s[^>]*)?>/gi, c = /<\/template>/gi
    o.lastIndex = c.lastIndex = i
    const om = o.exec(src), cm = c.exec(src)
    if (!cm) return ''
    if (om && om.index < cm.index) { depth++; i = om.index + om[0].length; continue }
    if (--depth === 0) return src.slice(from, cm.index).trim()
    i = cm.index + cm[0].length
  }
}

function layoutOf(script) {
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
  const start = /\bexport\s+default\s*\{/.exec(code)
  if (!start) return /\blayout\s*:/.test(code) ? undefined : 'default'
  const keys = []
  let depth = 0
  let i = start.index + start[0].length - 1
  for (; i < code.length; i++) {
    const c = code[i]
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++
    } else if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) { if (--depth === 0) break }
    else if (depth === 1 && c === 'l' && !/[\w$.]/.test(code[i - 1])) {
      const k = /layout\s*:/y
      k.lastIndex = i
      if (k.test(code)) keys.push(i)
    }
  }
  if (i >= code.length || keys.length > 1) return undefined
  if (!keys.length) return 'default'
  const lit = /layout\s*:\s*(?:(false)|'([^'\\\n]*)'|"([^"\\\n]*)")\s*(?=[,}\r\n])/y
  lit.lastIndex = keys[0]
  const m = lit.exec(code)
  return m ? (m[1] ? false : m[2] ?? m[3]) : undefined
}

export function generate(appDir) {
  const rels = (sub) => vueFiles(join(appDir, sub)).map((f) => relative(appDir, f).split('\\').join('/')).sort()
  const pageFiles = rels('pages'), compFiles = rels('components'), layoutFiles = rels('layouts')
  const text = Object.fromEntries([...pageFiles, ...compFiles, ...layoutFiles].map((r) => [r, readFileSync(join(appDir, r), 'utf8').replace(/\r\n/g, '\n')]))

  const pages = pageFiles.map((f) => f.slice(6, -4)).filter((n) => n !== '404' && n !== 'error').sort()
  const components = compFiles.map((f) => basename(f, '.vue')).sort()
  const files = Object.fromEntries(Object.keys(text).sort().map((r) => [r, sha256(text[r]).slice(0, 10)]))

  const byKey = new Map(components.map((n) => [n.replace(/-/g, '').toLowerCase(), n]))
  const tagsIn = (tpl) => [...new Set([...tpl.matchAll(/<([A-Za-z][\w-]*)/g)].map((m) => byKey.get(m[1].replace(/-/g, '').toLowerCase())).filter(Boolean))]
  const closure = (templates) => {
    const out = new Set()
    const todo = templates.flatMap(tagsIn)
    for (let n; (n = todo.shift()) !== undefined;) {
      if (out.has(n)) continue
      out.add(n)
      const s = text[`components/${n}.vue`]
      if (s !== undefined) todo.push(...tagsIn(block(s, 'template')))
    }
    return [...out].sort()
  }

  const deps = {}
  for (const rel of pageFiles.filter((r) => r !== 'pages/error.vue')) {
    const layout = layoutOf(block(text[rel], 'script'))
    if (layout === undefined) continue
    const tpls = [block(text[rel], 'template')]
    if (layout !== false && text[`layouts/${layout}.vue`] !== undefined) tpls.push(block(text[`layouts/${layout}.vue`], 'template'))
    deps[rel] = { layout, components: closure(tpls) }
  }

  const manifest = {
    v: 1, build: sha256(JSON.stringify(files)), pages, components,
    has404: 'pages/404.vue' in text, hasError: 'pages/error.vue' in text,
    files, deps: Object.fromEntries(Object.keys(deps).sort().map((k) => [k, deps[k]])),
  }
  return { manifest: JSON.stringify(manifest) + '\n', pages: JSON.stringify(pages) + '\n', components: JSON.stringify(components) + '\n' }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = process.argv[2] || 'app'
  const out = generate(app)
  writeFileSync(join(app, 'pages', 'pages.json'), out.pages)
  writeFileSync(join(app, 'components', 'components.json'), out.components)
  writeFileSync(join(app, 'vz-manifest.json'), out.manifest)
}
