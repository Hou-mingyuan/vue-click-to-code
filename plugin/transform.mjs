import path from 'node:path'
import { parse as parseJavaScript } from '@babel/parser'
import { parse as parseMarkup } from '@vue/compiler-dom'
import MagicString from 'magic-string'

const attribute = 'data-click-to-code'
const skipTags = new Set(['template', 'script', 'style', 'html', 'head', 'meta', 'link', 'title', 'slot'])
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

export function instrumentSource(code, filename, root) {
  const relative = path.relative(root, filename)
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || relative.split(path.sep).includes('node_modules')) return
  const extension = path.extname(filename).toLowerCase()
  if (!['.vue', '.html', '.jsx', '.tsx', '.js', '.ts', '.mjs'].includes(extension)) return
  const source = relative.replaceAll('\\', '/')
  const s = new MagicString(code)
  // Columns are stored 1-based: trace-universal.mjs rejects column 0 and
  // converts back with `column - 1`, matching the JSX branch below.
  const position = (line, column) => `${source}:${line}:${column + 1}`
  if (extension === '.vue' || extension === '.html') {
    const ast = parseMarkup(code, { parseMode: extension === '.vue' ? 'sfc' : 'html' })
    function visit(node) {
      if (node.type !== 1) return
      if (node.tag === 'script' || node.tag === 'style') return
      if (node.tag === 'template') {
        const lang = node.props.find(prop => prop.type === 6 && prop.name === 'lang')
        if (lang?.value && lang.value.content !== 'html') return
      }
      if (!skipTags.has(node.tag) && !node.props.some(prop => prop.type === 6 && prop.name === attribute)) {
        const { line, column, offset } = node.loc.start
        s.appendLeft(offset + node.tag.length + 1, ` ${attribute}="${escapeAttribute(position(line, column))}"`)
      }
      node.children?.forEach(visit)
    }
    for (const node of ast.children) {
      if (extension === '.vue' && node.tag !== 'template') continue
      visit(node)
    }
  } else {
    if (!code.includes('<')) return
    const ast = parseJavaScript(code, {
      sourceType: 'unambiguous', allowAwaitOutsideFunction: true,
      plugins: [...(extension === '.ts' ? [] : ['jsx']), 'decorators-legacy', ...(['.ts', '.tsx'].includes(extension) ? ['typescript'] : [])],
    })
    const stack = [ast]
    while (stack.length) {
      const node = stack.pop()
      if (!node || typeof node !== 'object') continue
      if (node.type === 'JSXOpeningElement') {
        const tag = node.name.type === 'JSXIdentifier' ? node.name.name : node.name.property?.name
        if (tag !== 'Fragment' && !node.attributes.some(prop => prop.type === 'JSXAttribute' && prop.name.name === attribute)) {
          const value = position(node.loc.start.line, node.loc.start.column)
          s.appendLeft(node.name.end, ` ${attribute}={${JSON.stringify(value)}}`)
        }
      }
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'comments', 'tokens'].includes(key)) continue
        if (Array.isArray(value)) stack.push(...value)
        else if (value && typeof value === 'object' && value.type) stack.push(value)
      }
    }
  }
  if (!s.hasChanged()) return
  return { code: s.toString(), map: s.generateMap({ source: filename, includeContent: true, hires: true }) }
}
