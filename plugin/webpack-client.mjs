import { mountInspector } from './runtime.mjs'
import { traceElement } from './trace-universal.mjs'

const dispose = mountInspector(__CLICK_TO_CODE_BOOTSTRAP__, traceElement)
if (import.meta.webpackHot) import.meta.webpackHot.dispose(dispose)
