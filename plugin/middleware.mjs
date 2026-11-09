import { launchLocation, readJson, resolveLocation, sendJson } from './server.mjs'

export function createInspectorMiddleware({ root, sourceRoot = root, base = '/', token, editors, openInEditor = launchLocation }) {
  return async (req, res, next) => {
    let pathname
    try { pathname = new URL(req.url ?? '/', 'http://localhost').pathname }
    catch { return sendJson(res, 400, { error: '无效的请求地址。' }) }
    if (pathname !== `${base}__click-to-code/open` && pathname !== '/__click-to-code/open') return next()
    if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST 请求。' })
    if (req.headers['x-click-to-code-token'] !== token) return sendJson(res, 403, { error: '请求凭据无效，请刷新页面。' })
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        return sendJson(res, 403, { error: '请求必须来自当前开发页面。' })
      }
      const location = await resolveLocation(root, await readJson(req), editors, sourceRoot)
      await openInEditor(location)
      return sendJson(res, 200, { ok: true })
    } catch (error) { return sendJson(res, 400, { error: error.message || '打开源码失败。' }) }
  }
}
