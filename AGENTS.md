# AGENTS.md: setting up chatgpt-codex-tabs

For coding agents (Claude Code, Codex, Cursor and the like) installing this on a user's Mac. Human docs: [README.md](README.md), [README.zh-CN.md](README.zh-CN.md).

The project adds a tab bar to the Codex desktop app by injecting `src/renderer.js` into the running app over a local DevTools port. A per-user LaunchAgent does the injecting. Nothing in `/Applications` is modified.

## Ground rules

- Do not modify, copy, patch or re-sign anything under `/Applications`. If a step seems to need that, stop and ask the user.
- Do not use `sudo`. Everything here is per-user.
- Do not quit, kill or relaunch the user's ChatGPT / Codex / CodexHost processes without asking first. They may have work in progress.
- Do not install CodexHost on the user's behalf without asking. It is a separate project with its own installer.
- Report the final `python3 doctor.py` output verbatim.

## 1. Check preconditions

```bash
sw_vers -productVersion                       # must succeed: macOS only
test -x /usr/bin/python3 && echo python-ok    # else: xcode-select --install (ask the user)
ls -d /Applications/ChatGPT.app /Applications/Codex.app 2>/dev/null
ls -d /Applications/codexhost.app 2>/dev/null; command -v codexhost
```

- No desktop app found: stop. Tell the user the Codex desktop app must be installed in `/Applications`.
- No CodexHost (neither `codexhost.app` nor the `codexhost` command): tell the user it is required and link https://github.com/BytePioneer-AI/codex-host. You may continue installing; the tab bar will appear once the app runs under CodexHost.

Tested combination: macOS 27.0.1, ChatGPT.app 26.1027.51404, CodexHost 0.17.0.

## 2. Install

```bash
git clone https://github.com/yuanruoyu515/chatgpt-codex-tabs.git
cd chatgpt-codex-tabs
python3 install.py
```

Expected last lines:

```text
Installed com.ruoyu.chatgpt-tabs.inject -> /Users/<user>/Library/Application Support/chatgpt-tabs-inject
Check it with: python3 doctor.py
```

`install.py` is idempotent. Run it again after any change to `src/`.

## 3. Verify

```bash
python3 doctor.py; echo "exit=$?"
```

`exit=0` means the tab bar is live in at least one window. Otherwise read the first `[!!]` line:

| `[!!]` line | Meaning | Action |
|---|---|---|
| `Desktop app` | No ChatGPT.app / Codex.app in `/Applications` | Stop and tell the user |
| `CodexHost` | CodexHost not installed | Tell the user; link the repo above |
| `Injector LaunchAgent` | LaunchAgent not running | Re-run `python3 install.py`; check `~/Library/Application Support/chatgpt-tabs-inject/service.log` |
| `App started with a debug port` | App is not running, or was opened without CodexHost | Ask the user to quit the app and start it through CodexHost. Do not restart it yourself without permission |
| `Tab bar injected` | Port found but nothing injected yet | Wait 5 seconds and rerun. Still failing: read `inject.log` (doctor prints its tail). If the log shows `installed` but the bar is missing, the app's DOM probably changed; see below |

## 4. When the app's DOM changed

`src/renderer.js` relies on these selectors. Check them in the running app before editing anything:

- Sidebar rows: `[data-app-action-sidebar-thread-row]`, with `-id` (`local:<uuid>`), `-title`, `-active`, `-host-id`
- Layout: `[data-app-shell-main-surface]`, `[data-app-shell-main-titlebar]`, `[data-app-shell-main-content-layout]`
- Navigation: `window.electronBridge.sendMessageFromView({type: 'open-in-main-window', path})`
- Agent logo (from CodexHost): `[data-codexhost-sidebar-agent-icon]` inside each row

To inspect, reuse the injector's own client:

```bash
cd ~/Library/Application\ Support/chatgpt-tabs-inject
python3 -c "import sys; sys.path.insert(0, '.'); import inject; [print(inject.evaluate(u, \"document.querySelectorAll('[data-app-action-sidebar-thread-row]').length\")) for p in inject.ports() for u in inject.targets(p)]"
```

A count of 0 while the sidebar shows threads means the selectors moved. Fix `src/renderer.js`, run `python3 install.py`, and confirm with `doctor.py`.

## 5. Uninstall

```bash
python3 uninstall.py
rm -rf ~/Library/Application\ Support/chatgpt-tabs-inject
```

## Reference

| Item | Value |
|---|---|
| LaunchAgent label | `com.ruoyu.chatgpt-tabs.inject` |
| Plist | `~/Library/LaunchAgents/com.ruoyu.chatgpt-tabs.inject.plist` |
| Runtime files and logs | `~/Library/Application Support/chatgpt-tabs-inject/` (`inject.log`, `service.log`) |
| Page globals | `window.__ruoyuTabs` (has `dispose()`), `window.__ruoyuTabsVersion` |
| Storage keys | `localStorage['ruoyu-horizontal-tabs:v1']`, `localStorage['ruoyu-horizontal-tabs:v1:agent-icons']` |
| Target page | URL exactly `app://-/index.html`; windows with an `initialRoute` query get no bar |
