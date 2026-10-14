(function () {
  const AP = window.AP;
  const { C, LABEL, fmt } = AP;
  const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.getElementById('nb');
  const STREAMS = ['cash_interest', 'stock_pfof', 'margin_interest', 'market_data', 'options_pfof', 'stock_borrow', 'non_retail', 'fdic_sweep', 'crypto_wallet'];

  // ---------- calculations ----------
  dash.calc('stream_shares', {
    inputs: ['rev_monthly'],
    title: 'Stream share of revenue',
    description: 'Each stream’s share of total revenue over the 24 months (May 23 – Apr 25), all accounts.',
    fn: (rev_monthly) => {
      const keys = ['stock_pfof', 'cash_interest', 'margin_interest', 'market_data', 'stock_borrow', 'options_pfof', 'non_retail', 'crypto_wallet', 'fdic_sweep'];
      const total = rev_monthly.reduce((s, r) => s + Number(r.total), 0);
      return keys.map((k) => ({ stream: k, share_24m: Math.round((1000 * rev_monthly.reduce((s, r) => s + Number(r[k] || 0), 0)) / total) / 10 }));
    }
  });
  dash.calc('category_shares', {
    inputs: ['rev_monthly'],
    title: 'Revenue by how Alpaca earns it',
    description: 'Streams grouped into interest, trading, lending & other, and subscriptions, as a share of 24-month revenue.',
    fn: (rev_monthly) => {
      const groups = [
        ['Interest', ['cash_interest', 'margin_interest', 'fdic_sweep']],
        ['Trading', ['stock_pfof', 'options_pfof']],
        ['Lending & other', ['stock_borrow', 'non_retail', 'crypto_wallet']],
        ['Subscriptions', ['market_data']]
      ];
      const total = rev_monthly.reduce((s, r) => s + Number(r.total), 0);
      return groups.map(([category, keys]) => ({
        category,
        share: Math.round((1000 * rev_monthly.reduce((s, r) => s + keys.reduce((t, k) => t + Number(r[k] || 0), 0), 0)) / total) / 10
      }));
    }
  });
  dash.calc('mix_shift', {
    inputs: ['rev_monthly'],
    title: 'Revenue mix: 2023 vs last 6 months',
    description: 'Share of revenue in May–Dec 23 vs Nov 24 – Apr 25. Newer products = market data, options, FDIC sweep and crypto.',
    fn: (rev_monthly) => {
      const a = rev_monthly.filter((r) => r.month < '2024-01');
      const b = rev_monthly.filter((r) => r.month >= '2024-11');
      const share = (rs, keys) => (100 * rs.reduce((s, r) => s + keys.reduce((t, k) => t + Number(r[k] || 0), 0), 0)) / rs.reduce((s, r) => s + Number(r.total), 0);
      const groups = [
        ['Cash interest', ['cash_interest']],
        ['Stock PFOF', ['stock_pfof']],
        ['Newer products', ['market_data', 'options_pfof', 'fdic_sweep', 'crypto_wallet']],
        ['Everything else', ['margin_interest', 'stock_borrow', 'non_retail']]
      ];
      return groups.map(([group, keys]) => ({ group, share_2023: Math.round(10 * share(a, keys)) / 10, share_last_6m: Math.round(10 * share(b, keys)) / 10 }));
    }
  });

  const D = (id) => dash.data(id);
  const ok = (...ids) => ids.every((id) => D(id).status === 'ok');
  const rows = (id) => (D(id).status === 'ok' ? D(id).data : []);
  let FACTS = {};
  const fact = (id) => FACTS[id] || { display: '—', value: null };

  // ---------- toggles ----------
  const toggles = Array.from(root.querySelectorAll('.tg'));
  const parentTg = (tg) => tg.parentElement.closest('.tg');
  const inner = (tg) => tg.querySelector(':scope > .tg-b > .tg-in');
  const own = (tg, sel) => Array.from(inner(tg).querySelectorAll(sel)).filter((el) => el.closest('.tg') === tg);
  const titleOf = (tg) => {
    const t = tg.querySelector(':scope > .tg-h .tg-t');
    const b = t.querySelector(':scope > b');
    const txt = (b && t.firstElementChild === b ? b.textContent.replace(/:\s*$/, '') : t.textContent).trim();
    return txt.length > 56 ? txt.slice(0, 54) + '…' : txt;
  };
  let cur = null;

  function ancestors(tg) { const a = []; let p = tg; while (p) { a.unshift(p); p = parentTg(p); } return a; }

  function onOpen(tg, animate) {
    const ins = inner(tg);
    Array.from(ins.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
    tg.classList.remove('go', 'settled'); void tg.offsetWidth;
    if (animate && !RM) tg.classList.add('go');
    clearTimeout(tg._t); tg._t = setTimeout(() => tg.classList.contains('open') && tg.classList.add('settled'), 560);
    own(tg, '.steps5,.tiles,.kpis,.checks,.cons,.versions,.method,.levers,.funnel-w,.vs,.status-flow,.three,.vs2').forEach((el) => {
      Array.from(el.children).forEach((c, j) => c.style.setProperty('--j', j));
      el.classList.remove('go-st'); void el.offsetWidth; if (animate && !RM) el.classList.add('go-st');
    });
    own(tg, '[data-w]').forEach((el) => { el.style.transition = 'none'; el.style.width = '0'; });
    own(tg, '.own-bar i').forEach((el) => { el.style.transition = 'none'; el.style.width = '0'; });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      own(tg, '[data-w]').forEach((el) => { el.style.transition = ''; setW(el); });
      own(tg, '.own-bar i').forEach((el) => { el.style.transition = ''; el.style.width = '100%'; });
    }));
    setTimeout(() => {
      own(tg, '.chart[data-chart]').forEach((c) => drawChart(c, animate));
      if (animate) countUp(own(tg, '.f.big'));
    }, animate ? 120 : 0);
    own(tg, '.orbit').forEach((o) => { layoutOrbit(o); o.classList.remove('joined'); setTimeout(() => tg.classList.contains('open') && o.classList.add('joined'), animate && !RM ? 1500 : 0); });
    own(tg, '.lanes').forEach((l) => { layoutLanes(l); l.classList.remove('go'); void l.offsetWidth; if (animate && !RM) l.classList.add('go'); setTimeout(() => drawLanes(l, animate), 520); });
  }

  function setCurrent(tg, opts = {}) {
    if (window.__apHidePop) window.__apHidePop();
    const animate = opts.animate !== false;
    const want = new Set(tg ? ancestors(tg) : []);
    const opened = [];
    toggles.forEach((t) => {
      const was = t.classList.contains('open'), is = want.has(t);
      t.classList.toggle('open', is);
      t.querySelector(':scope > .tg-h').setAttribute('aria-expanded', is ? 'true' : 'false');
      if (!is) t.classList.remove('settled', 'go');
      if (is && !was) opened.push(t);
      t.classList.toggle('cur', t === tg);
    });
    opened.forEach((t) => onOpen(t, animate));
    cur = tg || null;
    updateChrome();
    if (tg) {
      dash.setLink(tg.id);
      if (opts.scroll !== false) {
        const go = () => tg.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
        setTimeout(go, 40); setTimeout(go, 540);
      }
    }
  }

  const order = toggles; // document order = depth-first
  const idx = () => (cur ? order.indexOf(cur) : -1);
  const next = () => { const i = idx(); if (i < order.length - 1) setCurrent(order[i + 1]); };
  const prev = () => { const i = idx(); if (i > 0) setCurrent(order[i - 1]); else if (i === 0) { setCurrent(null); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };

  root.addEventListener('click', (e) => {
    const h = e.target.closest('.tg-h');
    if (h) {
      const tg = h.parentElement;
      if (tg.classList.contains('open')) setCurrent(parentTg(tg), { scroll: false });
      else setCurrent(tg);
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) {
      e.preventDefault();
      const t = document.getElementById(o.dataset.open);
      if (t) { const from = cur; setCurrent(t); if (o.hasAttribute('data-jump') && from) { jumpFrom = from; showBack(); } }
      return;
    }
    const cb = e.target.closest('[data-crumb]');
    if (cb) { const id = cb.dataset.crumb; if (!id) { setCurrent(null); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); } else setCurrent(document.getElementById(id)); }
  });
  let jumpFrom = null;
  const backBtn = root.querySelector('.dock-back');
  function showBack() { backBtn.hidden = !jumpFrom; if (jumpFrom) backBtn.textContent = '↩ Back to ' + titleOf(jumpFrom); }
  backBtn.addEventListener('click', () => { const t = jumpFrom; jumpFrom = null; showBack(); if (t) setCurrent(t); });
  root.querySelector('.dock-prev').addEventListener('click', prev);
  root.querySelector('.dock-next').addEventListener('click', next);
  root.querySelector('.btn-collapse').addEventListener('click', () => { setCurrent(null); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (window.__apHidePop && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Escape', 'Home'].includes(e.key)) window.__apHidePop();
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Escape' || e.key === 'Home') { setCurrent(null); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    else if (e.key === 't' || e.key === 'T') dash.setParams({ theme: root.dataset.theme === 'dark' ? 'light' : 'dark' });
  });

  // chrome
  const crumbs = root.querySelector('.crumbs');
  const prog = root.querySelector('.nb-prog i');
  const dockNext = root.querySelector('.dock-next span'), dockCount = root.querySelector('.dock-count'), dockPrev = root.querySelector('.dock-prev'), dockNextBtn = root.querySelector('.dock-next');
  function updateChrome() {
    crumbs.replaceChildren();
    const home = document.createElement('button'); home.dataset.crumb = '';
    home.innerHTML = '<span class="ic">KN</span>'; home.appendChild(document.createTextNode('Alpaca Challenge'));
    crumbs.appendChild(home);
    (cur ? ancestors(cur) : []).forEach((t) => {
      const s = document.createElement('span'); s.className = 'sep'; s.textContent = '/'; crumbs.appendChild(s);
      const b = document.createElement('button'); b.dataset.crumb = t.id; b.textContent = titleOf(t); crumbs.appendChild(b);
    });
    const i = idx();
    prog.style.width = ((i + 1) / order.length) * 100 + '%';
    const n = order[i + 1];
    dockNext.textContent = n ? titleOf(n) : 'The end';
    dockNextBtn.disabled = !n;
    dockPrev.disabled = i < 0;
    dockCount.textContent = `${Math.max(0, i + 1)} / ${order.length}`;
  }

  // theme
  root.querySelectorAll('.seg [data-theme-set]').forEach((b) => b.addEventListener('click', () => dash.setParams({ theme: b.dataset.themeSet })));
  function applyTheme() {
    const t = (dash.params() || {}).theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = t;
    root.querySelectorAll('.seg [data-theme-set]').forEach((b) => b.classList.toggle('on', b.dataset.themeSet === t));
  }

  // ---------- facts ----------
  function setW(el) {
    const r = FACTS[el.dataset.w]; if (!r || r.value == null) return;
    const max = el.dataset.max ? Number(el.dataset.max) : 100;
    el.style.width = Math.min(100, (Number(r.value) / max) * 100) + '%';
  }
  function fillFacts() {
    const f = D('facts');
    if (f.status === 'ok') { FACTS = {}; f.data.forEach((r) => (FACTS[r.id] = r)); }
    root.querySelectorAll('[data-source="facts"][data-where]').forEach((el) => {
      if (el._anim) return;
      const r = FACTS[el.dataset.where.slice(3)];
      el.textContent = r ? r.display : '—';
    });
    root.querySelectorAll('[data-w]').forEach((el) => { if (!el.closest('.tg:not(.open)')) setW(el); });
    root.querySelectorAll('[data-source="ipo_quarters"][data-where]').forEach((el) => {
      const [k, v] = el.dataset.where.split('=');
      const r = rows('ipo_quarters').find((x) => String(x[k]) === v);
      el.textContent = r ? String(r[el.dataset.field]) : '—';
    });
  }
  function countUp(els) {
    if (RM) return;
    els.forEach((el) => {
      const r = FACTS[el.dataset.where.slice(3)]; if (!r) return;
      const m = String(r.display).match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/); if (!m) return;
      const target = parseFloat(m[2].replace(/,/g, '')); const dec = (m[2].split('.')[1] || '').length; const comma = m[2].includes(',');
      const t0 = performance.now(), dur = 1200, tok = {}; el._anim = tok;
      const fmtN = (v) => (comma ? Number(v.toFixed(dec)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec));
      const step = (t) => {
        if (el._anim !== tok) return;
        const p = Math.min(1, (t - t0 - 200) / dur); const e = p <= 0 ? 0 : 1 - Math.pow(1 - p, 3);
        if (p >= 1) { el.textContent = r.display; el._anim = null; return; }
        el.textContent = m[1] + fmtN(target * e) + m[3];
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- tables ----------
  const HI_SEG = new Set(['Legal entities', 'Argentina', 'Top 10 accounts', 'Next 288 (rest of top 1%)']);
  const td = (v, cls) => { const c = document.createElement('td'); c.textContent = v; if (cls) c.className = cls; return c; };
  const labelTd = (r) => { const c = document.createElement('td'); c.innerHTML = `<span class="swatch" style="background:${C[r.stream]}"></span>`; c.appendChild(document.createTextNode(r.label)); return c; };
  function fillTables() {
    const tS = document.getElementById('tbl-streams');
    if (ok('streams', 'stream_shares')) {
      const sh = Object.fromEntries(rows('stream_shares').map((r) => [r.stream, r]));
      const rs = rows('streams').slice().sort((a, b) => sh[b.stream].share_24m - sh[a.stream].share_24m);
      const max = d3.max(rs, (r) => sh[r.stream].share_24m);
      tS.tBodies[0].replaceChildren(...rs.map((r, i) => {
        const tr = document.createElement('tr'); tr.dataset.key = r.stream; if (i < 2) tr.className = 'top';
        const v = sh[r.stream].share_24m;
        const b = document.createElement('td'); b.innerHTML = '<div class="cellbar"><span></span><i></i></div>';
        b.querySelector('span').textContent = v.toFixed(1) + '%'; b.querySelector('i').style.width = `calc(${(v / max) * 100}% * .72)`;
        tr.append(labelTd(r), b, td(r.live_since, 'muted'));
        return tr;
      }));
    }
    if (ok('streams')) {
      const vs = rows('streams').slice().sort((a, b) => b.swing - a.swing);
      const tag = (r) => { const c = document.createElement('td'); const s = document.createElement('span'); s.className = 'tag ' + (r.swing >= 80 ? 'tag-hot' : r.swing >= 15 ? 'tag-warm' : 'tag-cool'); s.textContent = '±' + r.swing + '%'; c.appendChild(s); return c; };
      const t1 = document.getElementById('tbl-vol1');
      t1.tBodies[0].replaceChildren(...vs.map((r) => { const tr = document.createElement('tr'); tr.dataset.key = r.stream; tr.append(labelTd(r), td(r.top10_share + '%', 'num'), tag(r)); return tr; }));
      const t2 = document.getElementById('tbl-vol');
      t2.tBodies[0].replaceChildren(...vs.map((r) => { const tr = document.createElement('tr'); tr.dataset.key = r.stream; tr.append(labelTd(r), tag(r), td(r.top10_share + '%', 'num'), td(r.comment, 'muted')); return tr; }));
      const t3 = document.getElementById('tbl-corr');
      const cs = rows('streams').filter((r) => r.corr_with_stock_pfof != null).sort((a, b) => b.corr_with_stock_pfof - a.corr_with_stock_pfof);
      t3.tBodies[0].replaceChildren(...cs.map((r) => { const tr = document.createElement('tr'); tr.dataset.key = r.stream; tr.append(labelTd(r), td(r.corr_with_stock_pfof.toFixed(2), 'num'), td(r.corr_note || '', 'muted')); return tr; }));
    }
    if (ok('segments')) {
      root.querySelectorAll('table.tbl-seg').forEach((t) => {
        const rs = rows('segments').filter((r) => r.cut === t.dataset.cut);
        t.tBodies[0].replaceChildren(...rs.map((r) => {
          const tr = document.createElement('tr'); if (HI_SEG.has(r.segment)) tr.className = 'hi';
          tr.append(td(r.segment), td(fmt.int(r.accounts), 'num'), td(r.share_of_accounts + '%', 'num'), td(String(r.revenue_musd), 'num'), td(r.share_of_revenue + '%', 'num'));
          return tr;
        }));
      });
    }
  }

  // ---------- charts ----------
  const legendFor = (el, items) => {
    const lg = el.parentElement.querySelector(':scope > .legend'); if (!lg) return;
    lg.replaceChildren(...items.map(([c, t]) => { const s = document.createElement('span'); s.innerHTML = `<i style="background:${c}"></i>`; s.appendChild(document.createTextNode(t)); return s; }));
  };
  const segColor = (r, i) => (r.segment === 'Next 288 (rest of top 1%)' ? 'var(--s-margin)' : HI_SEG.has(r.segment) ? 'var(--acc)' : i % 2 ? 'var(--s-muted2)' : 'var(--s-muted)');
  function newLine(el, a, key, label, color) {
    if (!ok('factors_monthly')) return;
    const rs = rows('factors_monthly').filter((r) => r.month >= '2023-12');
    const max = d3.max(rs, (r) => Math.max(r.market_data || 0, r.options_pfof || 0, r.crypto_wallet || 0)) * 1.1;
    AP.lines(el, rs, [{ key, label, color, area: true }], { animate: a, h: 150, yMin: 0, yMax: max, ticks: 3, r: 56, l: 46, xDomain: ['2023-12', '2025-04'] });
  }
  const DRAW = {
    ipo: (el, a) => ok('ipo_quarters') && AP.columns(el, rows('ipo_quarters'), { x: (d) => d.quarter, y: (d) => d.subscribed_sar_m, h: 170, axis: false, maxBar: 90, animate: a, labels: (d) => 'SAR ' + d.subscribed_sar_m + 'M', color: (d, i) => (i ? 'var(--s-muted2)' : 'var(--acc)'), hiLabel: (d, i) => !i, tip: (d) => `<div class="t-h">${d.quarter}</div><div class="t-r"><span>Subscribed</span><b>SAR ${d.subscribed_sar_m}M</b></div>` }),
    category: (el, a) => {
      if (!ok('category_shares', 'stream_shares', 'streams')) return;
      const cats = rows('category_shares'); const sh = Object.fromEntries(rows('stream_shares').map((r) => [r.stream, r.share_24m]));
      const col = { Interest: ['var(--s-cash)', 'var(--bg)'], Trading: ['var(--acc)', 'var(--acc-ink)'], 'Lending & other': ['var(--s-borrow)', 'var(--acc-ink)'], Subscriptions: ['var(--s-md)', '#fff'] };
      el.replaceChildren();
      const bar = document.createElement('div'); bar.className = 'catbar';
      cats.forEach((c) => { const d = document.createElement('div'); d.style.background = col[c.category][0]; d.style.color = col[c.category][1]; d.textContent = Math.round(c.share) + '%'; d.dataset.w2 = c.share; bar.appendChild(d); });
      const rowsEl = document.createElement('div'); rowsEl.className = 'catrows';
      cats.forEach((c) => {
        const d = document.createElement('div');
        const st = rows('streams').filter((s) => s.category === c.category).sort((x, y) => sh[y.stream] - sh[x.stream]).map((s) => `${s.label} ${sh[s.stream].toFixed(1)}%`).join(' · ');
        d.innerHTML = `<b><span class="swatch" style="background:${col[c.category][0]}"></span></b><em></em><span class="cat-streams"></span>`;
        d.querySelector('b').appendChild(document.createTextNode(c.category)); d.querySelector('em').textContent = Math.round(c.share) + '%'; d.querySelector('.cat-streams').textContent = st;
        rowsEl.appendChild(d);
      });
      el.append(bar, rowsEl);
      const set = () => bar.querySelectorAll('div').forEach((d) => (d.style.width = d.dataset.w2 + '%'));
      if (a && !RM) requestAnimationFrame(() => requestAnimationFrame(set)); else { bar.querySelectorAll('div').forEach((d) => (d.style.transition = 'none')); set(); }
    },
    streambars: (el, a) => {
      if (!ok('streams', 'stream_shares')) return;
      const sh = Object.fromEntries(rows('stream_shares').map((r) => [r.stream, r.share_24m]));
      const rs = rows('streams').map((r) => ({ ...r, share: sh[r.stream] })).sort((x, y) => y.share - x.share);
      AP.hbars(el, rs, { animate: a, l: 130, rowH: 34, label: (d) => d.label, value: (d) => d.share, text: (d) => d.share.toFixed(1) + '%', color: (d, i) => (i < 2 ? 'var(--acc)' : 'var(--s-muted2)'), tip: (d) => `<div class="t-h">${d.label}</div><div class="t-r"><span>Share of 24-month revenue</span><b>${d.share.toFixed(1)}%</b></div>` });
    },
    area: (el, a) => { if (!ok('rev_monthly')) return; AP.stackArea(el, rows('rev_monthly'), STREAMS, { animate: a, totalKey: 'total', h: 300 }); legendFor(el, STREAMS.map((k) => [C[k], LABEL[k]])); },
    ribbons: (el, a) => {
      if (!ok('segments')) return;
      let rs = rows('segments').filter((r) => r.cut === el.dataset.cut);
      if (el.dataset.cut !== 'volume') rs = rs.sort((x, y) => x.share_of_accounts - y.share_of_accounts);
      AP.ribbons(el, rs, { animate: a, color: segColor, hi: (r) => HI_SEG.has(r.segment) });
    },
    trend1: (el, a) => {
      if (!ok('rev_groups')) return;
      const keys = ['everyone_else', 'cayman_entity', 'spanish_accounts', 'argentina'];
      const colors = { everyone_else: 'var(--s-muted2)', argentina: 'var(--acc)', cayman_entity: 'var(--s-opt)', spanish_accounts: 'var(--s-margin)' };
      const labels = { everyone_else: 'Everyone else', argentina: 'Argentina', cayman_entity: 'Cayman legal entity', spanish_accounts: '4 Spanish accounts' };
      AP.stackArea(el, rows('rev_groups'), keys, { animate: a, colors, labels, totalKey: 'all_accounts', band: { range: ['2024-06', '2024-09'], label: fact('jump_q').display + ' a month' }, h: 300 });
      legendFor(el, keys.slice().reverse().map((k) => [colors[k], labels[k]]));
    },
    mix: (el, a) => ok('mix_shift') && AP.slope(el, rows('mix_shift'), { animate: a, h: 300, color: (r) => ({ 'Cash interest': 'var(--s-cash)', 'Stock PFOF': 'var(--acc)', 'Newer products': 'var(--s-md)', 'Everything else': 'var(--s-muted2)' }[r.group]), hi: (r) => r.group === 'Stock PFOF' || r.group === 'Newer products', nudge: { 'Everything else': [0, -9], 'Newer products': [0, 9] } }),
    signups: (el, a) => {
      if (!ok('signups')) return;
      const rs = rows('signups');
      const r = AP.columns(el, rs, { x: (d) => d.month, y: (d) => d.signups, h: 230, yFmt: d3.format(','), pad: .2, stagger: 35, animate: a, color: (d) => (d.month >= '2025-01' ? 'var(--acc)' : d.month < '2024-01' ? 'var(--fg2)' : 'var(--s-muted2)'), xFmt: (d) => fmt.mFmt(fmt.parseM(d)), tickValues: (dom) => dom.filter((d, i) => i % 5 === 1), tip: (d) => `<div class="t-h">${fmt.mFmt(fmt.parseM(d.month))}</div><div class="t-r"><span>New accounts</span><b>${fmt.int(d.signups)}</b></div>` });
      [[rs.filter((d) => d.month < '2024-01'), fact('signups_23')], [rs.filter((d) => d.month >= '2025-01'), fact('signups_25')]].forEach(([seg, fv]) => {
        if (!seg.length || fv.value == null) return;
        const x0 = r.x(seg[0].month), x1 = r.x(seg[seg.length - 1].month) + r.x.bandwidth(), yy = r.y(fv.value);
        r.f.g.append('line').attr('class', 'ref').attr('x1', x0).attr('x2', x1).attr('y1', yy).attr('y2', yy);
        r.f.g.append('text').attr('class', 'ann ann-hi').attr('x', (x0 + x1) / 2).attr('y', yy - 8).attr('text-anchor', 'middle').text(fv.display + '/mo');
      });
    },
    cash: (el, a) => {
      if (!ok('factors_monthly')) return;
      const colors = { cash_interest_excl_cayman: 'var(--s-muted2)', cash_interest_cayman: 'var(--acc)' };
      const labels = { cash_interest_excl_cayman: 'Everyone else', cash_interest_cayman: 'One Cayman legal entity' };
      AP.stackCols(el, rows('factors_monthly'), ['cash_interest_excl_cayman', 'cash_interest_cayman'], { animate: a, colors, labels, h: 270 });
      legendFor(el, [[colors.cash_interest_cayman, labels.cash_interest_cayman], [colors.cash_interest_excl_cayman, labels.cash_interest_excl_cayman]]);
    },
    pfof: (el, a) => ok('factors_monthly') && AP.lines(el, rows('factors_monthly'), [{ key: 'us_stock_pfof_individuals', label: 'US stock PFOF', color: 'var(--acc)', labelColor: 'var(--acc-text)', area: true }], { animate: a, h: 260 }),
    borrowers: (el, a) => ok('factors_monthly') && AP.lines(el, rows('factors_monthly'), [{ key: 'margin_borrowers', label: 'Borrowers', color: 'var(--s-margin)', area: true, fmt: fmt.int }], { animate: a, h: 220, yFmt: d3.format(','), r: 50 }),
    margin10: (el, a) => ok('factors_monthly') && AP.lines(el, rows('factors_monthly'), [{ key: 'margin_outside_top10', label: 'Margin outside top 10', color: 'var(--s-margin)', area: true }], { animate: a, h: 220, r: 50 }),
    'new-md': (el, a) => newLine(el, a, 'market_data', 'Market data', 'var(--s-md)'),
    'new-opt': (el, a) => newLine(el, a, 'options_pfof', 'Options PFOF', 'var(--s-opt)'),
    'new-crypto': (el, a) => newLine(el, a, 'crypto_wallet', 'Crypto wallet', 'var(--s-crypto)'),
    scatter: (el, a) => {
      if (!ok('streams', 'stream_shares')) return;
      const sh = Object.fromEntries(rows('stream_shares').map((r) => [r.stream, r.share_24m]));
      AP.scatter(el, rows('streams').map((r) => ({ ...r, size: sh[r.stream] })), { animate: a, h: 300, dy: { options_pfof: 12, stock_borrow: -8, cash_interest: -6, margin_interest: 12, crypto_wallet: 12, non_retail: -10 }, left: ['stock_pfof'] });
    },
    corr: (el, a) => {
      if (!ok('streams')) return;
      const rs = rows('streams').filter((r) => r.corr_with_stock_pfof != null).sort((x, y) => y.corr_with_stock_pfof - x.corr_with_stock_pfof);
      AP.hbars(el, rs, { animate: a, max: 1, l: 120, rowH: 44, label: (d) => d.label, value: (d) => d.corr_with_stock_pfof, text: (d) => d.corr_with_stock_pfof.toFixed(2), color: (d) => (d.stream === 'market_data' ? 'var(--s-muted2)' : C[d.stream]), tip: (d) => `<div class="t-h">${d.label} vs stock PFOF</div><div class="t-r"><span>Correlation</span><b>${d.corr_with_stock_pfof.toFixed(2)}</b></div>` });
    },
    ladder: (el, a) => ok('ladder') && AP.columns(el, rows('ladder'), { x: (d) => d.products, y: (d) => d.revenue_per_account_month, h: 260, b: 46, maxBar: 74, animate: a, stagger: 140, yFmt: (v) => '$' + v, labels: (d) => '$' + d.revenue_per_account_month, hiLabel: (d, i) => i === 4, color: (d, i) => (i === 4 ? 'var(--acc)' : `color-mix(in srgb, var(--acc) ${18 + i * 16}%, var(--s-muted))`), xFmt: (d) => (d === '1' ? '1 product' : d + ' products'), sub: (d) => fmt.int(d.accounts) + ' accounts', tip: (d) => `<div class="t-h">${d.products} product${d.products === '1' ? '' : 's'}</div><div class="t-r"><span>Accounts</span><b>${fmt.int(d.accounts)}</b></div><div class="t-r"><span>Revenue / account / month</span><b>$${d.revenue_per_account_month}</b></div>` }),
    md: (el, a) => {
      if (!ok('md_retention')) return;
      AP.lines(el, rows('md_retention'), [
        { key: 'retention_trade', label: 'Subscribers who trade', color: 'var(--acc)', labelColor: 'var(--acc-text)', fmt: (v) => v.toFixed(1) + '%', dy: -6 },
        { key: 'retention_data_only', label: 'Data-only', color: 'var(--fg2)', fmt: (v) => v.toFixed(1) + '%', width: 2, dy: 6 }
      ], { animate: a, h: 250, yMin: 75, yMax: 100, yFmt: (v) => v + '%', r: 60 });
      legendFor(el, [['var(--acc)', 'Subscribers who trade'], ['var(--fg2)', 'Data-only']]);
    },
    levers: (el, a) => ok('levers') && AP.waterfall(el, rows('levers'), { animate: a, h: 220 })
  };
  function drawChart(el, animate) {
    const fn = DRAW[el.dataset.chart]; if (!fn) return;
    try { fn(el, animate); } catch (err) { console.error(err); }
  }
  const visible = (el) => !el.closest('.tg:not(.open)');
  function drawVisible() { root.querySelectorAll('.chart[data-chart]').forEach((c) => visible(c) && drawChart(c, false)); root.querySelectorAll('.lanes').forEach((l) => visible(l) && drawLanes(l, false)); }

  // cover sparkline
  let coverDrawn = false;
  function drawCover() {
    const el = document.getElementById('cover-chart'); if (!ok('rev_monthly')) return;
    el.replaceChildren();
    const rs = rows('rev_monthly').map((r) => ({ d: fmt.parseM(r.month), v: Number(r.total) }));
    const W = el.clientWidth || 900, H = el.clientHeight || 180;
    const x = d3.scaleUtc(d3.extent(rs, (r) => r.d), [0, W]);
    const y = d3.scaleLinear([0, d3.max(rs, (r) => r.v) * 1.08], [H, 10]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'none');
    const gid = 'cg' + Math.random().toString(36).slice(2, 7);
    const gr = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    gr.append('stop').attr('offset', 0).attr('stop-color', '#0A0A0B').attr('stop-opacity', .16);
    gr.append('stop').attr('offset', 1).attr('stop-color', '#0A0A0B').attr('stop-opacity', 0);
    svg.append('path').datum(rs).attr('fill', `url(#${gid})`).attr('d', d3.area().x((r) => x(r.d)).y0(H).y1((r) => y(r.v)));
    const p = svg.append('path').datum(rs).attr('fill', 'none').attr('stroke', '#0A0A0B').attr('stroke-width', 2.5).attr('stroke-linejoin', 'round').attr('vector-effect', 'non-scaling-stroke').attr('d', d3.line().x((r) => x(r.d)).y((r) => y(r.v)));
    if (!coverDrawn && !RM) { const L = p.node().getTotalLength(); p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(2200).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0); }
    coverDrawn = true;
  }

  // ---------- diagrams ----------
  function layoutOrbit(orbit) {
    const svg = orbit.querySelector('.orbit-links'); svg.replaceChildren();
    const nodes = Array.from(orbit.querySelectorAll('.node')); const n = nodes.length; const cx = 300, cy = 210, rx = 235, ry = 165;
    const NS = 'http://www.w3.org/2000/svg';
    const pts = nodes.map((nd, i) => { const ang = ((-90 + (360 / n) * i) * Math.PI) / 180; const p = [cx + rx * Math.cos(ang), cy + ry * Math.sin(ang)]; nd.style.left = (p[0] / 600) * 100 + '%'; nd.style.top = (p[1] / 420) * 100 + '%'; return p; });
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % n]; const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', p[0] + (q[0] - p[0]) * 0.3); l.setAttribute('y1', p[1] + (q[1] - p[1]) * 0.3); l.setAttribute('x2', p[0] + (q[0] - p[0]) * 0.7); l.setAttribute('y2', p[1] + (q[1] - p[1]) * 0.7); svg.appendChild(l);
      const s = document.createElementNS(NS, 'line'); s.setAttribute('class', 'spoke'); s.setAttribute('x1', cx); s.setAttribute('y1', cy); s.setAttribute('x2', p[0]); s.setAttribute('y2', p[1]); s.style.transitionDelay = i * 90 + 'ms'; svg.appendChild(s);
    });
  }
  const LANES = ['User', 'Awaed app', 'Operations', 'Tadawul'];
  function layoutLanes(box) {
    box.querySelectorAll('.jn').forEach((nd) => { const c = +nd.style.getPropertyValue('--c'), r = +nd.style.getPropertyValue('--r'); nd.style.gridColumn = String(c + 1); nd.style.gridRow = String(r); nd.dataset.lane = LANES[r - 1]; });
  }
  function drawLanes(box, animate) {
    const svg = box.querySelector('.lanes-svg'); svg.replaceChildren();
    if (root.classList.contains('narrow')) return;
    const B = box.getBoundingClientRect(); const NS = 'http://www.w3.org/2000/svg';
    const ns = Array.from(box.querySelectorAll('.jn')).sort((a, b) => +a.style.getPropertyValue('--k') - +b.style.getPropertyValue('--k'));
    ns.slice(0, -1).forEach((a, i) => {
      const b = ns[i + 1]; const A = a.getBoundingClientRect(), Bb = b.getBoundingClientRect();
      const x1 = A.right - B.left, y1 = A.top + A.height / 2 - B.top, x2 = Bb.left - B.left, y2 = Bb.top + Bb.height / 2 - B.top, mx = (x1 + x2) / 2, sg = Math.sign(y2 - y1);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', sg ? `M${x1},${y1} H${mx - 6} Q${mx},${y1} ${mx},${y1 + sg * 6} V${y2 - sg * 6} Q${mx},${y2} ${mx + 6},${y2} H${x2 - 3}` : `M${x1},${y1} H${x2 - 3}`);
      svg.appendChild(p);
      const h = document.createElementNS(NS, 'circle'); h.setAttribute('class', 'head'); h.setAttribute('cx', x2 - 2); h.setAttribute('cy', y2); h.setAttribute('r', 2.6); svg.appendChild(h);
      if (animate && !RM) {
        const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; h.style.opacity = 0;
        const d = i * 160; p.style.transition = `stroke-dashoffset .45s ease ${d}ms`; h.style.transition = `opacity .2s ease ${d + 400}ms`;
        requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = 0; h.style.opacity = 1; }));
      }
    });
  }

  // ---------- recommendation process popovers ----------
  const pop = document.getElementById('rec-pop');
  let popKind = null, popTimer = null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function renderPop(kind) {
    const rs = rows('rec_process');
    pop.replaceChildren();
    if (!rs.length) return;
    const head = el('div', 'pop-h');
    if (kind === 'listed' || kind === 'prioritized') {
      const items = rs.filter((r) => r.step === 'listed');
      const groups = [...new Set(items.map((r) => r.group))];
      const nPri = items.filter((r) => r.prioritized).length;
      head.append(el('b', null, kind === 'listed' ? 'Listing identified opportunities' : 'Prioritizing them'), el('span', null, kind === 'listed' ? `${items.length} opportunities from the whole exercise, in 3 tiers` : `${nPri} of ${items.length} made the cut (highlighted)`));
      const cols = el('div', 'pop-cols');
      groups.forEach((g) => {
        const col = el('div', 'pop-col'); col.append(el('h5', null, g));
        const ol = el('ol');
        items.filter((r) => r.group === g).sort((a, b) => a.order - b.order).forEach((r) => {
          const li = el('li', kind === 'prioritized' ? (r.prioritized ? 'pri' : 'dim') : null); li.append(el('span', null, r.title)); ol.append(li);
        });
        col.append(ol); cols.append(col);
      });
      pop.append(head, cols);
    } else if (kind === 'drafted') {
      const items = rs.filter((r) => r.step === 'drafted').sort((a, b) => a.order - b.order);
      head.append(el('b', null, 'Drafting top 5 opportunities'), el('span', null, 'Each with its opportunity and expected impact'));
      const cards = el('div', 'pop-cards');
      items.forEach((r) => {
        const c = el('div', 'pop-card'); c.append(el('b', null, r.title));
        String(r.detail).split('\n').forEach((line) => {
          const m = line.match(/^(Opportunity|Impact):\s*(.*)$/);
          const p = el('div'); if (m) { p.append(el('em', null, m[1] + ': '), document.createTextNode(m[2])); } else p.textContent = line;
          c.append(p);
        });
        cards.append(c);
      });
      pop.append(head, cards);
    } else {
      const items = rs.filter((r) => r.step === 'focused').sort((a, b) => a.order - b.order);
      head.append(el('b', null, 'Narrowing to 3'), el('span', null, 'From 5 drafted opportunities to 3 recommendations'));
      const ul = el('ul', 'pop-list');
      items.forEach((r) => { const li = el('li'); li.append(el('b', null, r.title), document.createTextNode(r.detail)); ul.append(li); });
      pop.append(head, ul);
    }
  }
  // The card lives at the page root so no section can paint over it or restyle it.
  root.appendChild(pop);
  function placePop(row) {
    // Anchor under the whole funnel so every step stays visible and hoverable.
    const fun = row.closest('.funnel-w') || row;
    const steps = fun.querySelectorAll('.nw');
    const last = steps.length ? steps[steps.length - 1] : row;
    const fr = fun.getBoundingClientRect(), lr = last.getBoundingClientRect(), rt = root.getBoundingClientRect();
    const W = Math.max(280, Math.min(1080, root.clientWidth - 32));
    let left = fr.left - rt.left + fr.width / 2 - W / 2;
    left = Math.max(16, Math.min(left, root.clientWidth - W - 16));
    pop.style.width = W + 'px';
    pop.style.left = left + 'px';
    // Open below the funnel, or above it when there is clearly more room there.
    const below = window.innerHeight - lr.bottom - 12 - 96; // keep clear of the bottom dock
    const above = fr.top - 12 - 64; // keep clear of the top bar
    pop.style.maxHeight = 'none';
    const natural = pop.scrollHeight + 2;
    const up = below < Math.min(natural, 420) && above > below;
    const h = Math.max(240, Math.min(natural, up ? above : below));
    pop.style.maxHeight = h + 'px';
    pop.style.top = (up ? fr.top - rt.top - 12 - Math.min(natural, h) : lr.bottom - rt.top + 12) + 'px';
    pop.dataset.side = up ? 'up' : 'down';
  }
  function showPop(row) {
    clearTimeout(popTimer);
    if (row.closest('.tg:not(.open)')) return;
    const kind = row.dataset.pop;
    root.querySelectorAll('.nw[data-pop]').forEach((n) => n.classList.toggle('on', n === row));
    if (kind !== popKind) { renderPop(kind); popKind = kind; pop.scrollTop = 0; }
    pop.hidden = false;
    placePop(row);
    requestAnimationFrame(() => pop.classList.add('on'));
  }
  function hidePop(now) {
    clearTimeout(popTimer);
    const close = () => {
      pop.classList.remove('on');
      setTimeout(() => { if (!pop.classList.contains('on')) pop.hidden = true; }, 260);
      root.querySelectorAll('.nw[data-pop]').forEach((n) => n.classList.remove('on'));
      const f = document.activeElement; if (f && f.matches && f.matches('.nw[data-pop]')) f.blur();
    };
    if (now) close(); else popTimer = setTimeout(close, 180);
  }
  window.__apHidePop = () => hidePop(true);
  root.querySelectorAll('.nw[data-pop]').forEach((row) => {
    row.addEventListener('mouseenter', () => showPop(row));
    row.addEventListener('mouseleave', () => hidePop());
    row.addEventListener('focus', () => { if (row.matches(':focus-visible')) showPop(row); });
    row.addEventListener('blur', () => hidePop());
    row.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.contains('on') && row.classList.contains('on') ? hidePop(true) : showPop(row); });
  });
  pop.addEventListener('mouseenter', () => clearTimeout(popTimer));
  pop.addEventListener('mouseleave', () => hidePop());
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => { if (pop.classList.contains('on')) hidePop(true); });
  window.addEventListener('resize', () => { if (pop.classList.contains('on')) hidePop(true); });

  // ---------- data loop ----------
  dash.onData(() => {
    applyTheme();
    root.classList.toggle('narrow', root.clientWidth < 760);
    fillFacts();
    fillTables();
    drawCover();
    drawVisible();
    if (popKind) renderPop(popKind);
  });

  // start
  applyTheme();
  root.classList.toggle('narrow', root.clientWidth < 760);
  const start = document.getElementById((location.hash || '').slice(1));
  if (start && start.classList.contains('tg')) setCurrent(start, { animate: false }); else updateChrome();
})();
