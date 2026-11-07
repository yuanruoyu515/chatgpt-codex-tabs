#!/usr/bin/env python3
"""Inject renderer.js into the running ChatGPT/Codex app. Never modifies the app bundle.

Needs the app to run with a local-only DevTools port. Two modes:
  default       CodexHost opens the port when it takes over the app; this script only injects.
  --standalone  No CodexHost. When the app has just been opened from the Dock, Finder or
                Spotlight without the port, this script quits it and opens it again with the port.
Runs as a LaunchAgent: injects as soon as the main window loads, and again after reloads.
"""
import base64, hashlib, json, os, pathlib, re, signal, socket, struct, subprocess, sys, time, urllib.request

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

def seconds(etime):
    """ps etime ([[dd-]hh:]mm:ss) -> seconds."""
    days, _, rest = etime.rpartition('-')
    total = 0
    for part in rest.split(':'): total = total * 60 + int(part)
    return total + int(days or 0) * 86400

def processes():
    """Main app processes as (pid, age in seconds, command line)."""
    out = subprocess.run(['ps', '-axo', 'pid=,etime=,command='], capture_output=True, text=True).stdout
    found = []
    for line in out.splitlines():
        pid, etime, command = (line.split(None, 2) + ['', ''])[:3]
        if APP_EXE.match(command) and '--type=' not in command:
            found.append((int(pid), seconds(etime), command))
    return found

def ports():
    return {int(m.group(1)) for _, _, c in processes() if (m := PORT.search(c))}

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

# --- Standalone mode: cold-start takeover -------------------------------------------------------
# Only a process this young counts as a fresh launch; anything older may already hold the user's work.
FRESH = 20
# Wait this long after launch so a CodexHost-style launcher, if one exists, can act first.
SETTLE = 2
# A launch without the port this soon after our own relaunch means the flag did not stick: back off.
LOOP_WINDOW, BACKOFF = 15, 600
SUPERVISOR = re.compile(r'(?:^|/)codexhost(?: launch\b|$)')

def bundle_of(command):
    return command.split('.app/Contents/MacOS/', 1)[0] + '.app'

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def supervisor_running():
    out = subprocess.run(['ps', '-axo', 'command='], capture_output=True, text=True).stdout
    return any(SUPERVISOR.search(line.split(' --', 1)[0]) for line in out.splitlines())

def alive(pid):
    try: os.kill(pid, 0); return True
    except ProcessLookupError: return False
    except PermissionError: return True

def relaunch(pid, bundle):
    """Quit the fresh app gracefully, then open it again with the DevTools port."""
    os.kill(pid, signal.SIGTERM)
    for _ in range(80):
        if not alive(pid): break
        time.sleep(0.1)
    else:
        os.kill(pid, signal.SIGKILL)
        time.sleep(0.5)
    time.sleep(0.5)  # let the single-instance lock go
    port = free_port()
    subprocess.run(['/usr/bin/open', '-a', bundle, '--args', '--remote-debugging-address=127.0.0.1',
                    f'--remote-debugging-port={port}'], check=True, capture_output=True)
    return port

class Takeover:
    def __init__(self):
        # Pids already decided on. Old processes are skipped by age, so one opened before this
        # service started (login items, a reinstall) is taken over only if it is still fresh.
        self.left_alone = set()
        self.last_relaunch = 0.0
        self.paused_until = 0.0

    def step(self):
        now = time.time()
        for pid, age, command in processes():
            if pid in self.left_alone or PORT.search(command): continue
            if age < SETTLE: continue
            self.left_alone.add(pid)  # one decision per process
            if age > FRESH:
                log(f'pid {pid}: running {age}s without a debug port; left alone. Quit and reopen the app')
            elif now < self.paused_until:
                log(f'pid {pid}: takeover paused after a failed relaunch; left alone')
            elif supervisor_running():
                log(f'pid {pid}: a CodexHost launcher is running; left to it')
            elif now - self.last_relaunch < LOOP_WINDOW:
                self.paused_until = now + BACKOFF
                log(f'pid {pid}: relaunched {int(now - self.last_relaunch)}s ago and still no debug port; '
                    f'pausing takeover for {BACKOFF // 60} min')
            else:
                try:
                    port = relaunch(pid, bundle_of(command))
                    self.last_relaunch = time.time()
                    log(f'pid {pid}: cold start without a debug port; reopened on port {port}')
                except (OSError, subprocess.CalledProcessError) as e:
                    self.paused_until = time.time() + BACKOFF
                    log(f'pid {pid}: relaunch failed: {e}')

def main():
    standalone = '--standalone' in sys.argv[1:]
    takeover = Takeover() if standalone else None
    source = (ROOT / 'renderer.js').read_text()
    version = hashlib.sha256(source.encode()).hexdigest()[:16]
    # Polling sends only this short probe; the full source goes over the wire only when a window needs it.
    probe = f"window.__ruoyuTabsVersion === '{version}' && !!window.__ruoyuTabs"
    expression = (f"({probe}) ? 'present' : "
                  f"(({source.strip()})({BRIDGE}), window.__ruoyuTabsVersion = '{version}', 'installed')")
    log(f"started{' (standalone)' if standalone else ''}, renderer {version}")
    seen = {}
    while True:
        if takeover: takeover.step()
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
