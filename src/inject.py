#!/usr/bin/env python3
"""Inject renderer.js into the running ChatGPT/Codex app. Never modifies the app bundle.

Relies on the local-only DevTools port that codexhost opens when it takes over the app.
Runs as a LaunchAgent: injects as soon as the main window loads, and again after reloads.
"""
import base64, hashlib, json, os, pathlib, re, socket, struct, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
LOG = ROOT / 'inject.log'
APP_EXE = re.compile(r'^/Applications/(?:ChatGPT|Codex)[^/]*\.app/Contents/MacOS/\S+')
PORT = re.compile(r'--remote-debugging-port=(\d+)')
# The page navigates through the app's own "open in main window" message; no main-process patch needed.
BRIDGE = "(p)=>window.electronBridge?.sendMessageFromView?.({type:'open-in-main-window',path:p})"

def log(msg):
    try:
        with open(LOG, 'a') as f: f.write(time.strftime('%F %T ') + msg + '\n')
        if LOG.stat().st_size > 200_000: LOG.write_text('')
    except OSError: pass

def ports():
    out = subprocess.run(['ps', '-axo', 'command='], capture_output=True, text=True).stdout
    found = set()
    for line in out.splitlines():
        if APP_EXE.match(line) and '--type=' not in line:
            m = PORT.search(line)
            if m: found.add(int(m.group(1)))
    return found

def targets(port):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=2) as r:
        items = json.load(r)
    prefix = f'ws://127.0.0.1:{port}/devtools/page/'
    return [t['webSocketDebuggerUrl'] for t in items
            if t.get('type') == 'page' and t.get('url') == 'app://-/index.html'
            and t.get('webSocketDebuggerUrl', '').startswith(prefix)]

def evaluate(url, expression):
    host, rest = url[len('ws://'):].split('/', 1)
    port = int(host.split(':')[1])
    s = socket.create_connection(('127.0.0.1', port), timeout=5)
    try:
        key = base64.b64encode(os.urandom(16)).decode()
        s.sendall(f'GET /{rest} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                  f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'.encode())
        head = b''
        while b'\r\n\r\n' not in head:
            chunk = s.recv(1)
            if not chunk: raise ConnectionError('handshake closed')
            head += chunk
        if b' 101 ' not in head.split(b'\r\n', 1)[0]: raise ConnectionError('handshake refused')
        data = json.dumps({'id': 1, 'method': 'Runtime.evaluate',
                           'params': {'expression': expression, 'returnByValue': True}}).encode()
        mask = os.urandom(4); n = len(data)
        header = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else
                 bytes([0xFE]) + struct.pack('>H', n) if n < 65536 else bytes([0xFF]) + struct.pack('>Q', n))
        s.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
        def read(k):
            b = b''
            while len(b) < k:
                chunk = s.recv(k - len(b))
                if not chunk: raise ConnectionError('closed')
                b += chunk
            return b
        while True:
            payload = b''
            while True:
                a, b = read(2); n = b & 127
                if n == 126: n = struct.unpack('>H', read(2))[0]
                elif n == 127: n = struct.unpack('>Q', read(8))[0]
                payload += read(n)
                if a & 0x80: break
            msg = json.loads(payload)
            if msg.get('id') == 1:
                return msg.get('result', {}).get('result', {}).get('value')
    finally:
        s.close()

def main():
    source = (ROOT / 'renderer.js').read_text()
    version = hashlib.sha256(source.encode()).hexdigest()[:16]
    # Polling sends only this short probe; the full source goes over the wire only when a window needs it.
    probe = f"window.__ruoyuTabsVersion === '{version}' && !!window.__ruoyuTabs"
    expression = (f"({probe}) ? 'present' : "
                  f"(({source.strip()})({BRIDGE}), window.__ruoyuTabsVersion = '{version}', 'installed')")
    log(f'started, renderer {version}')
    seen = {}
    while True:
        live = ports()
        busy = False
        for port in live:
            try:
                for url in targets(port):
                    if evaluate(url, probe) is not True and evaluate(url, expression) == 'installed':
                        log(f'installed on port {port}')
                    busy = busy or seen.get(port, 0) < 20
                seen[port] = seen.get(port, 0) + 1
            except (OSError, ValueError, ConnectionError) as e:
                seen[port] = 0
                busy = True
                if 'refused' not in str(e): log(f'port {port}: {e}')
        seen = {p: c for p, c in seen.items() if p in live}
        # Fast checks right after launch; relaxed once the window is up, still catching reloads.
        time.sleep(0.5 if busy else 2 if live else 3)

if __name__ == '__main__':
    main()
