// --import entry for pnpm `node-options=--import ./node_modules/vue-click-to-code/hook.mjs`
// Registers a module loader that wraps vite's dev `createServer` to append
// vue-click-to-code plugins without touching the project's vite.config.ts.
import module from 'node:module'

// Only register the loader for vite dev-ish processes. Everything else
// (build/preview/optimize/lint/test and plain node scripts) stops here at
// the cost of one argv scan.
const argvText = process.argv.slice(1).join(' ')
const isViteCli = /(^|[\\/])(vite|vite\.js|vite\.cjs|vite\.mjs)$/.test(process.argv[1] || '')
  || /(^|[\\/])vite([\\/]|\.)/.test(argvText)
const isBuildLike = /(^|\s)(build|preview|optimize)(\s|$)/.test(argvText)

if (isViteCli && !isBuildLike) {
  module.register(new URL('./hook-loader.mjs', import.meta.url), import.meta.url)
}
