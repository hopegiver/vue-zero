import esbuild from 'esbuild'
import { copyFile, mkdir, readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(await readFile(resolve(__dirname, 'package.json'), 'utf8'))
const templateAssets = resolve(__dirname, '../template/app/assets/js')

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
  define: { __VZ_VERSION__: JSON.stringify(version) },
})

console.log('bundle done → dist/vue-zero.js')

try {
  if (process.env.VZ_NO_TEMPLATE_COPY) throw new Error('skip')
  await mkdir(templateAssets, { recursive: true })
  await copyFile('dist/vue-zero.js', resolve(templateAssets, 'vue-zero.js'))
  console.log('  copied → ../template/app/assets/js/vue-zero.js')
} catch {
  // template 폴더가 없으면 무시
}
