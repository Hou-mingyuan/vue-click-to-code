import path from 'node:path'
import { parse as parseJavaScript } from '@babel/parser'
import { parse as parseMarkup } from '@vue/compiler-dom'
import MagicString from 'magic-string'

const attribute = 'data-click-to-code'
const schemaKey = '__clickToCode'
const schemaHints = new Set(['field', 'dataIndex', 'handleClick', 'onClick'])
const skipTags = new Set(['template', 'script', 'style', 'html', 'head', 'meta', 'link', 'title', 'slot'])
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

// Schema-driven UI: object literals inside arrays (e.g. form/table column
// configs with a `field`/`dataIndex` key) get a `__clickToCode` property so
// the runtime can jump from a rendered control to the config line that
// produced it. `offsets` maps script-local babel coordinates onto the whole
// document for MagicString edits.
function instrumentSchemaObjects(script, offsets, docPosition, s) {
  let ast
  try {
    ast = parseJavaScript(script.code, {
      sourceType: 'module', allowAwaitOutsideFunction: true,
      plugins: [...(script.ts ? ['typescript'] : []), 'decorators-legacy'],
    })
  } catch { return }
  const parented = []
  const walk = (node, parent) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ObjectExpression' && parent?.type === 'ArrayExpression') parented.push({ node, parent })
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'comments', 'tokens'].includes(key)) continue
      if (Array.isArray(value)) for (const item of value) walk(item, node)
      else if (value && typeof value === 'object' && value.type) walk(value, node)
    }
  }
  walk(ast.program, null)
  for (const { node } of parented) {
    const keys = node.properties.filter(prop => prop.type === 'ObjectProperty' && !prop.computed)
    const hinted = keys.some(prop => (prop.key.type === 'Identifier' || prop.key.type === 'StringLiteral') && schemaHints.has(prop.key.value ?? prop.key.name))
    if (!hinted || keys.some(prop => prop.key.type === 'Identifier' && prop.key.name === schemaKey)) continue
    const last = keys[keys.length - 1]
    const tail = script.code.slice(last.end, node.end - 1)
    const separator = /,\s*$/.test(tail) ? '' : ', '
    s.appendLeft(offsets.start + node.end - 1, `${separator}${schemaKey}: ${JSON.stringify(docPosition(node.loc.start.line, node.loc.start.column))}`)
  }
}

// First-party library dist bundles import Vue's vnode factories under local
// aliases (`import { createVNode as d } from "vue"`), so resolve the aliases
// from the import statements first, then mark element calls whose first
// argument is a plain tag string.
const runtimeFactories = ['createVNode', 'createElementVNode', 'createElementBlock', 'createBlock', 'h']
function instrumentRuntimeVNodes(code, s, position) {
  let ast
  try {
    ast = parseJavaScript(code, { sourceType: 'module', allowAwaitOutsideFunction: true, plugins: ['decorators-legacy'] })
  } catch { return }
  const factories = new Set()
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration' || node.source.value !== 'vue') continue
    for (const spec of node.specifiers) {
      if (spec.type === 'ImportSpecifier' && runtimeFactories.includes(spec.imported.name)) factories.add(spec.local.name)
    }
  }
  if (!factories.size) return
  const stack = [ast]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (node.type === 'CallExpression' && factories.has(node.callee?.name)
        && node.arguments[0]?.type === 'StringLiteral' && /^[a-zA-Z][\w-]*$/.test(node.arguments[0].value)) {
      const value = JSON.stringify(position(node.loc.start.line, node.loc.start.column))
      const arg1 = node.arguments[1]
      if (!arg1) {
        s.appendLeft(node.arguments[0].end, `, { '${attribute}': ${value} }`)
      } else if (arg1.type === 'NullLiteral') {
        // `createVNode(tag, null, ...)` — replace null with a props object;
        // semantically equivalent (there were no props).
        s.overwrite(arg1.start, arg1.end, `{ '${attribute}': ${value} }`)
      } else if (arg1.type === 'ObjectExpression'
          && !arg1.properties.some(prop => prop.type === 'ObjectProperty' && !prop.computed && (prop.key.name ?? prop.key.value) === attribute)) {
        // Hyphenated key must be quoted inside a JS object literal.
        s.appendLeft(arg1.start + 1, `'${attribute}': ${value},`)
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'comments', 'tokens'].includes(key)) continue
      if (Array.isArray(value)) stack.push(...value)
      else if (value && typeof value === 'object' && value.type) stack.push(value)
    }
  }
}

export function instrumentSource(code, filename, root, includePackages = []) {
  const relative = path.relative(root, filename)
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return
  const segments = relative.split(path.sep)
  const nmIndex = segments.indexOf('node_modules')
  let inLibrary = false
  if (nmIndex !== -1) {
    const pkg = segments[nmIndex + 1]?.startsWith('@')
      ? `${segments[nmIndex + 1]}/${segments[nmIndex + 2]}`
      : segments[nmIndex + 1]
    if (!pkg) return
    const allowed = includePackages.some(prefix =>
      prefix.endsWith('/') ? pkg.startsWith(prefix) : pkg === prefix || pkg.startsWith(`${prefix}/`))
    if (!allowed) return
    inLibrary = true
  }
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
      if (node.type === 1 && node.tag === 'script') {
        const content = node.children?.find(child => child.type === 2)
        if (!content?.content?.trim()) continue
        const lang = node.props.find(prop => prop.type === 6 && prop.name === 'lang')?.value?.content ?? ''
        const start = content.loc.start
        const docPosition = (line, column) => position(
          start.line + line - 1,
          line === 1 ? start.column + column : column,
        )
        instrumentSchemaObjects({ code: content.content, ts: /ts/.test(lang) }, { start: start.offset }, docPosition, s)
        continue
      }
      if (extension === '.vue' && node.tag !== 'template') continue
      visit(node)
    }
  } else if (inLibrary) {
    instrumentRuntimeVNodes(code, s, position)
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
