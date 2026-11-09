import path from 'node:path'
import { realpath, stat } from 'node:fs/promises'
import launch from 'launch-editor'

export const EDITORS = new Set(['vscode', 'webstorm'])

export async function resolveLocation(root, input, editors, sourceRoot = root) {
  if (!input || typeof input.file !== 'string' || !EDITORS.has(input.editor)) {
    throw new Error('无效的源文件或 IDE。')
  }
  for (const key of ['line', 'column']) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 1 || input[key] > 10_000_000) {
      throw new Error('行号和列号必须是正整数。')
    }
  }
  const rootPath = await realpath(root)
  const file = await realpath(path.resolve(sourceRoot, input.file))
  const relative = path.relative(rootPath, file)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('只能打开当前项目目录中的文件。')
  }
  if (relative.split(path.sep).includes('node_modules') || !/\.(vue|[cm]?[jt]sx?|html|css|scss|sass|less)$/.test(file)) {
    throw new Error('请选择项目中的业务源码。')
  }
  if (!(await stat(file)).isFile()) throw new Error('目标不是文件。')
  return {
    file,
    line: input.line,
    column: input.column,
    editor: input.editor,
    executable: editors[input.editor],
  }
}

export function launchLocation(location) {
  // launch-editor selects IDE-specific arguments, including Windows executable paths.
  // A successful dispatch means the request was sent, not that an IDE acknowledged it.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 700)
    try {
      // launch-editor parses this setting as shell words even on Windows. Quote
      // a single executable so spaces and backslashes cannot split the path.
      const executable = `'${location.executable.replaceAll("'", "'\\''")}'`
      launch(`${location.file}:${location.line}:${location.column}`, executable, (_file, message) => {
        clearTimeout(timer)
        reject(new Error(`${message}；请检查 IDE 命令或配置可执行文件路径。`))
      })
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })
}

export async function readJson(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 8192) throw new Error('请求内容过大。')
    chunks.push(buffer)
  }
  // Network chunks may split a multibyte character in a Chinese source path.
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}
