#!/usr/bin/env python3
"""Remove the injector LaunchAgent. Keeps files and logs; already-open tab bars vanish on next reload."""
import os, pathlib, subprocess

LABEL = 'com.ruoyu.chatgpt-tabs.inject'
AGENT = pathlib.Path.home() / f'Library/LaunchAgents/{LABEL}.plist'
subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}/{LABEL}'], capture_output=True)
AGENT.unlink(missing_ok=True)
print('Removed', LABEL)
