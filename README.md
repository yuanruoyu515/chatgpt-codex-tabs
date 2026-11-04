<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
  <img alt="ChatGPT Codex Tabs: a row of tabs above the chat, each with its agent's logo" src="assets/banner-light.png">
</picture>

<p>
  <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-18181B?logo=apple&logoColor=white">
  <img alt="Python 3, standard library only" src="https://img.shields.io/badge/Python_3-stdlib_only-3B82F6?logo=python&logoColor=white">
  <a href="https://github.com/BytePioneer-AI/codex-host"><img alt="Requires CodexHost" src="https://img.shields.io/badge/needs-CodexHost-3B82F6"></a>
  <a href="https://linux.do/"><img alt="Recognizes the LINUX DO community" src="https://img.shields.io/badge/community-LINUX%20DO-FFB000"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-18181B"></a>
  <a href="https://www.threads.com/@realtimyry"><img alt="Threads @realtimyry" src="https://img.shields.io/badge/Threads-@realtimyry-18181B?logo=threads&logoColor=white"></a>
</p>

**English** · [简体中文](README.zh-CN.md) · [Setup guide for AI agents](AGENTS.md)

Codex Desktop keeps every thread in the sidebar. With four or five threads going at once, I kept scrolling that sidebar to get back to the one I had open a minute ago. This adds a tab row above the chat, the way a browser does it, and puts each thread's agent logo (Codex, Claude Code, DeepSeek, WorkBuddy and the rest) on its tab.

