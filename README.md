# 点到源码 · Click to Code

点击 Vue、React 或普�?HTML 页面中的元素，在 VS Code / WebStorm 打开对应源码。包名沿�?`vue-click-to-code`�?*0.2 测试版新增通用 Vite �?Webpack 入口**，浏览器界面不依�?Vue �?React�?
**通用需要项目接入�?* 构建插件会在开发时给模�?JSX 记录文件及行列。没有源码映射的任意线上网页，无法仅�?DOM 准确还原本机代码，也不会自动从元素推导出 Java/PHP/Python 接口函数�?
## 安装

```sh
npm install -D vue-click-to-code@0.2.0-beta.5
```

也可安装本地包：`npm install -D ./vue-click-to-code-0.2.0-beta.1.tgz`。安装需要联网获取依赖。需�?Node 20.19+�?2 系列需�?22.12+），推荐 Node 24�?
## 已验证范�?
| 项目 | 已验证行�?|
| --- | --- |
| Vue 3.5 + Vite 8 | Element Plus 下拉框、Teleport 选项、子组件、弹窗、隐藏、请求取�?超时 |
| React 19 + Vite 8 | JSX、组件不透传属性、Portal 浮层、普�?HTML、隐�?|
| Vue 2.7 + Webpack 5 + webpack-dev-server 5 | Vue 模板、v-for、自定义组件不透传属性、事件拦�?|
| TSX | 编译标记、语法有效性、原始行列的 Node 测试 |

Vite 兼容声明�?6/7/8，集成验证使�?Vite 8。Vue 2 + Vite、React + Webpack、Vue 3 + Webpack 尚未逐一集成验证。Vue CLI 需要匹配底�?Webpack/dev-server 版本；Webpack 4/dev-server 3 暂不支持�?
## Vite：Vue / React / HTML

在已有配置里添加插件，放在框架编译插件之前：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import clickToCode from 'vue-click-to-code/vite'

