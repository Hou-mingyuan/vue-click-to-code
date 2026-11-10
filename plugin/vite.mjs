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

export default function clickToCode(options = {}) {
  const normalized = normalizeOptions(options)
  let config
  let root
  return [{
    name: 'click-to-code:universal-vite', enforce: 'pre', apply: 'serve',
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
