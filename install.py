#!/usr/bin/env python3
"""Install the tab-bar injector as a per-user LaunchAgent.

    python3 install.py               # with CodexHost: CodexHost opens the debug port
    python3 install.py --standalone  # without CodexHost: the injector reopens the app with the port

Copies src/inject.py and src/renderer.js to ~/Library/Application Support/chatgpt-tabs-inject/
and registers com.ruoyu.chatgpt-tabs.inject. Never touches the ChatGPT / Codex app bundle.
Running it again switches modes or picks up edits in src/; open windows update within seconds.
"""
import os, pathlib, platform, plistlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
DEST = pathlib.Path.home() / 'Library/Application Support/chatgpt-tabs-inject'
LABEL = 'com.ruoyu.chatgpt-tabs.inject'
AGENT = pathlib.Path.home() / f'Library/LaunchAgents/{LABEL}.plist'
PYTHON = '/usr/bin/python3'

def fail(msg):
    print(f'error: {msg}', file=sys.stderr)
    sys.exit(1)

args = sys.argv[1:]
if any(a not in ('--standalone',) for a in args):
    fail('usage: python3 install.py [--standalone]')
standalone = '--standalone' in args

if platform.system() != 'Darwin':
    fail('macOS only (the injector is a LaunchAgent).')
if not os.access(PYTHON, os.X_OK):
    fail(f'{PYTHON} not found. Install the Xcode Command Line Tools: xcode-select --install')
for name in ['inject.py', 'renderer.js']:
    if not (SRC / name).is_file():
        fail(f'missing src/{name}; run this script from a full checkout.')
has_host = pathlib.Path('/Applications/codexhost.app').exists() or bool(shutil.which('codexhost'))
if standalone and has_host:
    print('note: CodexHost is installed. While a CodexHost launcher is running, the standalone injector\n'
          '      leaves app launches to it and only injects.', file=sys.stderr)
elif not standalone and not has_host:
    print('warning: CodexHost not found. The tab bar only appears when ChatGPT/Codex runs under CodexHost.\n'
          '         Install it from https://github.com/BytePioneer-AI/codex-host,\n'
          '         or use the version that does not need it: python3 install.py --standalone', file=sys.stderr)

domain = f'gui/{os.getuid()}'
DEST.mkdir(parents=True, exist_ok=True)
for name in ['inject.py', 'renderer.js']:
    shutil.copy2(SRC / name, DEST / name)
plist = {
    'Label': LABEL,
    'ProgramArguments': [PYTHON, '-I', str(DEST / 'inject.py')] + (['--standalone'] if standalone else []),
    'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 10,
    'ProcessType': 'Background', 'LimitLoadToSessionType': 'Aqua',
    'StandardOutPath': '/dev/null', 'StandardErrorPath': str(DEST / 'service.log'),
}
AGENT.parent.mkdir(parents=True, exist_ok=True)
with open(AGENT, 'wb') as f:
    plistlib.dump(plist, f)
subprocess.run(['launchctl', 'bootout', f'{domain}/{LABEL}'], capture_output=True)
subprocess.run(['launchctl', 'bootstrap', domain, str(AGENT)], check=True)
# RunAtLoad does not always fire on bootstrap; kickstart makes the first run immediate.
subprocess.run(['launchctl', 'kickstart', f'{domain}/{LABEL}'], check=True)
print('Installed', LABEL, '->', DEST, '(standalone)' if standalone else '(with CodexHost)')
if standalone:
    print('If the app is already open, quit it and open it again. From then on, every launch gets the tab bar.')
print('Check it with: python3 doctor.py')
