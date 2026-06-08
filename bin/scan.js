#!/usr/bin/env node

import { readdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, relative, basename, extname } from 'path'

const appDir = process.argv[2] || 'app'

function scanVueFiles(dir) {
  const results = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...scanVueFiles(full))
    } else if (extname(entry) === '.vue') {
      results.push(full)
    }
  }
  return results
}

function syncJson(dir, jsonFile, toName) {
  if (!existsSync(dir)) return

  const files = scanVueFiles(dir)
  const names = files
    .map(f => toName(relative(dir, f)))
    .filter(Boolean)
    .sort()

  const jsonPath = join(dir, jsonFile)
  const prev = existsSync(jsonPath) ? readFileSync(jsonPath, 'utf-8').trim() : '[]'
  const next = JSON.stringify(names)

  if (prev === next) {
    console.log(`  ${jsonFile} — no changes`)
    return
  }

  writeFileSync(jsonPath, next + '\n')

  // diff
  const prevSet = new Set(JSON.parse(prev))
  const nextSet = new Set(names)
  for (const n of names) if (!prevSet.has(n)) console.log(`  + ${n}`)
  for (const n of prevSet) if (!nextSet.has(n)) console.log(`  - ${n}`)
}

// pages: strip .vue, exclude 404
console.log(`[vue-zero] scanning ${appDir}/pages`)
syncJson(join(appDir, 'pages'), 'pages.json', rel => {
  const name = rel.replace(/\\/g, '/').replace(/\.vue$/, '')
  return name === '404' ? null : name
})

// components: strip .vue, keep PascalCase name only
console.log(`[vue-zero] scanning ${appDir}/components`)
syncJson(join(appDir, 'components'), 'components.json', rel => {
  return basename(rel, '.vue')
})
