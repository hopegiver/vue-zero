// 동일 소스(.vue)로 vue-zero 앱과 Nuxt 4 소스 트리를 생성한다. 시드 고정 → 결정적.
// 사용: node bench/gen/gen-apps.mjs [S|M|L ...]   (기본: 전체)
// 출력: bench/apps/<size>/{vz,nuxt}/ , bench/apps/<size>/manifest.json   (모두 .gitignore)
import { mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// X60/X150: 보조 스트레스(홈 페이지 하나가 컴포넌트 60/150개를 직접 사용, 동적 라우트 없음) — 페이지당 컴포넌트 수가 늘 때의 비용 측정용
export const SIZES = { S: { pages: 10, comps: 10 }, M: { pages: 50, comps: 100 }, L: { pages: 150, comps: 300 }, X60: { pages: 3, comps: 60, home: 60, dyn: 0 }, X150: { pages: 3, comps: 150, home: 150, dyn: 0 } }
const DYNAMIC = ['item', 'user', 'order', 'doc', 'team'] // 동적 [id] 라우트 후보 (S=1, M=3, L=5)
const here = dirname(fileURLToPath(import.meta.url))
const benchRoot = resolve(here, '..')

function rng(seed) { // mulberry32
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pad = (n, w = 3) => String(n).padStart(w, '0')
const WORDS = ['alpha', 'bravo', 'cedar', 'delta', 'ember', 'flint', 'grove', 'harbor', 'iris', 'jade', 'kilo', 'lumen']

function compSfc(name, kids, r) {
  const id = name.toLowerCase()
  const items = Array.from({ length: 4 }, (_, i) => `'${WORDS[Math.floor(r() * WORDS.length)]}-${i}'`).join(', ')
  const nested = kids.map((k) => `<${k} :label="label + '>'" />`).join('\n    ')
  return `<template>
  <div class="cmp ${id}" data-comp="${name}">
    <strong class="${id}-t">{{ label }} · {{ count }} / {{ doubled }}</strong>
    <ul><li v-for="it in items" :key="it" :class="{ on: it === picked }" @click="pick(it)">{{ it }}</li></ul>
    <button type="button" @click="inc">+</button>
    ${nested}
  </div>
</template>

<script>
export default {
  props: { label: { type: String, default: '${name}' } },
  data() { return { count: ${Math.floor(r() * 9)}, picked: '', items: [${items}] } },
  computed: { doubled() { return this.count * 2 } },
  methods: { inc() { this.count++ }, pick(it) { this.picked = it } },
}
</script>

<style>
.${id} { border: 1px solid #ddd; padding: 4px 8px; margin: 4px 0; border-radius: 4px; }
.${id}-t { color: hsl(${Math.floor(r() * 360)}, 60%, 35%); }
.${id} li.on { font-weight: bold; }
.${id} button { cursor: pointer; }
</style>
`
}

function pageSfc(key, title, comps, r, dynamicKind) {
  const cls = 'pg-' + key.replace(/[^a-z0-9]/gi, '-')
  const rows = Array.from({ length: 30 }, (_, i) =>
    `      { id: ${i + 1}, name: '${WORDS[Math.floor(r() * WORDS.length)]}-${pad(Math.floor(r() * 999))}', qty: ${1 + Math.floor(r() * 50)}, price: ${(5 + Math.floor(r() * 9000)) / 10} }`).join(',\n')
  const tags = comps.map((c) => `<${c} label="${c} on ${key}" />`).join('\n      ')
  const idLine = dynamicKind ? `<p class="${cls}-id">${dynamicKind} #{{ routeId }}</p>` : ''
  return `<template>
  <div class="pg ${cls}">
    <h1>${title}</h1>
    ${idLine}
    <span v-if="ready" data-testid="ready" data-page="${key}"></span>
    <table class="${cls}-tbl">
      <thead><tr><th>#</th><th>name</th><th>qty</th><th>price</th></tr></thead>
      <tbody>
        <tr v-for="row in filtered" :key="row.id"><td>{{ row.id }}</td><td>{{ row.name }}</td><td>{{ row.qty }}</td><td>{{ row.price }}</td></tr>
      </tbody>
      <tfoot><tr><td colspan="4">total {{ total }} ({{ filtered.length }} rows)</td></tr></tfoot>
    </table>
    <form @submit.prevent="submit">
      <input v-model="query" placeholder="filter" />
      <input v-model="form.name" placeholder="name" />
      <input v-model="form.email" placeholder="email" />
      <select v-model="form.kind"><option value="a">A</option><option value="b">B</option></select>
      <button type="submit">save ({{ saved }})</button>
    </form>
    <section class="${cls}-comps">
      ${tags}
    </section>
    <nav class="pager">
      <router-link data-testid="prev" to="__PREV__">prev</router-link>
      <router-link data-testid="next" to="__NEXT__">next</router-link>
    </nav>
  </div>
</template>

<script>
export default {
  data() {
    return {
      ready: false, query: '', saved: 0, form: { name: '', email: '', kind: 'a' },
      rows: [
${rows},
      ],
    }
  },
  computed: {
    filtered() { const q = this.query.trim(); return q ? this.rows.filter((r) => r.name.includes(q)) : this.rows },
    total() { return this.filtered.reduce((s, r) => s + r.qty * r.price, 0).toFixed(1) },
    routeId() { return this.$route.params.id },
  },
  methods: { submit() { this.saved++ } },
  mounted() { this.ready = true },
}
</script>

<style>
.${cls} { padding: 8px; }
.${cls} h1 { color: hsl(${Math.floor(r() * 360)}, 55%, 30%); font-size: 20px; }
.${cls}-tbl { border-collapse: collapse; width: 100%; }
.${cls}-tbl td, .${cls}-tbl th { border: 1px solid #ccc; padding: 2px 6px; }
.${cls} form input { margin-right: 6px; }
</style>
`
}

const layoutSfc = `<template>
  <div class="layout">
    <header class="top">
      <router-link to="/">home</router-link>
      <router-link to="/p001">p001</router-link>
      <router-link to="/p002">p002</router-link>
      <router-link to="/p003">p003</router-link>
    </header>
    <main><slot /></main>
    <footer class="bottom">bench app</footer>
  </div>
</template>

<script>
export default { name: 'DefaultLayout' }
</script>

<style>
.layout .top a { margin-right: 10px; }
.layout .bottom { color: #888; margin-top: 12px; }
</style>
`

export function generate(size, outRoot = resolve(benchRoot, 'apps')) {
  const { pages: P, comps: C, home, dyn: dynOpt } = SIZES[size]
  const r = rng(20260101 + P * 1000 + C)
  const dir = resolve(outRoot, size)
  rmSync(dir, { recursive: true, force: true })
  const names = Array.from({ length: C }, (_, i) => 'Comp' + pad(i))

  // 컴포넌트 중첩: 3의 배수 인덱스 컴포넌트는 (3의 배수가 아닌) 더 큰 인덱스 컴포넌트를 1~2개 포함 → 깊이 ≤ 2, 순환 불가
  const kids = names.map((_, i) => {
    if (i % 3 !== 0) return []
    const cand = names.map((n, j) => j).filter((j) => j > i && j % 3 !== 0)
    if (!cand.length) return []
    const n = 1 + Math.floor(r() * 2)
    return Array.from({ length: n }, () => names[cand[Math.floor(r() * cand.length)]]).filter((v, k, a) => a.indexOf(v) === k)
  })
  const treeOf = (name, seen = new Set()) => { if (!seen.has(name)) { seen.add(name); kids[names.indexOf(name)].forEach((k) => treeOf(k, seen)) } return seen }
  const rendered = (name) => 1 + kids[names.indexOf(name)].reduce((s, k) => s + rendered(k), 0)

  // 페이지 목록: index + pNNN + 동적. 일부(10번째마다) 컴포넌트 미사용
  const dynCount = dynOpt ?? (size === 'S' ? 1 : size === 'M' ? 3 : 5)
  const plain = P - 1 - dynCount
  const keys = ['index', ...Array.from({ length: plain }, (_, i) => 'p' + pad(i + 1)), ...DYNAMIC.slice(0, dynCount).map((d) => `${d}/[id]`)]
  const order = [...keys]
  // 이동 체인(경로): 동적 페이지는 plain 사이에 끼워 넣는다
  const pathOf = (k, i) => (k === 'index' ? '/' : k.includes('[id]') ? '/' + k.replace('[id]', String(i + 1)) : '/' + k)
  const chainKeys = ['index']
  const plainKeys = keys.filter((k) => /^p\d+$/.test(k)); const dynKeys = keys.filter((k) => k.includes('['))
  const every = Math.max(1, Math.floor(plainKeys.length / (dynKeys.length + 1)))
  let di = 0
  plainKeys.forEach((k, i) => { chainKeys.push(k); if ((i + 1) % every === 0 && di < dynKeys.length) chainKeys.push(dynKeys[di++]) })
  while (di < dynKeys.length) chainKeys.push(dynKeys[di++])
  const chainPaths = chainKeys.map((k, i) => pathOf(k, i))

  // 컴포넌트 배정: 커서를 돌려 모든 컴포넌트가 최소 1번 쓰이게(사용 가능 횟수가 충분하면)
  let cursor = 0
  const pageComps = {}
  keys.forEach((k, i) => {
    if (i % 10 === 9) { pageComps[k] = []; return } // 컴포넌트 미사용 페이지
    const n = 3 + Math.floor(r() * 4) // 3~6
    const list = []
    while (list.length < n) {
      const c = names[cursor % C]; cursor += 1 + (r() < 0.3 ? Math.floor(r() * 3) : 0)
      if (!list.includes(c)) list.push(c)
    }
    pageComps[k] = list
  })
  if (home) pageComps.index = names.slice(0, home)

  const vz = resolve(dir, 'vz'), nu = resolve(dir, 'nuxt')
  for (const base of [vz, nu]) {
    mkdirSync(resolve(base, 'components'), { recursive: true })
    mkdirSync(resolve(base, 'pages'), { recursive: true })
    mkdirSync(resolve(base, 'layouts'), { recursive: true })
  }
  const write = (rel, content) => { for (const base of [vz, nu]) { mkdirSync(dirname(resolve(base, rel)), { recursive: true }); writeFileSync(resolve(base, rel), content) } }

  names.forEach((n, i) => write(`components/${n}.vue`, compSfc(n, kids[i], r)))
  write('layouts/default.vue', layoutSfc)
  const manifest = { size, pages: {}, chain: chainPaths, chainKeys, componentCount: C, pageCount: keys.length }
  keys.forEach((k) => {
    const ci = chainKeys.indexOf(k)
    const prev = chainPaths[(ci - 1 + chainKeys.length) % chainKeys.length]
    const next = chainPaths[(ci + 1) % chainKeys.length]
    const dyn = k.includes('[') ? k.split('/')[0] : null
    const title = k === 'index' ? 'Home' : dyn ? `${dyn} detail` : 'Page ' + k
    const sfc = pageSfc(k, title, pageComps[k], r, dyn).replace('__PREV__', prev).replace('__NEXT__', next)
    write(`pages/${k}.vue`, sfc)
    manifest.pages[k] = { path: chainPaths[ci], components: pageComps[k], expectedCompNodes: pageComps[k].reduce((s, c) => s + rendered(c), 0) }
  })
  // vue-zero 전용 매니페스트 + index.html
  writeFileSync(resolve(vz, 'components/components.json'), JSON.stringify(names))
  writeFileSync(resolve(vz, 'pages/pages.json'), JSON.stringify(keys))
  writeFileSync(resolve(vz, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>bench-${size}</title>
  <script src="/lib/vue.js"></script>
  <script src="/lib/vue-router.js"></script>
  <script src="/lib/vue-zero.js"></script>
</head>
<body>
  <div id="app"></div>
  <script>VueZero.createApp()</script>
</body>
</html>
`)
  // 보조 변형용 index.html: 앱 측 <link rel=preload> 힌트(라이브러리 변경 없음). A=매니페스트+레이아웃+홈 페이지, B=A+홈이 쓰는 컴포넌트 전체(중첩 포함)
  const homeTree = [...new Set(pageComps.index.flatMap((c) => [...treeOf(c)]))]
  const link = (u) => `  <link rel="preload" as="fetch" href="${u}" crossorigin>\n`
  const hintsA = ['/pages/pages.json', '/components/components.json', '/layouts/default.vue', '/pages/index.vue'].map(link).join('')
  const hintsB = hintsA + homeTree.map((c) => link(`/components/${c}.vue`)).join('')
  const baseHtml = readFileSync(resolve(vz, 'index.html'), 'utf8')
  writeFileSync(resolve(vz, 'index.hintsA.html'), baseHtml.replace('</head>', hintsA + '</head>'))
  writeFileSync(resolve(vz, 'index.hintsB.html'), baseHtml.replace('</head>', hintsB + '</head>'))
  manifest.homeTree = homeTree
  // Nuxt 소스 (app.vue). nuxt.config.ts 는 bench/nuxt-app 에 고정
  writeFileSync(resolve(nu, 'app.vue'), `<template>\n  <NuxtLayout>\n    <NuxtPage />\n  </NuxtLayout>\n</template>\n`)
  writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 1))
  const used = new Set(Object.values(manifest.pages).flatMap((p) => p.components))
  console.log(`[gen] ${size}: pages=${keys.length} comps=${C} usedDirect=${used.size} chain=${chainPaths.length} -> ${dir}`)
  return manifest
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const want = process.argv.slice(2).filter((s) => SIZES[s])
  for (const s of want.length ? want : Object.keys(SIZES)) generate(s)
}
