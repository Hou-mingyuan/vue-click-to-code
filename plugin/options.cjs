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
  return { editor, shortcut, editors, token: randomBytes(24).toString('hex') }
}

module.exports = { normalizeOptions }
