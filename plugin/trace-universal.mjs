export const SOURCE_ATTRIBUTE = 'data-click-to-code'
export const SCHEMA_ATTRIBUTE = '__clickToCode'

function fromValue(value, element) {
  if (typeof value !== 'string') return
  const match = value.match(/^(.+):(\d+):(\d+)$/)
  if (!match || match[1].replaceAll('\\', '/').split('/').includes('node_modules')) return
  const line = Number(match[2]), column = Number(match[3])
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1) return
  // The UI uses zero-based columns internally; markers use human-readable columns.
  return { filepath: match[1], pos: [match[1], line, column - 1], el: element }
}

// Schema-driven controls (form fields, table columns) receive the config
// object as a prop (formModel/item/...). Prefer its source line: it points
// at where the field was declared, not where the generic renderer sits.
function traceFromProps(props, element) {
  if (!props) return
  for (const value of Object.values(props)) {
    if (value && typeof value === 'object') {
      const trace = fromValue(value[SCHEMA_ATTRIBUTE], element)
      if (trace) return trace
    }
  }
}

export function traceElement(element) {
  const direct = fromValue(element.getAttribute(SOURCE_ATTRIBUTE), element)
  if (direct) return direct
  // Vue 3 component ownership also works for teleported third-party controls.
  const visited = new Set()
  for (const start of [element.__vueParentComponent, element.__vnode?.ctx]) {
    for (let instance = start; instance && !visited.has(instance); instance = instance.parent) {
      visited.add(instance)
      const trace = traceFromProps(instance.vnode?.props, element)
        ?? fromValue(instance.vnode?.props?.[SOURCE_ATTRIBUTE], element)
      if (trace) return trace
    }
  }
  // Vue 2 keeps caller attributes on the component VNode.
  for (let instance = element.__vue__; instance && !visited.has(instance); instance = instance.$parent) {
    visited.add(instance)
    const trace = traceFromProps(instance.$vnode?.data?.attrs, element)
      ?? fromValue(instance.$vnode?.data?.attrs?.[SOURCE_ATTRIBUTE], element)
    if (trace) return trace
  }
  // A library component may consume props instead of forwarding them to the DOM.
  // Fiber is a development implementation detail, so missing fields simply fall back.
  const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'))
  for (let fiber = fiberKey && element[fiberKey]; fiber && !visited.has(fiber); fiber = fiber.return) {
    visited.add(fiber)
    const trace = fromValue(fiber.memoizedProps?.[SOURCE_ATTRIBUTE], element)
    if (trace) return trace
  }
}
