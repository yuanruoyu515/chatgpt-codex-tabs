/* Independent implementation inspired by codexplusplus-horizontal-tabs. */
(function installTabs(navigate) {
  'use strict';
  window.__ruoyuTabs?.dispose();
  // Only the main window gets a tab bar; overlays and windows opened on a single route do not.
  if (new URL(location.href).searchParams.has('initialRoute')) return;
  const store = localStorage;
  const key = 'ruoyu-horizontal-tabs:v1';
  const attr = 'data-app-action-sidebar-thread-';
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  let tabs = [], active = '', signature = '', disposed = false, timer, dragId, suppressed = '', saved = '';
  try { tabs = JSON.parse(store.getItem(key) || '[]').filter(valid).slice(-30); } catch {}
  function valid(t) { return t && typeof t.id === 'string' && /^[\w-]{1,100}$/.test(t.id) && typeof t.title === 'string' && (t.agent === undefined || /^[\w-]{1,40}$/.test(t.agent)); }
  function visible(el) { return el && !el.closest('[data-app-shell-active-page="false"], [inert]') && el.getBoundingClientRect().width > 0; }
  function rowId(r) { return (r.getAttribute(attr + 'id') || '').replace(/^local:/, ''); }
  function rows() { return Array.from(document.querySelectorAll(`[${attr}row]`)).filter(visible); }
  function routeId() {
    const url = new URL(location.href);
    const path = url.searchParams.get('initialRoute') || url.pathname;
    return /^\/local\/([\w-]+)(?:[/?#]|$)/.exec(path)?.[1] || '';
  }
  // Agent logos come from codexhost: each sidebar row carries a span[data-codexhost-sidebar-agent-icon].
  // Logos are cached per agent so a tab keeps its logo while its sidebar row is hidden or collapsed.
  const agentAttr = 'data-codexhost-sidebar-agent-icon', iconKey = key + ':agent-icons';
  let icons = {};
  try { icons = JSON.parse(store.getItem(iconKey) || '{}') || {}; } catch {}
  function agentOf(row) {
    const span = row?.querySelector(`[${agentAttr}]`); const kind = span?.getAttribute(agentAttr) || '';
    if (!/^[\w-]{1,40}$/.test(kind)) return '';
    const html = span.outerHTML;
    if (icons[kind] !== html && html.length < 200000 && !/<script|\son\w+=/i.test(html)) {
      icons[kind] = html; try { store.setItem(iconKey, JSON.stringify(icons)); } catch {}
    }
    return kind;
  }
  function agentIcon(kind) {
    const html = kind && icons[kind]; if (!html) return null;
    const tpl = document.createElement('template'); tpl.innerHTML = html;
    const el = tpl.content.firstElementChild; if (!el?.hasAttribute(agentAttr)) return null;
    el.classList.add('rt-agent'); el.removeAttribute('title'); return el;
  }
  function persist() { try { const value = JSON.stringify(tabs); if (value !== saved) { store.setItem(key,value); saved=value; } } catch {} }
  const icon = {
    close: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
  };
  const style = document.createElement('style');
  style.textContent = `
    #ruoyu-chat-tabs{--rt-fg:var(--color-text-primary-ghost,#1f2328);--rt-muted:var(--color-text-secondary-ghost,#1f23287e);--rt-hover:var(--color-background-primary-ghost-hover,#1f23280e);--rt-line:var(--color-border,#1f232814);--rt-ring:var(--color-ring,#0969da);--rt-ease:var(--ease-enter-snappy,cubic-bezier(.23,1,.32,1));
      position:fixed;z-index:100;display:flex;align-items:center;gap:6px;height:40px;padding:0 10px 0 12px;box-sizing:border-box;border-bottom:1px solid var(--rt-line);color:var(--rt-fg);font:430 13px/18px var(--font-sans,-apple-system,BlinkMacSystemFont,sans-serif);-webkit-app-region:no-drag;overflow:hidden}
    #ruoyu-chat-tabs[hidden]{display:none!important}
    #ruoyu-chat-tabs .rt-list{display:flex;align-items:center;gap:2px;min-width:0;flex:1;height:100%;overflow-x:auto;scrollbar-width:none}
    #ruoyu-chat-tabs .rt-list::-webkit-scrollbar{display:none}
    #ruoyu-chat-tabs .rt-item{position:relative;display:flex;align-items:center;flex:0 1 200px;min-width:84px;height:28px;padding:0 3px 0 10px;border-radius:var(--radius-md,10px);color:var(--rt-muted);cursor:default;transition:background-color .15s var(--rt-ease),color .15s var(--rt-ease),opacity .15s}
    #ruoyu-chat-tabs .rt-item:hover{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs .rt-item.rt-active{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs .rt-item.rt-dragging{opacity:.35}
    #ruoyu-chat-tabs .rt-item.rt-drop-before::before,#ruoyu-chat-tabs .rt-item.rt-drop-after::after{content:'';position:absolute;top:6px;bottom:6px;width:2px;border-radius:1px;background:var(--rt-ring)}
    #ruoyu-chat-tabs .rt-item.rt-drop-before::before{left:-2px}
    #ruoyu-chat-tabs .rt-item.rt-drop-after::after{right:-2px}
    #ruoyu-chat-tabs button{font:inherit;color:inherit;background:transparent;border:0;padding:0;margin:0;cursor:default;-webkit-app-region:no-drag}
    #ruoyu-chat-tabs button:focus-visible{outline:2px solid var(--rt-ring);outline-offset:-2px;border-radius:var(--radius-sm,7px)}
    #ruoyu-chat-tabs .rt-open{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-align:left}
    #ruoyu-chat-tabs .rt-agent{flex:none;display:inline-flex!important;width:14px!important;height:14px!important}
    #ruoyu-chat-tabs .rt-item:not(.rt-active):not(:hover) .rt-agent{opacity:.85}
    #ruoyu-chat-tabs .rt-label{overflow:hidden;text-overflow:ellipsis}
    #ruoyu-chat-tabs .rt-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--color-text-info-ghost-hover,#0169cc)}
    #ruoyu-chat-tabs .rt-close{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:6px;color:var(--rt-muted);opacity:0;transition:opacity .15s,background-color .15s}
    #ruoyu-chat-tabs .rt-item:hover .rt-close,#ruoyu-chat-tabs .rt-active .rt-close,#ruoyu-chat-tabs .rt-close:focus-visible{opacity:1}
    #ruoyu-chat-tabs .rt-close:hover{background:var(--rt-hover);color:var(--rt-fg)}
    #ruoyu-chat-tabs .rt-add{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:var(--radius-md,10px);color:var(--rt-muted);transition:background-color .15s,color .15s}
    #ruoyu-chat-tabs .rt-add:hover{background:var(--rt-hover);color:var(--rt-fg)}
    [data-ruoyu-tabs-space]{padding-top:40px!important;box-sizing:border-box!important}
    @media(prefers-reduced-motion:reduce){#ruoyu-chat-tabs *{transition:none!important}}
    @media(forced-colors:active){#ruoyu-chat-tabs .rt-active{outline:1px solid Highlight}}
  `;
  const bar = document.createElement('nav');
  bar.id = 'ruoyu-chat-tabs'; bar.setAttribute('aria-label', '打开的对话');
  const list = document.createElement('div'); list.className = 'rt-list'; list.setAttribute('role','tablist'); bar.append(list);
  const add = document.createElement('button'); add.className = 'rt-add'; add.innerHTML = icon.plus; add.title = '新建对话'; add.setAttribute('aria-label', '新建对话');
  add.addEventListener('click', () => navigate('/'), opts); bar.append(add);
  document.head.append(style); document.body.append(bar);
  let spaced;
  function layout() {
    const main = Array.from(document.querySelectorAll('[data-app-shell-main-surface], main')).find(visible);
    const titlebar = Array.from(document.querySelectorAll('[data-app-shell-main-titlebar], header')).find(visible);
    const body = main?.querySelector('[data-app-shell-main-content-layout]');
    const rect = (body || main)?.getBoundingClientRect();
    // If the app layout cannot be identified, fail closed instead of covering the composer.
    const hide = !rect || /(?:\/|^)settings(?:\/|$)/.test(location.href) || !tabs.length;
    bar.hidden = hide;
    if (hide) { spaced?.removeAttribute('data-ruoyu-tabs-space'); spaced = null; return; }
    const target = body || main;
    if (spaced !== target) { spaced?.removeAttribute('data-ruoyu-tabs-space'); spaced = target; }
    if (!spaced.hasAttribute('data-ruoyu-tabs-space')) spaced.setAttribute('data-ruoyu-tabs-space','');
    const top = Math.max(rect.top, titlebar?.getBoundingClientRect().bottom || 0);
    bar.style.left = `${Math.max(0, rect.left)}px`; bar.style.top = `${top}px`;
    bar.style.width = `${rect.width}px`;
    bar.style.background = getComputedStyle(main).backgroundColor;
  }
  function go(id) {
    const row = rows().find(r => rowId(r) === id && ['', 'local'].includes(r.getAttribute(attr + 'host-id') || ''));
    if (row) row.click(); else navigate('/local/' + id);
  }
  function close(id) {
    const at = tabs.findIndex(t => t.id === id); if (at < 0) return;
    suppressed = id; tabs.splice(at, 1); persist();
    if (id === active) { active = ''; if (tabs.length) go(tabs[Math.min(at, tabs.length - 1)].id); else navigate('/'); }
    render(true); layout();
  }
  function clearDrop() { list.querySelectorAll('.rt-drop-before,.rt-drop-after').forEach(el => el.classList.remove('rt-drop-before','rt-drop-after')); }
  function render(force = false) {
    const next = JSON.stringify([tabs,active]); if (!force && signature === next) return;
    const focused = list.contains(document.activeElement) ? document.activeElement?.dataset.id : null;
    signature = next; list.replaceChildren();
    tabs.forEach((tab, i) => {
      const item = document.createElement('div'); item.className = 'rt-item' + (tab.id === active ? ' rt-active' : ''); item.draggable = true;
      const agentName = tab.agent && agentIcon(tab.agent)?.getAttribute('aria-label');
      item.title = `${tab.title || '未命名对话'}${agentName ? ' · ' + agentName : ''} · ⌘${i + 1}`;
      const button = document.createElement('button'); button.className = 'rt-open'; button.setAttribute('role','tab');
      button.dataset.id = tab.id; button.setAttribute('aria-label', tab.title || '未命名对话');
      button.setAttribute('aria-selected', String(tab.id === active));
      if (tab.id === active) button.setAttribute('aria-current','page');
      const logo = agentIcon(tab.agent); if (logo) button.append(logo);
      if (tab.running) { const dot = document.createElement('span'); dot.className = 'rt-dot'; button.append(dot); }
      const label = document.createElement('span'); label.className = 'rt-label'; label.textContent = tab.title || '未命名对话'; button.append(label);
      button.addEventListener('click', () => go(tab.id));
      item.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); close(tab.id); } });
      const x = document.createElement('button'); x.className = 'rt-close'; x.innerHTML = icon.close;
      x.setAttribute('aria-label', `关闭标签：${tab.title}`); x.title = '关闭标签（不会删除对话）';
      x.addEventListener('click', e => { e.stopPropagation(); close(tab.id); });
      item.append(button,x); list.append(item);
      item.addEventListener('dragstart', e => { dragId = tab.id; item.classList.add('rt-dragging'); e.dataTransfer.setData('text/plain', tab.id); e.dataTransfer.effectAllowed = 'move'; });
      item.addEventListener('dragover', e => {
        if (!dragId || dragId === tab.id) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        const after = e.clientX > item.getBoundingClientRect().left + item.offsetWidth / 2;
        clearDrop(); item.classList.add(after ? 'rt-drop-after' : 'rt-drop-before');
      });
      item.addEventListener('dragleave', () => item.classList.remove('rt-drop-before','rt-drop-after'));
      item.addEventListener('drop', e => {
        e.preventDefault(); const after = item.classList.contains('rt-drop-after'); clearDrop();
        const from = tabs.findIndex(t => t.id === dragId); if (from < 0 || dragId === tab.id) return;
        const [t] = tabs.splice(from,1); const to = tabs.findIndex(x => x.id === tab.id) + (after ? 1 : 0);
        tabs.splice(to,0,t); dragId = null; persist(); render(true);
      });
      item.addEventListener('dragend', () => { dragId = null; item.classList.remove('rt-dragging'); clearDrop(); });
    });
    if (focused) Array.from(list.querySelectorAll('.rt-open')).find(b => b.dataset.id === focused)?.focus({preventScroll:true});
    list.querySelector('.rt-active')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function refresh() {
    if (disposed) return;
    const all = rows();
    const selected = all.find(r => r.getAttribute(attr + 'active') === 'true' && ['', 'local'].includes(r.getAttribute(attr + 'host-id') || ''));
    const id = (selected && rowId(selected)) || routeId();
    active = id; if (id !== suppressed) suppressed = '';
    for (const t of tabs) {
      const row = all.find(r => rowId(r) === t.id && ['', 'local'].includes(r.getAttribute(attr+'host-id') || ''));
      if (row) { t.title = row.getAttribute(attr+'title') || t.title; t.agent = agentOf(row) || t.agent; }
    }
    if (id && id !== suppressed && /^[\w-]{1,100}$/.test(id) && !tabs.some(t => t.id === id)) {
      const agent = agentOf(selected);
      tabs.push(agent ? {id, title:selected.getAttribute(attr+'title') || '未命名对话', agent} : {id, title:selected?.getAttribute(attr+'title') || '未命名对话'});
      if (tabs.length > 30) tabs.shift();
    }
    render(); persist(); layout();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh,100); }
  const observer = new MutationObserver(ms => { if (ms.some(m => !bar.contains(m.target) && m.target !== bar)) schedule(); });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:[attr+'active',attr+'title','data-app-shell-active-page']});
  window.addEventListener('resize',layout,opts);
  window.addEventListener('popstate',schedule,opts);
  // Avoid rebinding the app's default Cmd+W: closing a tab has an explicit control.
  document.addEventListener('keydown', e => {
    if (bar.hidden || e.isComposing || e.altKey || e.ctrlKey || !e.metaKey || e.shiftKey) return;
    const i = Number(e.key)-1;
    if (/^[1-9]$/.test(e.key) && tabs[i]) { e.preventDefault(); e.stopImmediatePropagation(); go(tabs[i].id); }
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
    if (e.key === 'Delete') { e.preventDefault(); close(tabs[i].id); }
  },opts);
  const interval = setInterval(refresh,1500);
  window.__ruoyuTabs = { dispose() { disposed=true; clearInterval(interval); clearTimeout(timer); observer.disconnect(); abort.abort(); spaced?.removeAttribute('data-ruoyu-tabs-space'); bar.remove(); style.remove(); delete window.__ruoyuTabs; } };
  refresh();
})
