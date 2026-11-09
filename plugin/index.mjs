import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Inspector from 'vite-plugin-vue-inspector'
import { EDITORS, launchLocation, readJson, resolveLocation, sendJson } from './server.mjs'

const virtualId = 'virtual:click-to-code-options'
const clientId = 'virtual:click-to-code-client'
const clientFile = fileURLToPath(new URL('./client.mjs', import.meta.url)).replaceAll('\\', '/')

export default function clickToCode(options = {}) {
  const editor = options.editor ?? 'vscode'
  if (!EDITORS.has(editor)) throw new Error('clickToCode.editor 只支持 vscode 或 webstorm。')
  const shortcutInput = options.shortcut ?? 'alt-backquote'
  if (typeof shortcutInput !== 'string') throw new Error('clickToCode.shortcut 必须是字符串。')
  const shortcut = shortcutInput.replace(/-`$/, '-backquote')
  if (!/^(?:(?:control|alt|shift|meta)-)+(?:[a-z0-9]|backquote)$/.test(shortcut)) {
    throw new Error('快捷键格式示例：alt-backquote 或 meta-shift-c。')
  }
  const shortcutKeys = shortcut.split('-')
  if (new Set(shortcutKeys).size !== shortcutKeys.length) throw new Error('快捷键不能重复包含同一个修饰键。')
  if (shortcutKeys.length === 3 && shortcutKeys.includes('alt') && shortcutKeys.includes('shift') && shortcutKeys.includes('backquote')) {
    throw new Error('Alt + Shift + 反引号 用于显示/隐藏工具栏，请选择其他元素选取快捷键。')
  }
  const editors = { vscode: 'code', webstorm: 'webstorm', ...options.editors }
  for (const editorName of EDITORS) {
    if (typeof editors[editorName] !== 'string' || !editors[editorName].trim() || /[\r\n\0]/.test(editors[editorName])) {
      throw new Error(`clickToCode.editors.${editorName} 必须是有效的命令或可执行文件路径。`)
    }
  }
  const token = randomBytes(24).toString('hex')
  let config
  let sourceRoot

  // Reuse the upstream source-location transform without loading its default UI.
  const sourceMapping = Inspector({
    appendTo: /$a/,
    toggleComboKey: false,
    launchEditor: '',
    viteDevtools: false,
  })

  return [
    ...sourceMapping,
    {
      name: 'vue-click-to-code',
      apply: 'serve',
      configResolved(resolved) { config = resolved; sourceRoot = process.cwd() },
      resolveId(id) {
        if (id === virtualId) return `\0${virtualId}`
        if (id === clientId) return clientFile
      },
      load(id) {
        if (id === `\0${virtualId}`) return `export default ${JSON.stringify({
          editor, shortcut, token, base: config.base,
          projectKey: config.root,
        })}`
      },
      transformIndexHtml() {
        return [{ tag: 'script', attrs: { type: 'module', src: `${config.base}@id/${clientId}` }, injectTo: 'head' }]
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Plugin middleware can run before Vite strips a non-root base.
          let pathname
          try { pathname = new URL(req.url ?? '/', 'http://localhost').pathname }
          catch { return sendJson(res, 400, { error: '无效的请求地址。' }) }
          if (pathname !== `${config.base}__click-to-code/open` && pathname !== '/__click-to-code/open') return next()
          if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST 请求。' })
          if (req.headers['x-click-to-code-token'] !== token) return sendJson(res, 403, { error: '请求凭据无效，请刷新页面。' })
          try {
            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
              return sendJson(res, 403, { error: '请求必须来自当前开发页面。' })
            }
            // The upstream recorder emits paths relative to process.cwd(),
            // which can differ from Vite's configured root.
            const location = await resolveLocation(config.root, await readJson(req), editors, sourceRoot)
            await (options.openInEditor ?? launchLocation)(location)
            return sendJson(res, 200, { ok: true })
          } catch (error) {
            return sendJson(res, 400, { error: error.message || '打开源码失败。' })
          }
        })
      },
    },
  ]
}