Nothing inside the app bundle changes. A small background script injects the tab bar at runtime through the local debug port that [CodexHost](https://github.com/BytePioneer-AI/codex-host) already opens, so the official signature stays intact and app updates keep working.

## <img src="assets/icons/cursor-click.svg" width="20" height="20" align="top"> What you get

- Open a thread in the sidebar and it gets a tab.
- Click a tab, or press <kbd>⌘1</kbd> to <kbd>⌘8</kbd>, to switch. <kbd>⌘9</kbd> jumps to the last tab.
- Drag a tab to move it. The other tabs slide out of the way; <kbd>Esc</kbd> cancels.
- Right-click a tab for the same menu the sidebar shows: rename, pin, archive, open in new window and the rest.
- A blue dot marks a thread that is still running.
- <kbd>×</kbd> closes the tab only. The thread is not deleted or archived. Middle-click works too.
- <kbd>+</kbd> starts a new chat.
- The logo on each tab is the same icon CodexHost draws in the sidebar. Hover a tab to see the agent's name.
- Tab order survives restarts.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/tabs-dark.png">
  <img alt="The tab bar with four agents" src="assets/tabs-light.png">
</picture>

## <img src="assets/icons/puzzle-piece.svg" width="20" height="20" align="top"> Requirements

| | |
|---|---|
| macOS | Tested on macOS 27.0.1 |
| Desktop app | `ChatGPT.app` (the Electron build with Codex) in `/Applications`. Tested on 26.1027.51404. `Codex.app` is matched too but untested |
| [CodexHost](https://github.com/BytePioneer-AI/codex-host) | Tested on 0.17.0. The app has to be started through it, because that is what opens the debug port |
| Python | `/usr/bin/python3` from the Xcode Command Line Tools. No packages to install |

## <img src="assets/icons/download-simple.svg" width="20" height="20" align="top"> Install

```bash
git clone https://github.com/yuanruoyu515/chatgpt-codex-tabs.git
cd chatgpt-codex-tabs
python3 install.py
```

Then start Codex Desktop through CodexHost the way its README describes. The tab bar shows up about two seconds after the window loads. To confirm every piece is in place:

```bash
python3 doctor.py
```

> [!NOTE]
> **Opening the app from the Dock.** Stock CodexHost only takes over when you start the app through CodexHost. Open ChatGPT/Codex straight from the Dock, Finder or Spotlight and there is no debug port, so no tab bar. I wrote an opt-in helper that hands those cold starts to CodexHost automatically: [codex-host#702](https://github.com/BytePioneer-AI/codex-host/pull/702). It is not merged yet. Until it is, either start through CodexHost every time, or install the helper from my branch ([setup guide](https://github.com/yuanruoyu515/codex-host/blob/feat/macos-cold-start-automation/docs/platforms/macos/cold-start-automation.md); needs macOS 13+ and Swift 6 from the Xcode Command Line Tools):
>
> ```bash
> git clone -b feat/macos-cold-start-automation https://github.com/yuanruoyu515/codex-host.git
> cd codex-host
> python3 tools/macos-auto-launch/manage.py install
> ```
>
> On each cold start the app restarts once (the window flashes briefly). That restart is CodexHost taking over.

Each line reads `[ok]` or `[!!]`, and the exit code is 0 once the bar is live.

You can delete the cloned folder afterwards. `install.py` copies what it needs to `~/Library/Application Support/chatgpt-tabs-inject/` and registers the LaunchAgent `com.ruoyu.chatgpt-tabs.inject`, which starts at login.

## <img src="assets/icons/robot.svg" width="20" height="20" align="top"> Let your agent set it up

[AGENTS.md](AGENTS.md) is written for coding agents: preconditions, exact commands, how to verify, and what not to touch. Paste this into Claude Code, Codex or any agent that can run shell commands:

```text
Set up https://github.com/yuanruoyu515/chatgpt-codex-tabs on this Mac. Follow AGENTS.md in that repo and stop to ask me before restarting my desktop app.
```

## <img src="assets/icons/tree-structure.svg" width="20" height="20" align="top"> How it works

1. CodexHost starts the app with `--remote-debugging-port` bound to `127.0.0.1`.
2. `src/inject.py` runs as a LaunchAgent. It watches `ps` for the app process with that flag, reads `http://127.0.0.1:<port>/json` and finds the main window (`app://-/index.html`).
3. It sends `src/renderer.js` over the DevTools protocol with `Runtime.evaluate`. The script is versioned by its own hash, so a reload or a changed `renderer.js` gets re-injected within a few seconds and an unchanged one is left alone.
4. `renderer.js` reads the sidebar rows (`data-app-action-sidebar-thread-*`) to build tabs. It copies the agent logo from CodexHost's `data-codexhost-sidebar-agent-icon` span and caches it per agent in `localStorage`, so a tab keeps its logo while its sidebar row is collapsed or scrolled away.
5. Switching tabs clicks the sidebar row, or falls back to the app's own `open-in-main-window` message. Right-clicking a tab sends the click to that row, so the app opens its own menu.

I tried patching first: copy the app, edit `app.asar`, re-sign it ad hoc. macOS refused to launch it (spawn error 163 from restricted entitlements, then library validation failing on mixed Team IDs), and every official update would have meant doing it all again. Runtime injection skips all of that, and I'd pick it again.

## <img src="assets/icons/trash.svg" width="20" height="20" align="top"> Uninstall

```bash
python3 uninstall.py
rm -rf ~/Library/Application\ Support/chatgpt-tabs-inject
```

A tab bar that is already on screen goes away on the next reload or app restart.

## <img src="assets/icons/warning-circle.svg" width="20" height="20" align="top"> Limits

- Local Codex threads only. Remote hosts, cloud tasks and plain ChatGPT chats do not get tabs yet.
- The right-click menu needs the thread's row in the sidebar. If the thread sits in a collapsed project, you get a smaller menu that can only close tabs.
- Only the main window has a tab bar. Windows opened with "Open in new window" do not.
- Without CodexHost there is no debug port, so no tab bar. Without CodexHost's sidebar icons, tabs show titles only.
- It depends on the app's DOM attributes. If an update renames `data-app-action-sidebar-thread-*` or the `open-in-main-window` message, the bar stops appearing until the selectors are updated. `doctor.py` will still show the injector running.

## Files

| Path | What it is |
|---|---|
| `src/renderer.js` | The tab bar. Runs inside the app's main window |
| `src/inject.py` | The injector. A minimal DevTools client, standard library only |
| `install.py` / `uninstall.py` | Register or remove the LaunchAgent |
| `doctor.py` | Read-only health check |
| `AGENTS.md` | Setup instructions for AI agents |

## Credits

- Tab design follows [Horizontal Tabs](https://github.com/b-nnett/codexplusplus-horizontal-tabs). The code here is a separate implementation.
- Agent logos come from [CodexHost](https://github.com/BytePioneer-AI/codex-host) at runtime. None are shipped in this repo.
- Section icons: [Phosphor Icons](https://phosphoricons.com) (MIT).

Made by Ruoyu. Find me on Threads: [@realtimyry](https://www.threads.com/@realtimyry).

[MIT License](LICENSE)
