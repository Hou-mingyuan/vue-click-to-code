import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { normalizeOptions } from './options.cjs'
import { createInspectorMiddleware } from './middleware.mjs'
import { instrumentSource } from './transform.mjs'

const virtualId = 'virtual:click-to-code-options'
const clientId = 'virtual:click-to-code-universal-client'
const clientFile = fileURLToPath(new URL('./universal-client.mjs', import.meta.url)).replaceAll('\\', '/')
const runtimeVersion = createRequire(import.meta.url)('../package.json').version

// optimizeDeps.exclude needs exact package names, while includePackages accepts
// prefixes like "@dsf/". Expand prefixes against dependency lists of the
// project package.json files we can reach (cwd + absolute root if given).
function expandPackages(prefixes, roots) {
  const names = new Set()
  const matches = (name) => prefixes.some(prefix => name === prefix
    || (prefix.endsWith('/') ? name.startsWith(prefix) : name.startsWith(prefix + '/')))
  for (const dir of roots) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const name of Object.keys(pkg[key] ?? {})) if (matches(name)) names.add(name)
      }
    } catch { /* no package.json here — skip */ }
  }
  return [...names]
}

export default function clickToCode(options = {}) {
  const normalized = normalizeOptions(options)
  let config
  let root
  return [{
    name: 'click-to-code:universal-vite', enforce: 'pre', apply: 'serve',
    config() {
      // Whitelisted packages must skip dependency pre-bundling, otherwise
      // they are served from esbuild chunks in .vite/deps and never pass
      // through this plugin's transform hook.
      if (!normalized.includePackages?.length) return
      const roots = [process.cwd()]
      if (normalized.root !== undefined && path.isAbsolute(normalized.root)) roots.push(normalized.root)
      const exclude = expandPackages(normalized.includePackages, roots)
      if (exclude.length) return { optimizeDeps: { exclude } }
    },
    configResolved(resolved) {
      config = resolved
      // Resolve a relative `root` against the vite config file so "../../"
      // means "two levels up from vite.config.ts".
      root = normalized.root !== undefined
        ? path.resolve(path.dirname(config.configFile ?? config.root), normalized.root)
        : config.root
    },
    resolveId(id) {
      if (id === virtualId) return `\0${virtualId}`
      if (id === clientId) return clientFile
    },
    load(id) {
      if (id === clientFile) return readFileSync(clientFile, 'utf8')
      if (id === `\0${virtualId}`) return `export default ${JSON.stringify({
        editor: normalized.editor, shortcut: normalized.shortcut, token: normalized.token,
        base: config.base, projectKey: config.root, runtimeVersion,
      })}`
    },
    transform(code, id) {
      if (id.includes('?')) return
      return instrumentSource(code, id, root, normalized.includePackages)
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return instrumentSource(html, context.filename, root, normalized.includePackages)?.code ?? html
      },
    },
    configureServer(server) {
      server.middlewares.use(createInspectorMiddleware({
        ...normalized, root, sourceRoot: root, base: config.base,
        openInEditor: options.openInEditor,
      }))
    },
  }, {
    name: 'click-to-code:universal-client', apply: 'serve',
    transformIndexHtml() {
      return [{ tag: 'script', attrs: { type: 'module', src: `${config.base}@id/${clientId}` }, injectTo: 'head' }]
    },
  }]
}
