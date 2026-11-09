export function mountInspector(options, traceElement) {
const disposeKey = '__CLICK_TO_CODE_DISPOSE__'
window[disposeKey]?.()
const controller = new AbortController()
const { signal } = controller
const host = document.createElement('div')
host.id = 'vue-click-to-code'
host.dataset.vInspectorIgnore = 'true'
const shadow = host.attachShadow({ mode: 'open' })
const label = options.shortcut.split('-').map(key => ({ control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: '⌘', backquote: '`' }[key] || key.toUpperCase())).join(' + ')
shadow.innerHTML = `
  <style>
    :host { all: initial; position: fixed; z-index: 2147483647; inset: 0; pointer-events: none; font: 13px/1.5 system-ui, sans-serif; color: #eaf1f5; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 10px 14px; border: 1px solid #344355; background: #142334; border-radius: 14px; box-shadow: 0 12px 40px #12233530; pointer-events: auto; white-space: nowrap; }
    button, select { font: inherit; cursor: pointer; }
    button { color: #effdf7; background: #168765; border: 0; padding: 8px 13px; border-radius: 8px; }
    button[aria-pressed="true"] { color: #112c22; background: #98ebbd; }
    .hide-toolbar { color: #bac8d4; background: transparent; padding: 5px 8px; font-size: 20px; line-height: 1; }
    select { background: #213447; color: #eff6fa; border: 1px solid #536174; border-radius: 8px; padding: 7px; }
    kbd { font: 11px system-ui; color: #acbaca; }
    .dot { color: #7dddaf; }
    .box { display: none; position: fixed; border: 2px solid #16a37a; background: #2bb88a16; border-radius: 4px; }
    .tip { display: none; position: fixed; padding: 7px 10px; background: #112e26; color: #c9ffe7; border-radius: 6px; max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px ui-monospace, monospace; }
    .message { position: fixed; bottom: 94px; left: 50%; transform: translateX(-50%); background: #142334; border-radius: 10px; padding: 10px 16px; max-width: min(600px, 90vw); text-align: center; box-shadow: 0 4px 20px #0002; }
    .message:empty { display: none; }
    .message.toolbar-hidden { display: none !important; }
    @media(max-width: 550px) { .bar { gap: 8px; bottom: 12px; } kbd { display: none; } }
  </style>
  <div class="box"></div><div class="tip"></div>
  <div class="message" role="status" aria-live="polite"></div>
  <div class="bar" aria-label="源码定位工具">
    <span class="dot">●</span><strong>点到源码</strong>
    <button type="button" aria-pressed="false">选择元素</button>
    <kbd></kbd>
    <select aria-label="目标 IDE"><option value="vscode">VS Code</option><option value="webstorm">WebStorm</option></select>
    <button type="button" class="hide-toolbar" aria-label="隐藏工具栏" title="隐藏工具栏（Alt + Shift + 反引号 恢复）">×</button>
  </div>`
document.documentElement.append(host)
const button = shadow.querySelector('button')
const select = shadow.querySelector('select')
const box = shadow.querySelector('.box')
const tip = shadow.querySelector('.tip')
const message = shadow.querySelector('.message')
shadow.querySelector('kbd').textContent = label
const storageKey = `click-to-code:${options.projectKey}:editor`
const toolbarKey = `click-to-code:${options.projectKey}:toolbar-hidden`
const bar = shadow.querySelector('.bar')
let toolbarHidden = false
try { toolbarHidden = localStorage.getItem(toolbarKey) === 'true' } catch {}
function setToolbarHidden(value, announce = true) {
  toolbarHidden = value
  bar.hidden = value
  message.classList.toggle('toolbar-hidden', value)
  try { localStorage.setItem(toolbarKey, String(value)) } catch {}
  message.textContent = ''
  if (announce && !value) notify('工具栏已显示')
}
setToolbarHidden(toolbarHidden, false)
shadow.querySelector('.hide-toolbar').addEventListener('click', () => setToolbarHidden(true), { signal })
let savedEditor
try { savedEditor = localStorage.getItem(storageKey) } catch {}
select.value = ['vscode', 'webstorm'].includes(savedEditor) ? savedEditor : options.editor
select.addEventListener('change', () => {
  try { localStorage.setItem(storageKey, select.value) } catch {}
}, { signal })

const cursorStyle = document.createElement('style')
cursorStyle.textContent = 'html[data-click-to-code-active], html[data-click-to-code-active] * { cursor: pointer !important; }'
document.head.append(cursorStyle)
let active = false
let current
let messageTimer
let selectionController
let frame = 0
let pendingPath
let pendingRequest
const shortcutParts = options.shortcut.split('-')
const shortcutKey = shortcutParts.at(-1)

function notify(text) {
  clearTimeout(messageTimer)
  if (toolbarHidden) { message.textContent = ''; return }
  message.textContent = text
  messageTimer = setTimeout(() => { message.textContent = '' }, 6000)
}
function hide() { box.style.display = 'none'; tip.style.display = 'none'; current = undefined }
function setActive(value) {
  selectionController?.abort()
  selectionController = undefined
  cancelAnimationFrame(frame)
  frame = 0
  pendingPath = undefined
  if (!value) {
    pendingRequest?.abort()
    pendingRequest = undefined
  }
  active = value
  document.documentElement.toggleAttribute('data-click-to-code-active', value)
  button.setAttribute('aria-pressed', String(value))
  button.textContent = value ? '退出选取 · Esc' : '选择元素'
  hide()
  if (value) {
    selectionController = new AbortController()
    const selectionSignal = selectionController.signal
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true, signal: selectionSignal })
    window.addEventListener('scroll', refreshOverlay, { capture: true, passive: true, signal: selectionSignal })
    window.addEventListener('resize', refreshOverlay, { passive: true, signal: selectionSignal })
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
      document.addEventListener(type, suppressInteraction, { capture: true, signal: selectionSignal })
    }
    document.addEventListener('click', onClick, { capture: true, signal: selectionSignal })
    notify('点击元素打开源码，Esc 退出选取')
  }
}
button.addEventListener('click', () => setActive(!active), { signal })

