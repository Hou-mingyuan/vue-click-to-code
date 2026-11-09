import options from 'virtual:click-to-code-options'
import { mountInspector } from './runtime.mjs'
import { traceElement } from './trace-vue.mjs'

const dispose = mountInspector(options, traceElement)
import.meta.hot?.dispose(dispose)
