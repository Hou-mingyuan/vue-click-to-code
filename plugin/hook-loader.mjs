// module loader registered by hook.mjs. Redirects vite's internal
// `chunks/server.js` import to a wrapper that appends vue-click-to-code
// plugins inside createServer's inlineConfig. The real module URL travels
// as a query param because loader hooks run on a separate thread with its
// own globalThis. Imports made *from* the wrapper are passed through so the
// real module resolves to a single instance instead of recursing.
const VITE_SERVER_RE = /[\\/]chunks[\\/]server\.[cm]?js$/

export async function resolve(specifier, context, nextResolve) {
  const fromWrapper = typeof context.parentURL === 'string'
    && context.parentURL.includes('hook-server-wrapper')
  const resolved = await nextResolve(specifier, context)
  if (
    !fromWrapper &&
    (specifier.endsWith('chunks/server.js') ||
      VITE_SERVER_RE.test(specifier) ||
      (resolved?.url && VITE_SERVER_RE.test(resolved.url))) &&
    /\/vite\//.test(resolved?.url || '')
  ) {
    const wrapper = new URL(
      `./hook-server-wrapper.mjs?real=${encodeURIComponent(resolved.url)}`,
      import.meta.url,
    )
    return { url: wrapper.href, shortCircuit: true }
  }
  return resolved
}
