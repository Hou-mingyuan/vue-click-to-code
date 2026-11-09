import type { Compiler, WebpackPluginInstance } from 'webpack'

declare function createWebpackInspector(options?: createWebpackInspector.Options): {
  plugin: WebpackPluginInstance & { apply(compiler: Compiler): void }
  setupMiddlewares<T extends Array<unknown>>(middlewares: T, devServer?: unknown): T
}
declare namespace createWebpackInspector {
  interface Options {
    root?: string
    base?: string
    editor?: 'vscode' | 'webstorm'
    shortcut?: string
    editors?: Partial<Record<'vscode' | 'webstorm', string>>
    openInEditor?: (location: { file: string; line: number; column: number; editor: 'vscode' | 'webstorm'; executable: string }) => void | Promise<void>
  }
}
export = createWebpackInspector
