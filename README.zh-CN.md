<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
  <img alt="ChatGPT Codex Tabs：对话区上方的一排标签，每个标签带 Agent logo" src="assets/banner-light.png">
</picture>

<p>
  <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-18181B?logo=apple&logoColor=white">
  <img alt="Python 3，只用标准库" src="https://img.shields.io/badge/Python_3-stdlib_only-3B82F6?logo=python&logoColor=white">
  <a href="https://github.com/BytePioneer-AI/codex-host"><img alt="需要 CodexHost" src="https://img.shields.io/badge/needs-CodexHost-3B82F6"></a>
  <a href="LICENSE"><img alt="MIT 许可" src="https://img.shields.io/badge/license-MIT-18181B"></a>
  <a href="https://www.threads.com/@realtimyry"><img alt="Threads @realtimyry" src="https://img.shields.io/badge/Threads-@realtimyry-18181B?logo=threads&logoColor=white"></a>
</p>

[English](README.md) · **简体中文** · [给 AI Agent 的配置说明](AGENTS.md)

Codex 桌面版的对话都放在左侧侧栏。同时开四五个对话的时候，我总在侧栏里来回翻，找刚才那个。于是做了这个：在对话区上方加一排标签，用法跟浏览器差不多，每个标签前面还有这个对话所用 Agent 的 logo（Codex、Claude Code、DeepSeek、WorkBuddy 等）。

