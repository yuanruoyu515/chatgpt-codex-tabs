#!/usr/bin/env python3
"""Install the tab-bar injector as a per-user LaunchAgent.

Copies src/inject.py and src/renderer.js to ~/Library/Application Support/chatgpt-tabs-inject/
and registers com.ruoyu.chatgpt-tabs.inject. Never touches the ChatGPT / Codex app bundle.
Run it again after editing anything in src/; open windows pick up the new version within seconds.
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

if platform.system() != 'Darwin':
    fail('macOS only (the injector is a LaunchAgent).')
if not os.access(PYTHON, os.X_OK):
    fail(f'{PYTHON} not found. Install the Xcode Command Line Tools: xcode-select --install')
for name in ['inject.py', 'renderer.js']:
    if not (SRC / name).is_file():
        fail(f'missing src/{name}; run this script from a full checkout.')
if not (pathlib.Path('/Applications/codexhost.app').exists() or shutil.which('codexhost')):
    print('warning: CodexHost not found. The tab bar only appears when ChatGPT/Codex runs under CodexHost.\n'
          '         Install it from https://github.com/BytePioneer-AI/codex-host', file=sys.stderr)

domain = f'gui/{os.getuid()}'
DEST.mkdir(parents=True, exist_ok=True)
for name in ['inject.py', 'renderer.js']:
    shutil.copy2(SRC / name, DEST / name)
plist = {
    'Label': LABEL,
    'ProgramArguments': [PYTHON, '-I', str(DEST / 'inject.py')],
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
print('Installed', LABEL, '->', DEST)
print('Check it with: python3 doctor.py')
