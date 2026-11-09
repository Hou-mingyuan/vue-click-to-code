import { findTraceFromElement, findTraceFromVNode } from 'vite-plugin-vue-inspector/client/record'

function isBusiness(trace) {
  return trace && !trace.filepath.replaceAll('\\', '/').split('/').includes('node_modules')
}

export function traceElement(element) {
  const direct = findTraceFromElement(element)
  if (isBusiness(direct)) return direct
  const visited = new Set()
  for (const start of [element.__vueParentComponent, element.__vnode?.ctx]) {
    for (let instance = start; instance && !visited.has(instance); instance = instance.parent) {
      visited.add(instance)
      const trace = findTraceFromVNode(instance.vnode, element)
      if (isBusiness(trace)) return trace
    }
  }
}
