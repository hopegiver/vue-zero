import esbuild from 'esbuild'
import { copyFile, mkdir } from 'fs/promises'

await esbuild.build({
  entryPoints: ['src/vue-zero.ts'],
  bundle: true,
  outfile: 'dist/vue-zero.js',
  format: 'iife',
  globalName: 'VueZero',
  external: ['vue', 'vue-router'],
  platform: 'browser',
  target: 'es2020',
  minify: true,
})

// app/dist/ 에도 복사 — wrangler dev/deploy 시 정적 파일로 서빙
await mkdir('app/dist', { recursive: true })
await copyFile('dist/vue-zero.js', 'app/dist/vue-zero.js')

console.log('bundle done → dist/vue-zero.js, app/dist/vue-zero.js')
