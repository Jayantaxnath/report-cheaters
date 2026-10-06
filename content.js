(() => {
  if (window.__lcrh) return;
  window.__lcrh = true;

  // ---------- helpers (verified in console) ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = (fn, t = 8000) => new Promise((res, rej) => {
    const s = Date.now(), id = setInterval(() => {
      const v = fn();
      if (v) { clearInterval(id); res(v); }
      else if (Date.now() - s > t) { clearInterval(id); rej(new Error('timeout')); }
    }, 120);
  });
  const waitGone = (fn, t = 5000) => waitFor(() => !fn(), t);
  const rowOf = a => { let r = a; while (r && r.children.length < 7) r = r.parentElement; return r; };
  const getRows = () => [...new Set([...document.querySelectorAll('a[href^="/u/"]')].map(rowOf))]
    .filter(r => r && r.children.length >= 7 && r.children.length <= 9 && r.offsetHeight <= 90 && !r.closest('nav,header,[role=dialog]'));
  window.lcrhDebug = () => {
    const links = document.querySelectorAll('a[href^="/u/"]').length;
    const rows = getRows();
    console.log({ url: location.href, userLinks: links, rows: rows.length,
      childCounts: rows.map(r => r.children.length), first: rows[0]?.innerText.replace(/\n+/g, ' | ') });
  };
  const replayDlg = () => [...document.querySelectorAll('[role=dialog]')]
    .find(d => /code replay/i.test(d.textContent) && !/reason for report/i.test(d.textContent));
  const reportDlg = () => [...document.querySelectorAll('[role=dialog]')]
    .find(d => /reason for report/i.test(d.textContent));
  const pressEsc = () => document.dispatchEvent(new KeyboardEvent('keydown',
    { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));

  const REASONS = [
    'Multiple accounts',
    'Similar or identical',
    'Shared or leaked',
    'Used external AI',
    'Others',
  ];

  // your own usernames (lowercase); these rows can never be reported
  // "me" is detected automatically: LeetCode labels your own pinned row "You", so that row's username is remembered
  // (localStorage 'lcrh_self') and every row with that username is disabled. Nothing is hard-coded.
  const loadSelf = () => { try { return new Set((localStorage.getItem('lcrh_self') || '').split(',').filter(Boolean)); } catch { return new Set(); } };
  const SELF = loadSelf();
  const userOf = r => (r?.querySelector('a[href^="/u/"]')?.getAttribute('href') || '').replace(/^\/u\/|\/$/g, '');
  const isSelf = r => {
    const u = userOf(r).toLowerCase();
    if (!u) return false;
    if (r.innerText.split('\n')[0].trim() === 'You' && !SELF.has(u)) {
      SELF.add(u);
      try { localStorage.setItem('lcrh_self', [...SELF].join(',')); } catch {}
    }
    return SELF.has(u);
  };

  const DEFAULT_NOTE = 'Suspected cheating in {contest}: user {user}, {q} accepted at {time}. The code in the replay appears to be AI-generated, lightly edited, then pasted in. Please review the replay and compare it with similar submissions.';
  const resolveNote = (tpl, r, q) => {
    const cell = r?.children[2 + q]?.querySelector('.ranking-guide-anchor');
    const time = cell?.textContent.match(/\d{1,2}:\d{2}:\d{2}/)?.[0] || '';
    const contest = (location.pathname.match(/\/contest\/([^/]+)/) || [])[1] || 'this contest';
    return (tpl || '')
      .replace(/Q?\{q\}/g, 'Q' + q)      // {q} and Q{q} both give "Q1"
      .replace(/\{time\}/g, time)
      .replace(/\{user\}/g, userOf(r))
      .replace(/\{contest\}/g, contest);
  };

  // ---------- the flow ----------
  async function report({ row, q, reason, note, submit }) {
    if (replayDlg() || reportDlg()) throw new Error('a dialog is already open, close it first');
    const r = getRows()[row - 1];
    if (!r) throw new Error('row ' + row + ' not found');
    if (isSelf(r)) throw new Error('row ' + row + ' is you, skipped');
    const cell = r.children[2 + q]?.querySelector('.ranking-guide-anchor');
    if (!cell) throw new Error('row ' + row + ' has no submission for Q' + q);

    note = resolveNote(note, r, q);
    console.log('[LC Report Helper] row ' + row + ' Q' + q + ' (' + userOf(r) + ') note:', JSON.stringify(note));

    cell.click();
    await waitFor(replayDlg);

    const rc = await waitFor(() => [...document.querySelectorAll('[aria-haspopup="dialog"]')]
      .find(e => /^report cheating$/i.test(e.textContent.trim())));
    rc.click();
    const dlg = await waitFor(reportDlg);

    const lab = [...dlg.querySelectorAll('label')]
      .find(l => l.textContent.trim().toLowerCase().startsWith(reason.toLowerCase()));
    if (!lab) throw new Error('reason not found: ' + reason);
    const cb = lab.querySelector('[role=checkbox]');
    if (cb.getAttribute('aria-checked') !== 'true') cb.click();
    await sleep(200);
    if (cb.getAttribute('aria-checked') !== 'true') throw new Error('reason did not tick');

    if (note) {
      const ta = dlg.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, note);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const sub = [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit');
    if (!sub || sub.disabled) throw new Error('Submit not available');

    if (!submit) {
      sub.style.outline = '3px solid lime';
      return 'prefilled, press Submit yourself';
    }

    sub.click();
    try { await waitGone(reportDlg, 5000); }
    catch { throw new Error('report dialog did not close after Submit'); }
    pressEsc();
    await waitGone(replayDlg, 3000).catch(() => {});
    return 'submitted';
  }

  // ---------- UI (LeetCode-style; Shadow DOM so the site's CSS can't leak in or out) ----------
  const CSS = `
  .root{--bg:#fff;--surface:#f7f8fa;--surface2:#ebebeb;--border:#e5e5e5;--text:#262626;--muted:#7a7a7a;
    --accent:#ffa116;--accent-bg:rgba(255,161,22,.14);--green:#2cbb5d;--red:#ef4743;--shadow:0 8px 24px rgba(0,0,0,.18);--scroll:#c4c4c4;color-scheme:light;
    font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text)}
  .root[data-theme=dark]{--bg:#1a1a1a;--surface:#282828;--surface2:#353535;--border:#3e3e3e;--text:#eff1f6;--muted:#9a9a9a;--shadow:0 8px 24px rgba(0,0,0,.6);--scroll:#555;color-scheme:dark}
  .root *{box-sizing:border-box}
  .hidden{display:none!important}
  .panel{position:fixed;left:12px;bottom:12px;width:320px;background:var(--bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;pointer-events:auto}
  .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--border);cursor:move;user-select:none;touch-action:none}
  .panel.min .hd{border-bottom:0}
  .logo{width:22px;height:22px;border-radius:6px;background:var(--accent);color:#1a1a1a;display:grid;place-items:center;flex:none}
  .title{flex:1;font-weight:600;font-size:14px}
  .logo.img{background:transparent}
  .logo img,.launcher img{width:100%;height:100%;object-fit:contain;display:block;border-radius:6px}
  .ib{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center;padding:0}
  .ib:hover{background:var(--surface2);color:var(--text)}
  .bd{padding:12px;display:flex;flex-direction:column;gap:12px}
  .btn{height:30px;padding:0 10px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;cursor:pointer;font:inherit;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:4px}
  .btn:hover:not(:disabled){background:var(--surface2)}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .nav{display:flex;align-items:center;gap:8px}
  .nav .btn{flex:1}
  .numwrap{display:flex;align-items:center;gap:6px;color:var(--muted);flex:none;white-space:nowrap}
  .who{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
  .nm{font-weight:600;font-size:14px;word-break:break-word}
  .un{color:var(--muted);font-size:12px;word-break:break-all}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .chips:empty{display:none}
  .chip{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--accent-bg);color:var(--accent)}
  .chip.you{background:rgba(44,187,93,.16);color:var(--green)}
  .lbl{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
  .qs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .q{height:auto;flex-direction:column;gap:2px;padding:8px 0;border-radius:10px}
  .qn{font-size:15px;font-weight:700}
  .qt{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
  .q:hover:not(:disabled){border-color:var(--accent);background:var(--accent-bg)}
  .q.done{border-color:var(--green)}
  .q.done .qn::after{content:" \\2713";color:var(--green)}
  .danger{width:100%;height:34px;margin-top:8px;background:transparent;color:var(--red);border-color:var(--red);font-weight:600}
  .danger:hover:not(:disabled){background:rgba(239,71,67,.12)}
  .field{width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font:inherit;outline:none}
  .field:focus{border-color:var(--accent)}
  .field.num{width:52px;height:30px;padding:0;text-align:center;font-weight:600}
  select.field{height:32px;padding:0 8px}
  textarea.field{resize:none;height:66px;line-height:1.4;scrollbar-width:thin;scrollbar-color:var(--scroll) transparent}
  textarea.field::-webkit-scrollbar{width:6px}
  textarea.field::-webkit-scrollbar-track{background:transparent}
  textarea.field::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:999px}
  .link{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;font-size:12px;padding:0}
  .link:hover{text-decoration:underline}
  .switch{display:flex;align-items:center;justify-content:space-between;cursor:pointer}
  .switch input{position:absolute;opacity:0;pointer-events:none}
  .track{width:34px;height:20px;border-radius:999px;background:var(--surface2);position:relative;transition:background .15s;flex:none}
  .track::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
  .switch input:checked+.track{background:var(--green)}
  .switch input:checked+.track::after{left:16px}
  .status{font-size:12px;padding:8px 10px;border-radius:8px;border-left:3px solid var(--border);background:var(--surface);white-space:pre-wrap;word-break:break-word}
  .status:empty{display:none}
  .status.ok{border-left-color:var(--green)}
  .status.err{border-left-color:var(--red)}
  .status.run{border-left-color:var(--accent)}
  .launcher.img{background:transparent;border-radius:10px;overflow:hidden}
  .launcher{position:fixed;left:12px;bottom:12px;width:42px;height:42px;border-radius:50%;border:0;background:var(--accent);color:#1a1a1a;cursor:pointer;box-shadow:var(--shadow);display:grid;place-items:center;pointer-events:auto;padding:0}
  `;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = (d, size = 14) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p);
    return s;
  };
  const ICON = { flag: 'M5 21V4m0 0h12l-2.5 4.5L17 13H5', x: 'M6 6l12 12M18 6L6 18', minus: 'M5 12h14', plus: 'M12 5v14M5 12h14', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6' };
  const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

  const status = h('div', { className: 'status' });
  const setStatus = (kind, text) => { status.className = 'status ' + kind; status.textContent = text; };

  const rowIn = h('input', { type: 'number', value: 1, min: 1, max: 25, className: 'field num' });
  const totalEl = h('span', { textContent: '/ 25' });
  const nameEl = h('div', { className: 'nm' });
  const userEl = h('div', { className: 'un' });
  const chips = h('div', { className: 'chips' });
  const who = h('div', { className: 'who' }, nameEl, userEl, chips);

  const reasonSel = h('select', { className: 'field' }, ...REASONS.map(r => h('option', { value: r, textContent: r })));
  reasonSel.value = 'Used external AI';
  const noteIn = h('textarea', { className: 'field', placeholder: 'Note (optional)',
    value: (() => { try { return localStorage.getItem('lcrh_note2') ?? DEFAULT_NOTE; } catch { return DEFAULT_NOTE; } })() });
  const saveNote = () => { try { localStorage.setItem('lcrh_note2', noteIn.value); } catch {} };
  noteIn.addEventListener('input', saveNote);
  const resetNote = h('button', { className: 'link', textContent: 'Reset to default', onclick: () => { noteIn.value = DEFAULT_NOTE; saveNote(); } });
  const autoSub = h('input', { type: 'checkbox', checked: true });

  const logKey = 'lcrh_log';
  const getLog = () => { try { return JSON.parse(localStorage.getItem(logKey) || '[]'); } catch { return []; } };
  const addLog = e => { try { localStorage.setItem(logKey, JSON.stringify([...getLog(), e])); } catch {} };

  const cellOfRow = (r, q) => r?.children[2 + q]?.querySelector('.ranking-guide-anchor');
  const timeOf = c => c?.textContent.match(/\d{1,2}:\d{2}:\d{2}/)?.[0] || '';

  const refreshLabel = () => {
    const rows = getRows();
    let n = +rowIn.value || 1;
    if (rows.length && (n > rows.length || n < 1)) { n = Math.min(Math.max(1, n), rows.length); rowIn.value = n; }
    rowIn.max = rows.length || 25;
    totalEl.textContent = '/ ' + (rows.length || '?');
    const r = rows[n - 1];
    chips.replaceChildren();
    if (!r) {
      nameEl.textContent = rows.length ? 'Row out of range' : 'No ranking rows found';
      userEl.textContent = rows.length ? 'Use 1 to ' + rows.length : 'Open a contest ranking page';
      qBtns.forEach(b => { b.querySelector('.qt').textContent = '\u2014'; b.classList.remove('done'); b.dataset.has = ''; });
      updateBtns();
      return;
    }
    const user = r.querySelector('a[href^="/u/"]')?.getAttribute('href') || '';
    const done = getLog().filter(l => l.path === location.pathname && l.user === user).map(l => l.q);
    nameEl.textContent = r.innerText.split('\n')[0];
    userEl.textContent = '@' + userOf(r);
    if (isSelf(r)) chips.append(h('span', { className: 'chip you', textContent: 'You \u00b7 disabled' }));
    if (done.length) chips.append(h('span', { className: 'chip', textContent: 'Reported: ' + [...new Set(done)].sort().map(q => 'Q' + q).join(', ') }));
    qBtns.forEach((b, i) => {
      const c = cellOfRow(r, i + 1);
      b.dataset.has = c ? '1' : '';
      b.querySelector('.qt').textContent = timeOf(c) || '\u2014';
      b.classList.toggle('done', done.includes(i + 1));
    });
    updateBtns();
  };
  rowIn.addEventListener('input', refreshLabel);

  let busy = false;
  const updateBtns = () => {
    const off = busy || isSelf(getRows()[+rowIn.value - 1]);
    qBtns.forEach(b => { b.disabled = off || !b.dataset.has; });
    allBtn.disabled = off || !qBtns.some(b => b.dataset.has);
  };
  const setBusy = b => { busy = b; updateBtns(); };

  const run = async q => {
    if (busy) return;
    setBusy(true);
    const row = +rowIn.value;
    setStatus('run', 'Running row ' + row + ' Q' + q + '...');
    try {
      const res = await report({ row, q, reason: reasonSel.value, note: noteIn.value.trim(), submit: autoSub.checked });
      if (res === 'submitted') {
        const user = getRows()[row - 1]?.querySelector('a[href^="/u/"]')?.getAttribute('href') || '';
        addLog({ path: location.pathname, user, q, reason: reasonSel.value, t: Date.now() });
        setStatus('ok', '\u2713 Reported Q' + q + ' (' + reasonSel.value + ') for row ' + row);
      } else setStatus('run', 'Row ' + row + ' Q' + q + ': ' + res);
    } catch (e) {
      setStatus('err', 'Error: ' + e.message);
    }
    refreshLabel();
    setBusy(false);
  };

  const runAll = async () => {
    if (busy) return;
    const row = +rowIn.value;
    const r = getRows()[row - 1];
    if (!r || isSelf(r)) return;
    if (!autoSub.checked) { setStatus('err', 'Turn on auto-submit to use "Report all".'); return; }
    const qs = [1, 2, 3, 4].filter(q => cellOfRow(r, q));
    if (!qs.length) { setStatus('err', 'Row ' + row + ' has no submissions.'); return; }
    const user = userOf(r);
    if (!confirm('Report ' + qs.map(q => 'Q' + q).join(', ') + ' of ' + r.innerText.split('\n')[0] + ' (' + user + ') for "' + reasonSel.value + '"?')) return;
    setBusy(true);
    const done = [];
    try {
      for (const q of qs) {
        setStatus('run', 'Running Q' + q + ' (' + (done.length + 1) + '/' + qs.length + ')...');
        const res = await report({ row, q, reason: reasonSel.value, note: noteIn.value.trim(), submit: true });
        if (res === 'submitted') { addLog({ path: location.pathname, user: '/u/' + user + '/', q, reason: reasonSel.value, t: Date.now() }); done.push('Q' + q); }
        await sleep(1500);
      }
      setStatus('ok', '\u2713 Reported ' + done.join(', ') + ' for row ' + row);
    } catch (e) {
      setStatus('err', 'Error: ' + e.message + (done.length ? ' (done: ' + done.join(', ') + ')' : ''));
    }
    refreshLabel();
    setBusy(false);
  };

  const qBtns = [1, 2, 3, 4].map(q => h('button', { className: 'btn q', onclick: () => run(q) },
    h('span', { className: 'qn', textContent: 'Q' + q }), h('span', { className: 'qt', textContent: '\u2014' })));
  const allBtn = h('button', { className: 'btn danger', textContent: 'Report all solved questions', onclick: runAll });

  const step = d => {
    const rows = getRows();
    let n = Math.max(1, +rowIn.value + d);
    while (rows[n - 1] && isSelf(rows[n - 1]) && n + d >= 1 && n + d <= rows.length) n += d;
    rowIn.value = n;
    refreshLabel();
  };
  const nav = h('div', { className: 'nav' },
    h('button', { className: 'btn', onclick: () => step(-1) }, svg(ICON.left), 'Prev'),
    h('div', { className: 'numwrap' }, rowIn, totalEl),
    h('button', { className: 'btn', onclick: () => step(1) }, 'Skip', svg(ICON.right)));

  const body = h('div', { className: 'bd' },
    nav, who,
    h('div', {}, h('div', { className: 'lbl', textContent: 'Report question' }), h('div', { className: 'qs' }, ...qBtns), allBtn),
    h('div', {}, h('div', { className: 'lbl', textContent: 'Reason' }), reasonSel),
    h('div', {}, h('div', { className: 'lbl' }, h('span', { textContent: 'Note to reviewers' }), resetNote), noteIn),
    h('label', { className: 'switch' }, h('span', { textContent: 'Auto-submit after click' }), autoSub, h('span', { className: 'track' })),
    status);

  // ----- window chrome: drag / minimise / close / reopen -----
  const stKey = 'lcrh_ui';
  const loadUI = () => { try { return JSON.parse(localStorage.getItem(stKey) || '{}'); } catch { return {}; } };
  const ui = loadUI(); // { state: 'open'|'min'|'closed', left, top }
  const saveUI = () => { try { localStorage.setItem(stKey, JSON.stringify(ui)); } catch {} };

  const minBtn = h('button', { className: 'ib', title: 'Minimise', onclick: () => setState(ui.state === 'min' ? 'open' : 'min') }, svg(ICON.minus));
  const closeBtn = h('button', { className: 'ib', title: 'Close (Alt+R to reopen)', onclick: () => setState('closed') }, svg(ICON.x));
  const logo = h('div', { className: 'logo' }, svg(ICON.flag, 13));
  const header = h('div', { className: 'hd' },
    logo,
    h('div', { className: 'title', textContent: 'Report Helper' }), minBtn, closeBtn);
  const panel = h('div', { className: 'panel' }, header, body);
  const launcher = h('button', { className: 'launcher', title: 'Open Report Helper (Alt+R)', onclick: () => setState('open') }, svg(ICON.flag, 18));

  // extension icon: bridge.js (isolated world) publishes its URL on <html data-lcrh-icon>
  const setIcon = () => {
    const url = document.documentElement.dataset.lcrhIcon;
    if (!url) return;
    [logo, launcher].forEach(el => { el.classList.add('img'); el.replaceChildren(h('img', { src: url, alt: '' })); });
  };
  setIcon();
  addEventListener('lcrh-icon', setIcon);

  const setState = st => {
    ui.state = st;
    panel.classList.toggle('hidden', st === 'closed');
    panel.classList.toggle('min', st === 'min');
    launcher.classList.toggle('hidden', st !== 'closed');
    body.classList.toggle('hidden', st !== 'open');
    minBtn.title = st === 'min' ? 'Restore' : 'Minimise';
    minBtn.replaceChildren(svg(st === 'min' ? ICON.plus : ICON.minus));
    if (st === 'open') { refreshLabel(); sig = ''; resync(); }
    saveUI();
  };

  const place = (left, top) => {
    const w = panel.offsetWidth, hh = panel.offsetHeight;
    left = Math.min(Math.max(0, left), Math.max(0, innerWidth - w));
    top = Math.min(Math.max(0, top), Math.max(0, innerHeight - hh));
    Object.assign(panel.style, { left: left + 'px', top: top + 'px', bottom: 'auto' });
    ui.left = left; ui.top = top;
  };

  let drag = null;
  header.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    header.setPointerCapture(e.pointerId);
  });
  header.addEventListener('pointermove', e => { if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy); });
  header.addEventListener('pointerup', () => { if (drag) { drag = null; saveUI(); } });
  addEventListener('resize', () => { if (ui.top != null) place(ui.left, ui.top); });

  // toggle from keyboard, or from the toolbar icon (via bridge.js)
  const toggleAll = () => setState(ui.state === 'closed' ? 'open' : 'closed');
  addEventListener('keydown', e => { if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r') { e.preventDefault(); toggleAll(); } });
  addEventListener('lcrh-toggle', toggleAll);

  // re-sync when the page changes (pagination / region switch / late loading)
  let sig = '', timer = null;
  const firstFree = rows => { let n = 1; while (rows[n - 1] && isSelf(rows[n - 1]) && n < rows.length) n++; return n; };
  const resync = () => {
    if (busy || ui.state !== 'open') return;
    const rows = getRows();
    const s2 = location.href + '|' + rows.length + '|' + userOf(rows[0]);
    if (s2 !== sig) {
      if (sig) rowIn.value = firstFree(rows); // new page: start at the first row that isn't you
      sig = s2;
      refreshLabel();
    }
  };
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(resync, 400); })
    .observe(document.body, { childList: true, subtree: true });

  // ----- mount + follow LeetCode's light/dark theme -----
  const host = h('div', { id: 'lcrh-host' });
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet(); sheet.replaceSync(CSS);
  shadow.adoptedStyleSheets = [sheet];
  const root = h('div', { className: 'root' }, panel, launcher);
  shadow.append(root);
  const applyTheme = () => {
    const c = document.documentElement.classList;
    const dark = c.contains('dark') || (!c.contains('light') && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

  document.body.append(host);
  if (ui.left != null) place(ui.left, ui.top);
  setState(ui.state || 'open');
})();