export default defineConfig({
  plugins: [
    clickToCode({ editor: 'webstorm' }),
    vue(),
  ],
})
```

React 项目保留自己�?`react()`，把 `clickToCode(...)` 放在它之前即可，不需要安�?Vue 运行时。普�?HTML �?Vite �?HTML 处理阶段记录原始行列�?.2 的默认导�?`vue-click-to-code` 也指向这个通用 Vite 入口�?
**Monorepo 多包项目需要传 `root`�?* 默认只注�?Vite root（通常是当�?app 包）内的源码 —�?姊妹包（�?`packages/*/components` 里的封装组件）整体拿不到元素级标记，点击它们只能命中"使用组件的那一�?。传工作区根即可让全部业务包获得行列级定位：

```ts
clickToCode({
  editor: 'webstorm',
  // 相对路径�?vite.config.ts 所在目录解析；也可传绝对路�?  root: '../../',
})
```

`root` 同时是打开文件的安全边界：注入�?IDE 打开都限制在该目录内，node_modules 始终排除�?
**Schema 驱动的表�?表格�?.2.0-beta.3 起）**：由配置数组渲染的控件（�?`{ field: "scopeType", component: "Select" }`），编译时会自动给这类对象字面量（数组内、含 `field` �?`dataIndex` 键）附加 `__clickToCode` 源码位置；点击渲染出来的控件优先跳到**写配置的那一�?*，而不是封装组件的模板行。封装层（表�?表单组件）内部重建配置对象也没关系（0.2.0-beta.5 起）——运行时按字段名把点击的控件关联回祖先组�?props 里的原始 schema 数组。库组件内部（antd �?node_modules）仍无标记，点击命中使用它的配置行或最近标�?—�?属预期降级�?
## Webpack 5

Webpack 入口支持 CommonJS。将同一�?inspector 对象接到构建器和开发服务：

```js
const createInspector = require('vue-click-to-code/webpack')
const inspector = createInspector({ root: __dirname, editor: 'webstorm' })

module.exports = {
  // 保留原来�?entry、Vue/React loader、插件等配置
  plugins: [inspector.plugin],
  devServer: {
    setupMiddlewares(middlewares, devServer) {
      // 已有 setupMiddlewares 时，在这里组合原逻辑
      return inspector.setupMiddlewares(middlewares, devServer)
    },
  },
}
```

通过 `webpack serve --mode development` 启动。只�?`mode: 'development'` 才注入工具，生产构建不注入。源码目录与启动目录不同时显式传 `root`；有 URL 前缀时传�?`/` 开头、结尾的 `base`。Webpack 的独�?HTML 模板需要经 loader 处理，HtmlWebpackPlugin 自己生成的外壳不声明自动定位�?
## 快捷键与隐藏

- **Alt + 反引号（`�?*：开�?关闭选取，Esc 退出�?- **Alt + Shift + 反引号（`�?*：显�?隐藏工具栏�?- 工具栏右�?**×** 也可隐藏，状态按项目保存在当前浏览器�?- 隐藏后不留底部悬浮按钮，也不弹提示横幅；仍可用快捷键定位底部导航等元素�?- 选取时拦截业务点击，防止同时提交、导航或修改表单�?
`shortcut: 'control-shift-x'` 可修改选取快捷键；Alt+Shift+反引号保留给工具栏。系�?输入法提前拦截的组合键，网页无法覆盖�?
## VS Code / WebStorm

下拉框选择目标 IDE 类型，不自动扫描安装列表。默认调�?`code` / `webstorm`，命令不可用时配置真实路径：

```js
clickToCode({
  editor: 'webstorm',
  shortcut: 'alt-backquote',
  editors: {
    webstorm: 'C:/Program Files/JetBrains/WebStorm 2026.2/bin/webstorm64.exe',
    vscode: 'C:/Users/yourname/AppData/Local/Programs/Microsoft VS Code/Code.exe',
  },
})
```

Webpack �?`createInspector(...)` 接受同样的选项。Windows 可从快捷方式“属�?�?目标”查找安装路径。macOS 常见路径�?`/Applications/WebStorm.app/Contents/MacOS/webstorm`。路径是示例，需要替换，不要附加启动参数�?
**打开的是运行开发服务的电脑上的 IDE�?* 仅访问远端网页不会打开浏览器所在电脑的 IDE。页面提示“已发送请求”不代表 IDE 确认打开；此机已验证启动参数，真�?WebStorm 窗口仍需在安装了它的电脑上联调�?
## 保留�?Vue 3 专用入口

0.1.x �?`vite-plugin-vue-inspector` 方案保留�?`vue-click-to-code/vue`，需另装可选依赖并使用 Vue 3.5+�?
```sh
npm install -D vite-plugin-vue-inspector@7.0.0
```

```ts
import clickToCode from 'vue-click-to-code/vue'
```

通用入口使用 `@babel/parser`、`@vue/compiler-dom`、`magic-string` �?JSX/Vue/HTML 注入开发标记并保留源码映射。专用入口复用上�?VNode/source-map 方案。暂不采用通用测试版时，可继续固定安装稳定�?`vue-click-to-code@0.1.2`�?
## 限制

- 定位模板/JSX/组件声明，不自动追踪事件函数或后端业务代码�?- 只处�?`root` 目录内源码（Vite 默认为项目根，monorepo 传工作区根），排�?node_modules；打开接口校验根目录、随机令牌、同源、文件类型及行列�?- 组件不透传属性时使用 Vue/React 开发态组件信息作为后备，复杂封装和版本差异仍需验证�?- Angular、Svelte、Astro、Next/Nuxt SSR、Pug、跨�?iframe、Canvas 和后端模板语言没有在此版本中自动适配�?- 未使�?JSX/模板的手�?DOM 或渲染函数可能只能回溯到最近的有标记组件，不能保证精确到每个元素�?- 选取关闭仍有开发期源码标记开销；高亮按帧合并，退出移除高频监听，生产构建不包含自动注入的工具代码�?- 请求超过 10 秒取消前端等待，不能撤销服务端已发送的 IDE 启动命令。隐藏时抑制错误横幅，需要恢复工具栏或看开发终端排查�?
## 源码中的示例与验�?
`examples/react-vite`、`examples/vue2-webpack` 为独立示例；根目�?`src` �?Vue 3 + Element Plus 示例。先在根目录和两个示例目录分别运�?`npm install`�?
- `npm test`：Node 测试�?- `npm run test:e2e`：原 Vue 3 入口的浏览器测试�?- 设置 `CLICK_TO_CODE_UNIVERSAL=1` 后执行同一命令：通用入口�?Vue 3 测试�?- `npm run test:universal`：React/Vue 2 浏览器验证�?- 首次浏览器测试执�?`npx playwright install chromium`�?
MIT License。依赖保留各自的开源许可证�?