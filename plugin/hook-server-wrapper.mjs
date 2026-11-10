// Wraps vite's chunks/server.js: createServer gets vue-click-to-code plugins
// appended into inlineConfig. The real module URL arrives as the ?real=
// query param on this module's own URL (set by hook-loader.mjs; loader hooks
// run on a separate thread, so globals cannot be shared).
// cli.js imports exactly one binding from chunks/server.js: createServer.
const realUrl = new URL(import.meta.url).searchParams.get('real')
if (!realUrl) {
  throw new Error('[click-to-code] hook-server-wrapper loaded without ?real= vite server url')
}

const viteServer = await import(realUrl)
const clickToCode = (await import('./vite.mjs')).default
const { existsSync, readFileSync } = await import('node:fs')
const { dirname, join } = await import('node:path')

// Walk up from cwd to the workspace root (pnpm-workspace.yaml or a
// package.json with "workspaces"), so sibling packages get instrumented too.
function findWorkspaceRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        if (pkg.workspaces) return dir
      } catch {}
    }
    const parent = dirname(dir)
    if (parent === dir) return start
    dir = parent
  }
}

// Hook mode has no user options: pick the editor automatically.
// Priority: VUE_CLICK_TO_CODE_EDITOR env > WebStorm install > VS Code install
// > the bare CLI name (launch-editor falls back to guessing).
const USER_ENV = process.env.VUE_CLICK_TO_CODE_EDITOR
const HOMEDIR = (await import('node:os')).homedir()
const EDITOR_CANDIDATES = [
  ['webstorm', join(HOMEDIR, 'AppData', 'Local', 'Programs', 'WebStorm', 'bin', 'webstorm64.exe')],
  ['vscode', join(HOMEDIR, 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'bin', 'code')],
  ['vscode', join(HOMEDIR, 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe')],
]
function detectEditor() {
  if (USER_ENV && USER_ENV.trim()) {
    return /webstorm/i.test(USER_ENV)
      ? { editor: 'webstorm', editors: { webstorm: USER_ENV } }
      : { editor: 'vscode', editors: { vscode: USER_ENV } }
  }
  for (const [editor, exe] of EDITOR_CANDIDATES) {
    if (existsSync(exe)) return { editor, editors: { [editor]: exe } }
  }
  return { editor: 'webstorm' }
}

async function createServer(inlineConfig = {}) {
  const root = findWorkspaceRoot(process.cwd())
  const detected = detectEditor()
  const plugins = [...(inlineConfig.plugins ?? []), ...clickToCode({ root, ...detected })]
  console.info('[click-to-code] hook mode: injecting (editor: %s, root: %s)', detected.editor, root)
  return viteServer.createServer({ ...inlineConfig, plugins })
}

export { createServer }
export default viteServer
