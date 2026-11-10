// stress 앱의 컴포넌트 300개와 페이지를 생성한다. 생성물은 .gitignore 대상 (apps/stress/{pages,components}).
// 사용: node test/scripts/gen-stress.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const COUNT = 300
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../apps/stress')
const pad = (i) => 'C' + String(i).padStart(3, '0')
const names = Array.from({ length: COUNT }, (_, i) => pad(i))

rmSync(resolve(root, 'components'), { recursive: true, force: true })
rmSync(resolve(root, 'pages'), { recursive: true, force: true })
mkdirSync(resolve(root, 'components'), { recursive: true })
mkdirSync(resolve(root, 'pages'), { recursive: true })

// 일반 컴포넌트. C100~C108 은 다음 번호 컴포넌트를 포함해 깊이 10 체인(C100 -> ... -> C109)을 만든다.
for (const [i, n] of names.entries()) {
  const child = i >= 100 && i < 109 ? `<${pad(i + 1)} />` : ''
  writeFileSync(resolve(root, `components/${n}.vue`),
    `<template><span class="c" data-c="${n}">${n}${child}</span></template>\n<script>\nexport default {}\n</script>\n`)
}
writeFileSync(resolve(root, 'components/components.json'), JSON.stringify(names))

const page = (name, body) =>
  writeFileSync(resolve(root, `pages/${name}.vue`),
    `<template><div><h1 data-testid="page">${name}</h1>${body}</div></template>\n<script>\nexport default {}\n</script>\n`)
page('index', '')
page('small', ['C010', 'C011', 'C012'].map((n) => `<${n} />`).join(''))
page('chain', '<C100 />')
page('many', Array.from({ length: 20 }, (_, i) => `<${pad(200 + i)} />`).join(''))
page('all', names.map((n) => `<${n} />`).join(''))
writeFileSync(resolve(root, 'pages/pages.json'), JSON.stringify(['index', 'small', 'chain', 'many', 'all']))
console.log(`[gen-stress] ${COUNT} components + 5 pages -> ${root}`)