function findTarget(eventPath) {
  // Check the entire path before resolving a descendant with its own trace.
  if (eventPath.some(node => node === host || (node instanceof Element && node.hasAttribute('data-v-inspector-ignore')))) return
  let element = eventPath.find(node => node instanceof Element)
  while (element && element !== document.documentElement) {
    if (element.hasAttribute('data-v-inspector-ignore')) return
    const trace = traceElement(element)
    if (trace) return trace
    element = element.parentElement
  }
}
function draw(trace) {
  if (!trace?.el?.isConnected) return hide()
  const rect = trace?.el?.getBoundingClientRect()
  if (!rect) return hide()
  current = trace
  Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  tip.textContent = `${trace.filepath}:${trace.pos[1]}:${Math.max(1, trace.pos[2] + 1)}  ↗`
  Object.assign(tip.style, { display: 'block', left: `${Math.max(8, Math.min(rect.left, innerWidth - 320))}px`, top: `${rect.top > 40 ? rect.top - 35 : Math.min(innerHeight - 40, rect.bottom + 6)}px` })
}

function queueDraw() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    if (!active) return
    const eventPath = pendingPath
    pendingPath = undefined
    draw(eventPath ? findTarget(eventPath) : current)
  })
}
function onPointerMove(event) {
  // composedPath() is only available during dispatch, so capture it now.
  pendingPath = event.composedPath()
  queueDraw()
}
function refreshOverlay() { if (current || pendingPath) queueDraw() }
function suppressInteraction(event) {
  if (event.composedPath().includes(host)) return
  event.preventDefault(); event.stopImmediatePropagation()
}

document.addEventListener('keydown', event => {
  if (!event.repeat && !event.isComposing && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'Backquote') {
    event.preventDefault(); event.stopImmediatePropagation(); setToolbarHidden(!toolbarHidden); return
  }
  if (event.key === 'Escape' && active) {
    event.preventDefault(); event.stopImmediatePropagation(); setActive(false); notify('已退出选取'); return
  }
  const modifiers = { control: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey }
  // Match the physical backquote key even when a layout reports a dead key.
  const keyMatches = shortcutKey === 'backquote' ? event.code === 'Backquote' : event.key.toLowerCase() === shortcutKey
  if (!event.repeat && !event.isComposing && keyMatches &&
      Object.entries(modifiers).every(([name, pressed]) => pressed === shortcutParts.includes(name))) {
    event.preventDefault(); event.stopImmediatePropagation(); setActive(!active)
  }
}, { capture: true, signal })
async function onClick(event) {
  if (!active || event.composedPath().includes(host)) return
  event.preventDefault(); event.stopImmediatePropagation()
  if (pendingRequest) return
  const trace = findTarget(event.composedPath())
  if (!trace) return notify('这个元素没有可用的源码位置，请选择附近的业务组件。')
  const request = new AbortController()
  pendingRequest = request
  const editor = select.value
  const editorName = select.options[select.selectedIndex].text
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; request.abort() }, 10_000)
  try {
    const response = await fetch(`${options.base}__click-to-code/open`, {
      method: 'POST',
      signal: request.signal,
      headers: { 'Content-Type': 'application/json', 'X-Click-To-Code-Token': options.token },
      body: JSON.stringify({
        file: trace.filepath, line: trace.pos[1], column: Math.max(1, trace.pos[2] + 1), editor,
      }),
    })
    const result = await response.json()
    if (pendingRequest !== request) return
    if (!response.ok) throw new Error(result.error || '打开源码失败')
    pendingRequest = undefined
    setActive(false)
    notify(`已向 ${editorName} 发送打开请求 · ${trace.filepath}:${trace.pos[1]}`)
  } catch (error) {
    if (pendingRequest !== request) return
    if (timedOut) notify('打开源码请求超时，请检查开发服务后重试。')
    else if (!request.signal.aborted) notify(error.message || '无法连接开发服务器，请刷新页面。')
  } finally {
    clearTimeout(timer)
    if (pendingRequest === request) pendingRequest = undefined
  }
}

function dispose() {
  controller.abort(); clearTimeout(messageTimer); setActive(false); host.remove(); cursorStyle.remove()
  if (window[disposeKey] === dispose) delete window[disposeKey]
}
window[disposeKey] = dispose
return dispose

}
