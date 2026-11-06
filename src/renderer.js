/* Independent implementation inspired by codexplusplus-horizontal-tabs. */
(function installTabs(navigate) {
  'use strict';
  window.__ruoyuTabs?.dispose();
  // Only the main window gets a tab bar; overlays and windows opened on a single route do not.
  if (new URL(location.href).searchParams.has('initialRoute')) return;
  const store = localStorage;
  const key = 'ruoyu-horizontal-tabs:v1';
  const attr = 'data-app-action-sidebar-thread-';
  const MAX_TABS = 30, UNTITLED = '未命名对话';
  // A thread started in this session keeps a client-side id ("client-new-thread:<uuid>") on its row.
  const ID = /^(?:client-new-thread:)?[\w-]{1,100}$/, CLIENT = 'client-new-thread:';
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  // active: the tab shown as selected. appActive: what the app itself reports.
  // pending: a tab the user just picked, shown as selected before the app catches up.
  let tabs = [], active = '', appActive = '', pending = null, scrolledTo = '';
  let disposed = false, timer = 0, suppressed = '', saved = '';
  try { tabs = JSON.parse(store.getItem(key) || '[]').filter(valid).slice(-MAX_TABS).map(stored); } catch {}
  function valid(t) { return t && typeof t.id === 'string' && ID.test(t.id) && typeof t.title === 'string' && (t.agent === undefined || /^[\w-]{1,40}$/.test(t.agent)); }
  function stored({ id, title, agent }) { return agent ? { id, title, agent } : { id, title }; }
  function visible(el) { return el && !el.closest('[data-app-shell-active-page="false"], [inert]') && el.getBoundingClientRect().width > 0; }
  function isLocal(r) { return ['', 'local'].includes(r.getAttribute(attr + 'host-id') || ''); }
  function rowId(r) { return (r.getAttribute(attr + 'id') || '').replace(/^local:/, ''); }
  function sidebarRows() { return document.querySelectorAll(`[${attr}row]`); }
  // A visible local row for this thread, or (with anyRow) a hidden one, e.g. in a collapsed sidebar.
  function rowFor(id, anyRow = false) {
    let fallback = null;
    for (const r of sidebarRows()) {
      if (rowId(r) !== id || !isLocal(r)) continue;
      if (visible(r)) return r;
      fallback ??= r;
    }
    return anyRow ? fallback : null;
  }
  function routeId() {
    const url = new URL(location.href);
    const path = url.searchParams.get('initialRoute') || url.pathname;
    return /^\/local\/([\w-]+)(?:[/?#]|$)/.exec(path)?.[1] || '';
  }
  // Agent logos come from codexhost: each sidebar row carries a span[data-codexhost-sidebar-agent-icon].
  // Logos are cached per agent so a tab keeps its logo while its sidebar row is hidden or collapsed.
  const agentAttr = 'data-codexhost-sidebar-agent-icon', iconKey = key + ':agent-icons';
  const iconChecked = new Set(), iconParsed = new Map();
  let icons = {};
  try { icons = JSON.parse(store.getItem(iconKey) || '{}') || {}; } catch {}
  function agentOf(row) {
    const span = row?.querySelector(`[${agentAttr}]`); const kind = span?.getAttribute(agentAttr) || '';
    if (!/^[\w-]{1,40}$/.test(kind)) return '';
    // The logo markup embeds a data: URL, so serialize it once per agent per session, not on every refresh.
    if (!iconChecked.has(kind)) {
      iconChecked.add(kind);
      const html = span.outerHTML;
      if (icons[kind] !== html && html.length < 200000 && !/<script|\son\w+=/i.test(html)) {
        icons[kind] = html; iconParsed.delete(kind);
        try { store.setItem(iconKey, JSON.stringify(icons)); } catch {}
      }
    }
    return kind;
  }
  function agentIcon(kind) {
    if (!kind || !icons[kind]) return null;
    if (!iconParsed.has(kind)) {
      const tpl = document.createElement('template'); tpl.innerHTML = icons[kind];
      const el = tpl.content.firstElementChild;
      if (el?.hasAttribute(agentAttr)) { el.classList.add('rt-agent'); el.removeAttribute('title'); }
      iconParsed.set(kind, el?.hasAttribute(agentAttr) ? el : null);
    }
    return iconParsed.get(kind)?.cloneNode(true) || null;
  }
  function persist() { try { const value = JSON.stringify(tabs.map(stored)); if (value !== saved) { store.setItem(key, value); saved = value; } } catch {} }
  const icon = {
    close: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
  };
  // z-index 45: above the app's in-page layers (up to z-40), below its menus, dialogs and dimming overlays (z-50 and up).
  const style = document.createElement('style');
  style.textContent = `
    #ruoyu-chat-tabs,#ruoyu-chat-tabs-menu{--rt-fg:var(--color-text-primary-ghost,#1f2328);--rt-muted:var(--color-text-secondary-ghost,#1f23287e);--rt-hover:var(--color-background-primary-ghost-hover,#1f23280e);--rt-line:var(--color-border,#1f232814);--rt-ring:var(--color-ring,#0969da);--rt-ease:var(--ease-enter-snappy,cubic-bezier(.23,1,.32,1))}
    #ruoyu-chat-tabs{position:fixed;z-index:45;display:flex;align-items:center;gap:6px;height:40px;padding:0 10px 0 12px;box-sizing:border-box;border-bottom:1px solid var(--rt-line);color:var(--rt-fg);font:430 13px/18px var(--font-sans,-apple-system,BlinkMacSystemFont,sans-serif);-webkit-app-region:no-drag;overflow:hidden;user-select:none;-webkit-user-select:none}
    #ruoyu-chat-tabs *{-webkit-user-drag:none}
    #ruoyu-chat-tabs[hidden]{display:none!important}
    #ruoyu-chat-tabs .rt-list{position:relative;display:flex;align-items:center;gap:2px;min-width:0;flex:1;height:100%;overflow-x:auto;scrollbar-width:none}
    #ruoyu-chat-tabs .rt-list::-webkit-scrollbar{display:none}
    #ruoyu-chat-tabs .rt-item{position:relative;display:flex;align-items:center;flex:0 1 200px;min-width:84px;height:28px;padding:0 3px 0 10px;border-radius:var(--radius-md,10px);color:var(--rt-muted);cursor:default;transition:background-color .15s var(--rt-ease),color .15s var(--rt-ease),opacity .15s}
    #ruoyu-chat-tabs .rt-item:hover{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs .rt-item.rt-active{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs.rt-reordering .rt-item:not(.rt-lifted),#ruoyu-chat-tabs .rt-item.rt-settle{transition:transform .2s var(--rt-ease),background-color .15s var(--rt-ease),color .15s var(--rt-ease)}
    #ruoyu-chat-tabs.rt-reordering .rt-item:not(.rt-lifted):not(.rt-active){background:transparent}
    #ruoyu-chat-tabs .rt-item.rt-lifted{z-index:1;color:var(--rt-fg);background:linear-gradient(var(--rt-hover),var(--rt-hover)),var(--rt-bg,Canvas);box-shadow:0 1px 2px rgb(0 0 0/.1),0 4px 14px rgb(0 0 0/.1)}
    #ruoyu-chat-tabs.rt-reordering .rt-close{opacity:0!important}
    #ruoyu-chat-tabs button{font:inherit;color:inherit;background:transparent;border:0;padding:0;margin:0;cursor:default;-webkit-app-region:no-drag}
    #ruoyu-chat-tabs button:focus-visible{outline:2px solid var(--rt-ring);outline-offset:-2px;border-radius:var(--radius-sm,7px)}
    #ruoyu-chat-tabs .rt-open{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-align:left}
    #ruoyu-chat-tabs .rt-agent{flex:none;display:inline-flex!important;width:14px!important;height:14px!important}
    #ruoyu-chat-tabs .rt-item:not(.rt-active):not(:hover) .rt-agent{opacity:.85}
    #ruoyu-chat-tabs .rt-label{overflow:hidden;text-overflow:ellipsis}
    #ruoyu-chat-tabs .rt-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--color-text-info-ghost-hover,#0169cc)}
    #ruoyu-chat-tabs .rt-dot[hidden]{display:none}
    #ruoyu-chat-tabs .rt-close{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:6px;color:var(--rt-muted);opacity:0;transition:opacity .15s,background-color .15s}
    #ruoyu-chat-tabs .rt-item:hover .rt-close,#ruoyu-chat-tabs .rt-active .rt-close,#ruoyu-chat-tabs .rt-close:focus-visible{opacity:1}
    #ruoyu-chat-tabs .rt-close:hover{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs .rt-add{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:var(--radius-md,10px);color:var(--rt-muted);transition:background-color .15s,color .15s}
    #ruoyu-chat-tabs .rt-add:hover{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs-menu{position:fixed;z-index:1000;min-width:180px;padding:5px;box-sizing:border-box;border-radius:12px;border:1px solid var(--rt-line);background:var(--rt-bg,Canvas);color:var(--rt-fg);box-shadow:0 8px 28px rgb(0 0 0/.16);font:430 13px/18px var(--font-sans,-apple-system,BlinkMacSystemFont,sans-serif);user-select:none;-webkit-app-region:no-drag}
    #ruoyu-chat-tabs-menu[hidden]{display:none}
    #ruoyu-chat-tabs-menu button{display:block;width:100%;padding:5px 10px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:default}
    #ruoyu-chat-tabs-menu button:is(:hover,:focus-visible):not(:disabled){background:var(--rt-hover);outline:none}
    #ruoyu-chat-tabs-menu button:disabled{color:var(--rt-muted)}
    #ruoyu-chat-tabs-menu hr{height:1px;margin:4px 6px;border:0;background:var(--rt-line)}
    html.rt-dragging,html.rt-dragging *{-webkit-app-region:no-drag!important}
    [data-ruoyu-tabs-space]{padding-top:40px!important;box-sizing:border-box!important}
    @media(prefers-reduced-motion:reduce){#ruoyu-chat-tabs *{transition:none!important}}
    @media(forced-colors:active){#ruoyu-chat-tabs .rt-active{outline:1px solid Highlight}}
  `;
  const bar = document.createElement('nav');
  bar.id = 'ruoyu-chat-tabs'; bar.setAttribute('aria-label', '打开的对话');
  const list = document.createElement('div'); list.className = 'rt-list'; list.setAttribute('role','tablist'); bar.append(list);
  const add = document.createElement('button'); add.className = 'rt-add'; add.innerHTML = icon.plus; add.title = '新建对话'; add.setAttribute('aria-label', '新建对话');
  add.addEventListener('click', () => navigate('/'), opts); bar.append(add);
  const menu = document.createElement('div'); menu.id = 'ruoyu-chat-tabs-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  document.head.append(style); document.body.append(bar, menu);
  let spaced, background = '';
  // Follows the main surface when the sidebar is dragged or toggled, without waiting for the next poll.
  const resized = new ResizeObserver(() => layout());
  function layout() {
    if (disposed) return;
    const main = Array.from(document.querySelectorAll('[data-app-shell-main-surface], main')).find(visible);
    const titlebar = Array.from(document.querySelectorAll('[data-app-shell-main-titlebar], header')).find(visible);
    const body = main?.querySelector('[data-app-shell-main-content-layout]');
    const rect = (body || main)?.getBoundingClientRect();
    // If the app layout cannot be identified, fail closed instead of covering the composer.
    const hide = !rect || /(?:\/|^)settings(?:\/|$)/.test(location.href) || !tabs.length;
    if (bar.hidden !== hide) bar.hidden = hide;
    if (hide) { spaced?.removeAttribute('data-ruoyu-tabs-space'); spaced = null; resized.disconnect(); return; }
    const target = body || main;
    if (spaced !== target) { spaced?.removeAttribute('data-ruoyu-tabs-space'); spaced = target; resized.disconnect(); resized.observe(target); }
    if (!spaced.hasAttribute('data-ruoyu-tabs-space')) spaced.setAttribute('data-ruoyu-tabs-space','');
    const top = Math.max(rect.top, titlebar?.getBoundingClientRect().bottom || 0);
    bar.style.left = `${Math.max(0, rect.left)}px`; bar.style.top = `${top}px`;
    bar.style.width = `${rect.width}px`;
    const bg = getComputedStyle(main).backgroundColor;
    if (bg !== background) { background = bg; bar.style.background = bg; bar.style.setProperty('--rt-bg', bg); menu.style.setProperty('--rt-bg', bg); }
  }
  function go(id) {
    if (!id) return;
    if (id === appActive && !pending) return;
    // Select the tab right away; the app's own navigation finishes a moment later.
    if (id !== active) { pending = { id, at: performance.now() }; active = id; render(); }
    const row = rowFor(id);
    if (row) row.click(); else navigate('/local/' + id);
  }
  function close(id) {
    const at = tabs.findIndex(t => t.id === id); if (at < 0) return;
    suppressed = id; tabs.splice(at, 1); persist();
    if (id === active) { active = ''; pending = null; if (tabs.length) go(tabs[Math.min(at, tabs.length - 1)].id); else navigate('/'); }
    render(); layout();
  }
  // Close several tabs at once; if the selected one goes, `keep` becomes the selection.
  function closeOthers(keep, gone) {
    const ids = new Set(gone.map(t => t.id)); if (!ids.size) return;
    tabs = tabs.filter(t => !ids.has(t.id)); persist();
    if (ids.has(active)) { suppressed = active; active = ''; pending = null; go(keep); }
    render(); layout();
  }
  // One element set per tab, kept across renders: a refresh only touches what changed.
  const nodes = new Map();
  function node(id) {
    let n = nodes.get(id); if (n) return n;
    const item = document.createElement('div'); item.className = 'rt-item'; item.dataset.id = id;
    const open = document.createElement('button'); open.className = 'rt-open'; open.setAttribute('role','tab'); open.dataset.id = id;
    const dot = document.createElement('span'); dot.className = 'rt-dot'; dot.hidden = true;
    const label = document.createElement('span'); label.className = 'rt-label';
    open.append(dot, label);
    const x = document.createElement('button'); x.className = 'rt-close'; x.innerHTML = icon.close; x.title = '关闭标签（不会删除对话）';
    item.append(open, x);
    n = { item, open, dot, label, x, title: null, kind: null, agentName: '' }; nodes.set(id, n);
    return n;
  }
  function shortcut(i) { return i < 8 ? `⌘${i + 1}` : i === tabs.length - 1 ? '⌘9' : ''; }
  function render() {
    const ids = new Set(tabs.map(t => t.id));
    for (const [id, n] of nodes) if (!ids.has(id)) { n.item.remove(); nodes.delete(id); }
    tabs.forEach((tab, i) => {
      const n = node(tab.id), title = tab.title || UNTITLED, on = tab.id === active;
      if (n.title !== title) {
        n.title = title; n.label.textContent = title;
        n.open.setAttribute('aria-label', title); n.x.setAttribute('aria-label', `关闭标签：${title}`);
      }
      const kind = tab.agent || '';
      if (n.kind !== kind) {
        n.kind = kind; n.open.querySelector('.rt-agent')?.remove();
        const logo = agentIcon(kind); if (logo) n.open.prepend(logo);
        n.agentName = logo?.getAttribute('aria-label') || '';
      }
      if (n.dot.hidden === !!tab.running) n.dot.hidden = !tab.running;
      if (n.item.classList.contains('rt-active') !== on) {
        n.item.classList.toggle('rt-active', on);
        n.open.setAttribute('aria-selected', String(on));
        if (on) n.open.setAttribute('aria-current', 'page'); else n.open.removeAttribute('aria-current');
      }
      const tip = [title, n.agentName, shortcut(i)].filter(Boolean).join(' · ');
      if (n.item.title !== tip) n.item.title = tip;
    });
    let ref = list.firstElementChild;
    for (const tab of tabs) {
      const item = nodes.get(tab.id).item;
      if (item === ref) ref = ref.nextElementSibling; else list.insertBefore(item, ref);
    }
    // Scroll only when the selection changes, so a manually scrolled bar stays where the user left it.
    if (active !== scrolledTo) { scrolledTo = active; reveal(nodes.get(active)?.item); }
  }
  function reveal(item) {
    if (!item) return;
    const left = item.offsetLeft, right = left + item.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left - 4;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth + 4;
  }
  function refresh() {
    if (disposed) return;
    clearTimeout(timer); timer = 0;
    if (drag?.moved) return;  // endDrag() refreshes once the tab is dropped
    const byId = new Map(); let selected = null;
    for (const r of sidebarRows()) {
      if (!isLocal(r)) continue;
      const id = rowId(r);
      if (!selected && r.getAttribute(attr + 'active') === 'true' && visible(r)) { selected = r; byId.set(id, r); }
      else if (!byId.has(id)) byId.set(id, r);
    }
    appActive = (selected && rowId(selected)) || routeId();
    if (pending && (pending.id === appActive || performance.now() - pending.at > 1500)) pending = null;
    const id = pending ? pending.id : appActive;
    active = id; if (id !== suppressed) suppressed = '';
    for (const t of tabs) {
      let row = byId.get(t.id);
      // After a reload the row carries the thread's real id; follow it by title, once the sidebar has loaded.
      if (!row && t.id.startsWith(CLIENT) && byId.size) {
        row = [...byId.values()].find(r => r.getAttribute(attr + 'title') === t.title && !tabs.some(x => x.id === rowId(r)));
        if (row) t.id = rowId(row);
      }
      if (row) { t.title = row.getAttribute(attr+'title') || t.title; t.agent = agentOf(row) || t.agent; }
      t.running = !!row?.querySelector('[data-loading-indicator]');
    }
    if (id && id !== suppressed && ID.test(id) && !tabs.some(t => t.id === id)) {
      const agent = agentOf(selected), title = selected?.getAttribute(attr+'title') || UNTITLED;
      tabs.push(agent ? { id, title, agent } : { id, title });
      if (tabs.length > MAX_TABS) tabs.shift();
    }
    render(); persist(); layout();
  }
  // Throttle rather than debounce: a steady stream of mutations must not postpone the refresh forever.
  function schedule() { if (!timer) timer = setTimeout(refresh, 80); }
  const observer = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.target === bar || bar.contains(m.target)) continue;
      // Streaming replies rewrite the conversation constantly; no sidebar row lives there.
      if (m.type === 'childList' && spaced?.contains(m.target)) continue;
      schedule(); return;
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:[attr+'active',attr+'title','data-app-shell-active-page']});
  window.addEventListener('resize',layout,opts);
  window.addEventListener('popstate',schedule,opts);
  list.addEventListener('click', e => {
    const item = e.target.closest('.rt-item'); if (!item) return;
    if (e.target.closest('.rt-close')) { e.stopPropagation(); close(item.dataset.id); }
    // Mouse presses were handled on pointerdown; this is Enter/Space on a focused tab.
    else if (e.detail === 0 && e.target.closest('.rt-open')) go(item.dataset.id);
  }, opts);
  // Drag to reorder, with pointer events rather than HTML drag and drop: no ghost image, the
  // tab follows the pointer, the others slide aside, and nothing can be dropped into the composer.
  // A tab must never stay stuck to the pointer, so a drag also ends when the release is missed:
  // the pointer comes back with no button down, pointer capture is lost, or the window loses focus.
  let drag = null;
  list.addEventListener('pointerdown', e => {
    if (drag) endDrag(true);  // the release of the previous press never arrived
    // Ctrl-click is a right-click on macOS: leave it to the contextmenu handler.
    if (e.button !== 0 || e.ctrlKey || e.target.closest('.rt-close')) return;
    const item = e.target.closest('.rt-item'); if (!item) return;
    // Select on press, as browsers do; dragging still works from here.
    go(item.dataset.id);
    drag = { id: item.dataset.id, item, pointerId: e.pointerId, startX: e.clientX, x: e.clientX, moved: false };
    // Capture from the press on, so the release reaches us wherever the pointer is let go.
    try { list.setPointerCapture(e.pointerId); } catch {}
  }, opts);
  list.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!(e.buttons & 1)) return endDrag(true);
    drag.x = e.clientX;
    if (!drag.moved) { if (Math.abs(drag.x - drag.startX) < 5) return; startDrag(); }
    dragUpdate();
  }, opts);
  list.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointerId) endDrag(true); }, opts);
  list.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) endDrag(false); }, opts);
  list.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.pointerId) endDrag(true); }, opts);
  // Fallback for a release that bypasses the list despite capture.
  window.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointerId) endDrag(true); }, { capture: true, signal: abort.signal });
  document.addEventListener('keydown', e => {
    if (drag?.moved && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); endDrag(false); }
  }, { capture: true, signal: abort.signal });
  window.addEventListener('blur', () => drag && endDrag(false), opts);
  // Right-click opens a tab menu: tab actions first, then the app's own thread menu (rename, pin,
  // archive, ...). That menu is native, so it cannot take extra items; "对话选项…" opens it by
  // replaying the event on the thread's sidebar row, and the app shows it at the given coordinates.
  function threadMenu(id, x, y) {
    const row = rowFor(id, true); if (!row) return;
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: window.screenX + x, screenY: window.screenY + y, button: 2, buttons: 2 }));
  }
  function tabMenu(id, x, y) {
    const at = tabs.findIndex(t => t.id === id); if (at < 0) return;
    const hasRow = !!rowFor(id, true);
    const entries = [
      ['关闭标签', () => close(id), true],
      ['关闭其他标签', () => closeOthers(id, tabs.filter(t => t.id !== id)), tabs.length > 1],
      ['关闭右侧标签', () => closeOthers(id, tabs.slice(at + 1)), at < tabs.length - 1],
      null,
      hasRow ? ['对话选项…', () => threadMenu(id, x, y), true] : ['侧栏里没有这个对话', null, false],
    ];
    menu.replaceChildren(...entries.map(entry => {
      if (!entry) { const hr = document.createElement('hr'); hr.setAttribute('role', 'separator'); return hr; }
      const [label, run, enabled] = entry;
      const b = document.createElement('button'); b.setAttribute('role', 'menuitem'); b.textContent = label; b.disabled = !enabled;
      if (run) b.addEventListener('click', () => { hideMenu(); run(); });
      return b;
    }));
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 4))}px`;
    menu.querySelector('button:not(:disabled)')?.focus();
  }
  function hideMenu() { if (!menu.hidden) { menu.hidden = true; menu.replaceChildren(); } }
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) hideMenu(); }, { capture: true, signal: abort.signal });
  window.addEventListener('blur', hideMenu, opts);
  window.addEventListener('resize', hideMenu, opts);
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); hideMenu(); list.querySelector('.rt-active .rt-open')?.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
  }, opts);
  list.addEventListener('contextmenu', e => {
    const item = e.target.closest('.rt-item'); if (!item) return;
    e.preventDefault(); e.stopPropagation();
    if (!drag?.moved) tabMenu(item.dataset.id, e.clientX, e.clientY);
  }, opts);
  function startDrag() {
    const d = drag, items = [...list.children];
    d.moved = true; d.items = items; d.from = d.to = items.indexOf(d.item);
    d.lefts = items.map(it => it.offsetLeft); d.widths = items.map(it => it.offsetWidth);
    d.width = d.widths[d.from]; d.end = d.lefts.at(-1) + d.widths.at(-1);
    d.gap = items.length > 1 ? d.lefts[1] - d.lefts[0] - d.widths[0] : 0;
    d.scroll0 = list.scrollLeft;
    // The titlebar is a window drag region: the system takes mouse events over it, and a
    // release there would never reach the page. Switch drag regions off until the drop.
    document.documentElement.classList.add('rt-dragging');
    bar.classList.add('rt-reordering'); d.item.classList.remove('rt-settle'); d.item.classList.add('rt-lifted');
    const edge = 36, step = () => {
      if (drag !== d) return;
      const r = list.getBoundingClientRect();
      const v = d.x < r.left + edge ? -(r.left + edge - d.x) : d.x > r.right - edge ? d.x - (r.right - edge) : 0;
      if (v && list.scrollWidth > list.clientWidth) { list.scrollLeft += Math.max(-14, Math.min(14, v / 2.5)); dragUpdate(); }
      d.raf = requestAnimationFrame(step);
    };
    d.raf = requestAnimationFrame(step);
  }
  function dragUpdate() {
    const d = drag, start = d.lefts[d.from];
    const left = Math.min(Math.max(start + d.x - d.startX + list.scrollLeft - d.scroll0, 0), d.end - d.width);
    d.item.style.transform = `translateX(${left - start}px)`;
    // Swap with a neighbour once the leading edge crosses its midpoint. Testing the dragged tab's
    // centre instead never reaches the last slot: the clamp stops it exactly on the last midpoint.
    let to = 0;
    d.items.forEach((it, k) => {
      const mid = d.lefts[k] + d.widths[k] / 2;
      if (k < d.from ? left >= mid : k > d.from && left + d.width > mid) to++;
    });
    if (to === d.to) return;
    d.to = to;
    const shift = d.width + d.gap;
    d.items.forEach((it, k) => {
      if (k === d.from) return;
      const s = d.from < k && k <= to ? -shift : to <= k && k < d.from ? shift : 0;
      it.style.transform = s ? `translateX(${s}px)` : '';
    });
  }
  function endDrag(commit) {
    const d = drag; drag = null;
    if (!d) return;
    // Clear `drag` first: releasing capture fires lostpointercapture, which must find nothing to end.
    try { list.releasePointerCapture(d.pointerId); } catch {}
    if (!d.moved) return;
    cancelAnimationFrame(d.raf);
    document.documentElement.classList.remove('rt-dragging');
    const moved = commit && d.to !== d.from;
    const before = d.item.getBoundingClientRect().left;
    if (moved) {
      const at = tabs.findIndex(t => t.id === d.id);
      if (at >= 0) { const [t] = tabs.splice(at, 1); tabs.splice(d.to, 0, t); persist(); }
    } else {
      // Cancelled or dropped in place: let the others slide back.
      d.items.forEach(it => { if (it !== d.item) it.classList.add('rt-settle'); });
    }
    bar.classList.remove('rt-reordering');
    // After a move the new DOM order matches where the others already sit, so they snap invisibly.
    d.items.forEach(it => { it.style.transform = ''; });
    render();
    // Slide the dropped tab from under the pointer into its slot.
    d.item.style.transform = `translateX(${before - d.item.getBoundingClientRect().left}px)`;
    d.item.offsetWidth;
    d.item.classList.add('rt-settle'); d.item.style.transform = '';
    // A plain click on the same tab within the settle time must not leave it looking lifted.
    const done = () => d.items.forEach(it => { if (!(drag?.moved && drag.item === it)) it.classList.remove('rt-settle', 'rt-lifted'); });
    setTimeout(done, 220);
    refresh();
  }
  list.addEventListener('auxclick', e => {
    const item = e.target.closest('.rt-item');
    if (item && e.button === 1) { e.preventDefault(); close(item.dataset.id); }
  }, opts);
  // The scrollbar is hidden, so let a vertical mouse wheel scroll the tabs sideways.
  list.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || list.scrollWidth <= list.clientWidth) return;
    e.preventDefault(); list.scrollLeft += e.deltaY;
  }, { passive: false, signal: abort.signal });
  // Avoid rebinding the app's default Cmd+W: closing a tab has an explicit control.
  // Cmd+1-8 pick a position, Cmd+9 the last tab, as in browsers.
  document.addEventListener('keydown', e => {
    if (bar.hidden || e.isComposing || e.altKey || e.ctrlKey || !e.metaKey || e.shiftKey || !/^[1-9]$/.test(e.key)) return;
    const tab = e.key === '9' ? tabs[tabs.length - 1] : tabs[Number(e.key) - 1];
    if (tab) { e.preventDefault(); e.stopImmediatePropagation(); go(tab.id); }
  },{capture:true,signal:abort.signal});
  list.addEventListener('keydown', e => {
    const buttons = Array.from(list.querySelectorAll('.rt-open'));
    const i = buttons.indexOf(document.activeElement); if (i < 0) return;
    let next;
    if (e.key === 'ArrowRight') next = (i+1)%buttons.length;
    if (e.key === 'ArrowLeft') next = (i+buttons.length-1)%buttons.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length-1;
    if (next != null) { e.preventDefault(); buttons[next].focus(); }
    if (e.key === 'Delete') { e.preventDefault(); close(buttons[i].dataset.id); }
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault(); const r = buttons[i].getBoundingClientRect(); tabMenu(buttons[i].dataset.id, r.left, r.bottom);
    }
  },opts);
  const interval = setInterval(refresh,1500);
  window.__ruoyuTabs = { dispose() { if (drag) cancelAnimationFrame(drag.raf); drag = null; document.documentElement.classList.remove('rt-dragging'); disposed=true; clearInterval(interval); clearTimeout(timer); observer.disconnect(); resized.disconnect(); abort.abort(); spaced?.removeAttribute('data-ruoyu-tabs-space'); bar.remove(); menu.remove(); style.remove(); delete window.__ruoyuTabs; } };
  refresh();
})
