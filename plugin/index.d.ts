import type { PluginOption } from 'vite'

export type Editor = 'vscode' | 'webstorm'
export interface SourceLocation {
  file: string
  line: number
  column: number
  editor: Editor
  executable: string
}
export interface ClickToCodeOptions {
  /** Default IDE. The page toolbar can switch between the two supported editors. */
  editor?: Editor
  /** Default: alt-backquote (Alt + `). Alt + Shift + ` is reserved for toolbar visibility. */
  shortcut?: string
  /** CLI names or absolute executable paths, configured on the development server. */
  editors?: Partial<Record<Editor, string>>
  /**
   * Instrumentation and file-open boundary. Defaults to the bundler root.
   * In a monorepo, pass the workspace root (relative paths resolve against
   * vite.config.ts) so sibling packages get element-level markers too.
   */
  root?: string
  /** Override the launcher, useful for remote development or integration testing. */
  openInEditor?: (location: SourceLocation) => void | Promise<void>
}
export default function clickToCode(options?: ClickToCodeOptions): PluginOption[]
