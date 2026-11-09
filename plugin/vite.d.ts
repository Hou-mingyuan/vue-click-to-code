import type { PluginOption } from 'vite'
import type { ClickToCodeOptions } from './index.js'
export type { ClickToCodeOptions, Editor, SourceLocation } from './index.js'
export default function clickToCode(options?: ClickToCodeOptions): PluginOption[]
