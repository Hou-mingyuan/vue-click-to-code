module.exports = function clickToCodeLoader(source, inputMap) {
  const done = this.async()
  const query = new URLSearchParams(this.resourceQuery)
  const vueTemplate = this.resourcePath.endsWith('.vue') && query.has('vue') && query.get('type') === 'template'
  if ((this.resourceQuery && !vueTemplate) || this.mode === 'production') return done(null, source, inputMap)
  const { root } = this.getOptions()
  import('./transform.mjs').then(({ instrumentSource }) => {
    const result = instrumentSource(source, this.resourcePath, root)
    done(null, result?.code ?? source, result?.map ? JSON.parse(result.map.toString()) : inputMap)
  }, done).catch(done)
}
