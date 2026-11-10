import options from 'virtual:click-to-code-options'
import { mountInspector } from './runtime.mjs'
import { traceElement } from './trace-universal.mjs'

console.info(`[click-to-code] runtime ${options.runtimeVersion ?? '?'} ready`)
const dispose = mountInspector(options, traceElement)
import.meta.hot?.dispose(dispose)
