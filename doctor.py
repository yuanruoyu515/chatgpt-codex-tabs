#!/usr/bin/env python3
"""Check every piece the tab bar needs and print one line per check.

Exit code 0 means the tab bar is live in at least one window. Safe to run any time; changes nothing.
"""
import importlib.util, os, pathlib, plistlib, shutil, subprocess, sys

HOME = pathlib.Path.home()
DEST = HOME / 'Library/Application Support/chatgpt-tabs-inject'
LABEL = 'com.ruoyu.chatgpt-tabs.inject'
ok_all = True

def line(ok, name, detail=''):
    global ok_all
    ok_all &= ok
    print(f"[{'ok' if ok else '!!'}] {name}" + (f': {detail}' if detail else ''))

def app_version(path):
    try:
        with open(path / 'Contents/Info.plist', 'rb') as f:
            return plistlib.load(f).get('CFBundleShortVersionString', '?')
    except OSError:
        return None

apps = [p for p in [pathlib.Path('/Applications/ChatGPT.app'), pathlib.Path('/Applications/Codex.app')] if p.exists()]
line(bool(apps), 'Desktop app', ', '.join(f'{p.name} {app_version(p)}' for p in apps) or 'ChatGPT.app / Codex.app not in /Applications')

host = pathlib.Path('/Applications/codexhost.app')
cli = shutil.which('codexhost')
line(host.exists() or bool(cli), 'CodexHost',
     (f'codexhost.app {app_version(host)}' if host.exists() else '') + (f' cli {cli}' if cli else '') or 'not installed')

state = subprocess.run(['launchctl', 'print', f'gui/{os.getuid()}/{LABEL}'], capture_output=True, text=True)
running = state.returncode == 0 and 'state = running' in state.stdout
line(running, 'Injector LaunchAgent', 'running' if running else 'not running; run python3 install.py')

files = [DEST / 'inject.py', DEST / 'renderer.js']
line(all(f.exists() for f in files), 'Installed files', str(DEST))

if (DEST / 'inject.py').exists():
    spec = importlib.util.spec_from_file_location('inject', DEST / 'inject.py')
    inject = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inject)
    ports = inject.ports()
    line(bool(ports), 'App started with a debug port',
         ', '.join(map(str, sorted(ports))) or 'none; open the app through CodexHost (codexhost launch)')
    live = 0
    for port in ports:
        try:
            for url in inject.targets(port):
                version = inject.evaluate(url, "window.__ruoyuTabs ? (window.__ruoyuTabsVersion || 'unknown') : ''")
                if version:
                    live += 1
                    print(f'     port {port}: tab bar live, renderer {version}')
        except Exception as e:  # report and keep going
            print(f'     port {port}: {e}')
    line(live > 0, 'Tab bar injected', f'{live} window(s)' if live else 'not yet; see inject.log')

log = DEST / 'inject.log'
if log.exists():
    tail = log.read_text(errors='replace').strip().splitlines()[-3:]
    print('     inject.log:', *tail, sep='\n       ')

sys.exit(0 if ok_all else 1)
