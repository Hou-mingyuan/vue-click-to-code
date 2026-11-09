import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { normalizeOptions } from './options.cjs'
import { createInspectorMiddleware } from './middleware.mjs'
import { instrumentSource } from './transform.mjs'

const virtualId = 'virtual:click-to-code-options'
const clientId = 'virtual:click-to-code-universal-client'
const clientFile = fileURLToPath(new URL('./universal-client.mjs', import.meta.url)).replaceAll('\\', '/')

export default function clickToCode(options = {}) {
  const normalized = normalizeOptions(options)
  let config
  return [{
    name: 'click-to-code:universal-vite', enforce: 'pre', apply: 'serve',
    configResolved(resolved) { config = resolved },
    resolveId(id) {
      if (id === virtualId) return `\0${virtualId}`
      if (id === clientId) return clientFile
    },
    load(id) {
      if (id === clientFile) return readFileSync(clientFile, 'utf8')
      if (id === `\0${virtualId}`) return `export default ${JSON.stringify({
        editor: normalized.editor, shortcut: normalized.shortcut, token: normalized.token,
        base: config.base, projectKey: config.root,
      })}`
    },
    transform(code, id) {
      if (id.includes('?')) return
      return instrumentSource(code, id, config.root)
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return instrumentSource(html, context.filename, config.root)?.code ?? html
      },
    },
    configureServer(server) {
      server.middlewares.use(createInspectorMiddleware({
        ...normalized, root: config.root, sourceRoot: config.root, base: config.base,
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