App 包里的东西一点没改。一个后台小脚本借 [CodexHost](https://github.com/BytePioneer-AI/codex-host) 本来就会开的本地调试端口，在运行时把标签栏注入进去。官方签名保持原样，App 更新后照常能用。

## <img src="assets/icons/cursor-click.svg" width="20" height="20" align="top"> 功能

- 在侧栏点开一个对话，上方就多一个标签
- 点标签，或按 <kbd>⌘1</kbd> 到 <kbd>⌘8</kbd> 切换；<kbd>⌘9</kbd> 跳到最后一个
- 拖动标签调整顺序，其他标签会让开位置；按 <kbd>Esc</kbd> 取消
- 右键标签，弹出的菜单和侧栏右键一样：重命名、置顶、归档、在新窗口中打开等
- 还在运行的对话，标签上有个蓝点
- 点 <kbd>×</kbd> 只关标签，对话不会被删除或归档；鼠标中键也能关
- 点 <kbd>+</kbd> 新建对话
- 标签上的 logo 就是 CodexHost 画在侧栏里的那个图标，鼠标悬停能看到 Agent 名字
- 重启后标签顺序还在

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/tabs-dark.png">
  <img alt="带四种 Agent logo 的标签栏" src="assets/tabs-light.png">
</picture>

拖动标签时，其他标签会让开：

<img alt="拖动一个标签换位置，其他标签跟着让开" src="assets/drag-reorder.gif" width="800">

右键标签，出来的是侧栏原本的菜单：

<img alt="标签上的右键菜单：重命名、置顶、标记为未读、分叉、分享、在新窗口中打开、归档、永久删除等" src="assets/context-menu.png" width="642">

## <img src="assets/icons/puzzle-piece.svg" width="20" height="20" align="top"> 需要什么

| | |
|---|---|
| macOS | 在 macOS 27.0.1 上测过 |
| 桌面 App | `/Applications` 里的 `ChatGPT.app`（带 Codex 的 Electron 版），测试版本 26.1027.51404。`Codex.app` 也能匹配，但没测过 |
| [CodexHost](https://github.com/BytePioneer-AI/codex-host) | 测试版本 0.17.0。App 必须经它启动，调试端口是它开的 |
| Python | Xcode Command Line Tools 自带的 `/usr/bin/python3`，不用装任何包 |

## <img src="assets/icons/download-simple.svg" width="20" height="20" align="top"> 安装

```bash
git clone https://github.com/yuanruoyu515/chatgpt-codex-tabs.git
cd chatgpt-codex-tabs
python3 install.py
```

然后按 CodexHost README 里的方法启动 Codex 桌面版。窗口加载完大约两秒，标签栏就出来了。想确认每一环都正常，就运行：

```bash
python3 doctor.py
```

> [!NOTE]
> **从 Dock 直接打开的情况**：原版 CodexHost 只有在你经它启动 App 时才会接管。直接从 Dock、访达或聚焦搜索打开 ChatGPT/Codex，就没有调试端口，也就没有标签栏。我另外写了一个可选的小工具，App 冷启动时自动交给 CodexHost 接管，已经提了 PR：[codex-host#702](https://github.com/BytePioneer-AI/codex-host/pull/702)，还没合并。合并之前有两个办法：每次都经 CodexHost 启动；或者从我的分支装这个工具（[安装说明](https://github.com/yuanruoyu515/codex-host/blob/feat/macos-cold-start-automation/docs/platforms/macos/cold-start-automation.md)，需要 macOS 13 以上和 Xcode Command Line Tools 里的 Swift 6）：
>
> ```bash
> git clone -b feat/macos-cold-start-automation https://github.com/yuanruoyu515/codex-host.git
> cd codex-host
> python3 tools/macos-auto-launch/manage.py install
> ```
>
> 每次冷启动，App 会重开一次，窗口闪一下，这是 CodexHost 在接管。

每行显示 `[ok]` 或 `[!!]`；标签栏生效时退出码是 0。

装完可以把克隆下来的文件夹删掉。`install.py` 会把需要的文件复制到 `~/Library/Application Support/chatgpt-tabs-inject/`，再注册 LaunchAgent `com.ruoyu.chatgpt-tabs.inject`，登录后自动运行。

## <img src="assets/icons/robot.svg" width="20" height="20" align="top"> 让 Agent 帮你装

[AGENTS.md](AGENTS.md) 是写给编程 Agent 看的：前提条件、具体命令、怎么验证、哪些东西不能碰。把下面这段贴给 Claude Code、Codex 或其他能跑 shell 命令的 Agent：

```text
Set up https://github.com/yuanruoyu515/chatgpt-codex-tabs on this Mac. Follow AGENTS.md in that repo and stop to ask me before restarting my desktop app.
```

## <img src="assets/icons/tree-structure.svg" width="20" height="20" align="top"> 原理

1. CodexHost 启动 App 时带上 `--remote-debugging-port`，只监听 `127.0.0.1`。
2. `src/inject.py` 作为 LaunchAgent 常驻，从 `ps` 里找带这个参数的 App 进程，读 `http://127.0.0.1:<端口>/json`，找到主窗口（`app://-/index.html`）。
3. 它用 DevTools 协议的 `Runtime.evaluate` 把 `src/renderer.js` 送进去。脚本按自身内容的哈希算版本：页面刷新了，或者 `renderer.js` 改了，几秒内会重新注入；没变就不动。
4. `renderer.js` 读侧栏每一行的 `data-app-action-sidebar-thread-*` 属性来生成标签，再从 CodexHost 的 `data-codexhost-sidebar-agent-icon` 复制 Agent logo，按 Agent 缓存到 `localStorage`。侧栏折叠或滚走了，标签上的 logo 也还在。
5. 切换标签时点侧栏对应那一行；找不到那一行，就发 App 自己的 `open-in-main-window` 消息。右键标签时，把右键转给侧栏那一行，菜单由 App 自己弹出。

我一开始走的是改包的路：复制一份 App，改 `app.asar`，再 ad-hoc 重签名。macOS 直接拒绝启动（先是受限 entitlement 导致 spawn error 163，后来 Team ID 不一致，库校验又过不去），而且每次官方更新都得从头再来一遍。运行时注入没有这些麻烦，再选一次我还是选它。

## <img src="assets/icons/trash.svg" width="20" height="20" align="top"> 卸载

```bash
python3 uninstall.py
rm -rf ~/Library/Application\ Support/chatgpt-tabs-inject
```

已经显示的标签栏，要等页面刷新或重启 App 才会消失。

## <img src="assets/icons/warning-circle.svg" width="20" height="20" align="top"> 限制

- 只支持本地 Codex 对话。远程主机、云任务和普通 ChatGPT 对话暂时没有标签。
- 右键菜单要靠侧栏里对应的那一行。对话在折叠起来的项目里时，只会出一个简化菜单，只能关标签。
- 只有主窗口有标签栏，「在新窗口中打开」开出来的窗口没有。
- 没有 CodexHost 就没有调试端口，也就没有标签栏。CodexHost 的侧栏图标没了，标签就只显示标题。
- 依赖 App 的 DOM 属性。哪天更新把 `data-app-action-sidebar-thread-*` 或 `open-in-main-window` 改名了，标签栏就不会出现，要等选择器跟着改。这时 `doctor.py` 仍会显示注入器在运行。

## 文件

| 路径 | 是什么 |
|---|---|
| `src/renderer.js` | 标签栏本体，在 App 主窗口里运行 |
| `src/inject.py` | 注入器，一个最小的 DevTools 客户端，只用标准库 |
| `install.py` / `uninstall.py` | 注册、移除 LaunchAgent |
| `doctor.py` | 只读的自检脚本 |
| `AGENTS.md` | 给 AI Agent 的配置说明 |

## 致谢

- 标签的设计参考 [Horizontal Tabs](https://github.com/b-nnett/codexplusplus-horizontal-tabs)，代码是另写的。
- Agent logo 在运行时取自 [CodexHost](https://github.com/BytePioneer-AI/codex-host)，本仓库不附带任何 logo 文件。
- 章节小图标来自 [Phosphor Icons](https://phosphoricons.com)（MIT）。

作者 Ruoyu，Threads：[@realtimyry](https://www.threads.com/@realtimyry)。

[MIT 许可](LICENSE)
