const path = require('node:path')
const { normalizeOptions } = require('./options.cjs')

function createWebpackInspector(options = {}) {
  const normalized = normalizeOptions(options)
  const root = path.resolve(options.root || process.cwd())
  const base = options.base || '/'
  if (!base.startsWith('/') || !base.endsWith('/') || base.startsWith('//')) throw new Error('base 必须是以 / 开头和结尾的路径。')
  let enabled = false
  const bootstrap = path.join(__dirname, 'webpack-client.mjs')
  const loader = path.join(__dirname, 'webpack-loader.cjs')
  function injectEntry(entries) {
    for (const value of Object.values(entries)) {
      if (!value.import) continue
      if (!value.import.includes(bootstrap)) value.import.unshift(bootstrap)
    }
    return entries
  }
  return {
    plugin: {
      apply(compiler) {
        enabled = compiler.options.mode === 'development'
        if (!enabled) return
        const entry = compiler.options.entry
        compiler.options.entry = typeof entry === 'function' ? async () => injectEntry(await entry()) : injectEntry(entry)
        compiler.options.module.rules.unshift({
          test: /\.(vue|jsx|tsx|js|ts|mjs|html)$/,
          exclude: normalized.includePackages.length
            ? filepath => {
                const match = filepath.match(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/)
                if (!match) return false
                const pkg = match[1].replaceAll('\\', '/')
                return !normalized.includePackages.some(prefix =>
                  prefix.endsWith('/') ? pkg.startsWith(prefix) : pkg === prefix || pkg.startsWith(`${prefix}/`))
              }
            : /[\\/]node_modules[\\/]/,
          enforce: 'pre', use: [{ loader, options: { root, includePackages: normalized.includePackages } }],
        })
        new compiler.webpack.DefinePlugin({ __CLICK_TO_CODE_BOOTSTRAP__: JSON.stringify({
          editor: normalized.editor, shortcut: normalized.shortcut, token: normalized.token,
          base, projectKey: root,
        }) }).apply(compiler)
      },
    },
    setupMiddlewares(middlewares, devServer) {
      if (!enabled) return middlewares
      const middleware = import('./middleware.mjs').then(({ createInspectorMiddleware }) => createInspectorMiddleware({
        ...normalized, root, base, openInEditor: options.openInEditor,
      }))
      middlewares.unshift({
        name: 'click-to-code',
        middleware(req, res, next) { middleware.then(handle => handle(req, res, next)).catch(next) },
      })
      return middlewares
    },
  }
}
module.exports = createWebpackInspector
module.exports.createWebpackInspector = createWebpackInspector
