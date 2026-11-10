const { randomBytes } = require('node:crypto')

function normalizeOptions(options = {}) {
  const editor = options.editor ?? 'vscode'
  if (!['vscode', 'webstorm'].includes(editor)) throw new Error('clickToCode.editor 只支持 vscode 或 webstorm。')
  const shortcutInput = options.shortcut ?? 'alt-backquote'
  if (typeof shortcutInput !== 'string') throw new Error('clickToCode.shortcut 必须是字符串。')
  const shortcut = shortcutInput.replace(/-`$/, '-backquote')
  if (!/^(?:(?:control|alt|shift|meta)-)+(?:[a-z0-9]|backquote)$/.test(shortcut)) {
    throw new Error('快捷键格式示例：alt-backquote 或 meta-shift-c。')
  }
  const keys = shortcut.split('-')
  if (new Set(keys).size !== keys.length) throw new Error('快捷键不能重复包含同一个修饰键。')
  if (keys.length === 3 && keys.includes('alt') && keys.includes('shift') && keys.includes('backquote')) {
    throw new Error('Alt + Shift + 反引号 用于显示/隐藏工具栏，请选择其他元素选取快捷键。')
  }
  const editors = { vscode: 'code', webstorm: 'webstorm', ...options.editors }
  for (const name of ['vscode', 'webstorm']) {
    if (typeof editors[name] !== 'string' || !editors[name].trim() || /[\r\n\0]/.test(editors[name])) {
      throw new Error(`clickToCode.editors.${name} 必须是有效的命令或可执行文件路径。`)
    }
  }
  // Instrumentation and file-open boundary, resolved against the bundler
  // config by each entry point. Defaults to undefined (bundler root) so
  // single-package projects keep the previous behaviour; pass the workspace
  // root to cover sibling packages in a monorepo.
  const root = options.root
  if (root !== undefined) {
    if (typeof root !== 'string' || !root.trim() || /[\r\n\0]/.test(root)) {
      throw new Error('clickToCode.root 必须是有效的目录路径。')
    }
  }
  // Package-name prefixes allowed inside node_modules (e.g. ["@dsf/"] or
  // ["@dsf/antdv-ui"]). Dist bundles of first-party libraries are then
  // instrumented too, so clicks can land inside the library's own code.
  const includePackages = options.includePackages ?? []
  if (!Array.isArray(includePackages)
      || includePackages.some(name => typeof name !== 'string' || !name.trim() || /[\r\n\0]/.test(name))) {
    throw new Error('clickToCode.includePackages 必须是包名前缀数组，例如 ["@dsf/"] 或 ["@dsf/antdv-ui"]。')
  }
  return { editor, shortcut, editors, root, includePackages, token: randomBytes(24).toString('hex') }
}

module.exports = { normalizeOptions }
