(function () {
  const AP = (window.AP = window.AP || {});
  const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = {
    stock_pfof: 'var(--s-stock)', cash_interest: 'var(--s-cash)', margin_interest: 'var(--s-margin)',
    market_data: 'var(--s-md)', options_pfof: 'var(--s-opt)', stock_borrow: 'var(--s-borrow)',
    non_retail: 'var(--s-nonretail)', crypto_wallet: 'var(--s-crypto)', fdic_sweep: 'var(--s-fdic)',
    acc: 'var(--acc)', muted: 'var(--s-muted)', muted2: 'var(--s-muted2)', fg: 'var(--fg)', fg2: 'var(--fg2)', bad: 'var(--bad)', good: 'var(--good)'
  };
  AP.C = C;
  const LABEL = {
    stock_pfof: 'Stock PFOF', cash_interest: 'Cash interest', margin_interest: 'Margin interest', market_data: 'Market data',
    options_pfof: 'Options PFOF', stock_borrow: 'Stock borrow', non_retail: 'Non-retail', crypto_wallet: 'Crypto wallet', fdic_sweep: 'FDIC sweep'
  };
  AP.LABEL = LABEL;

  // ---------- formats ----------
  const money = (v) => {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e4) return s + '$' + Math.round(a / 1e3) + 'K';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return s + '$' + Math.round(a);
  };
  const moneyAxis = (v) => (v === 0 ? '$0' : money(v));
  const mFmt = d3.utcFormat('%b %y');
  const parseM = (m) => new Date(m + '-01T00:00:00Z');
  AP.fmt = { money, mFmt, parseM, int: d3.format(','), pct0: (v) => Math.round(v) + '%', pct1: (v) => (Math.round(v * 10) / 10).toFixed(1) + '%' };

  const dur = (ms, animate) => (animate && !RM ? ms : 0);
  AP.dur = dur;

  function frame(el, height, m) {
    el.querySelectorAll('svg,.tip').forEach((n) => n.remove());
    const W = Math.max(260, el.clientWidth || 600);
    const H = height;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const tip = d3.select(el).append('div').attr('class', 'tip');
    return { svg, W, H, iw: W - m.l - m.r, ih: H - m.t - m.b, g: svg.append('g').attr('transform', `translate(${m.l},${m.t})`), tip };
  }
  function tipShow(el, tip, x, y, html) {
    tip.html(html).classed('on', true);
    const tw = tip.node().offsetWidth, th = tip.node().offsetHeight, W = el.clientWidth;
    let left = x + 14; if (left + tw > W) left = x - tw - 14; if (left < 0) left = 0;
    let top = y - th / 2; if (top < -10) top = -10;
    tip.style('left', left + 'px').style('top', top + 'px');
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sw = (c) => `<i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${c}"></i>`;
  function yAxis(g, y, iw, fmt, ticks = 4) {
    g.append('g').attr('class', 'gridl').call(d3.axisLeft(y).ticks(ticks).tickSize(-iw).tickFormat(''));
    const a = g.append('g').attr('class', 'ax ax-y').call(d3.axisLeft(y).ticks(ticks).tickSize(0).tickPadding(8).tickFormat(fmt));
    a.attr('font-size', null).attr('font-family', null); a.select('.domain').remove();
  }
  function xAxisTime(g, x, ih, n = 6) {
    const a = g.append('g').attr('class', 'ax').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(n).tickSize(0).tickPadding(10).tickFormat(mFmt));
    a.attr('font-size', null).attr('font-family', null);
  }
  function revealClip(f, id, animate, ms = 1600) {
    const cp = f.svg.append('defs').append('clipPath').attr('id', id).append('rect').attr('x', -10).attr('y', -20).attr('height', f.H + 40).attr('width', animate && !RM ? 0 : f.W + 20);
    if (animate && !RM) cp.transition().duration(ms).ease(d3.easeCubicInOut).attr('width', f.W + 20);
    return `url(#${id})`;
  }
  let uid = 0;

  // ---------- stacked area over months ----------
  AP.stackArea = function (el, rows, keys, opt = {}) {
    const m = { t: 12, r: opt.r ?? 16, b: 28, l: 56 };
    const f = frame(el, opt.h || 300, m);
    const data = rows.map((r) => ({ ...r, _d: parseM(r.month) }));
    const st = d3.stack().keys(keys).value((d, k) => d[k] || 0).offset(d3.stackOffsetDiverging)(data);
    const x = d3.scaleUtc(d3.extent(data, (d) => d._d), [0, f.iw]);
    const ymax = d3.max(st, (s) => d3.max(s, (d) => d[1]));
    const ymin = Math.min(0, d3.min(st, (s) => d3.min(s, (d) => d[0])));
    const y = d3.scaleLinear([ymin, ymax * 1.06], [f.ih, 0]).nice();
    yAxis(f.g, y, f.iw, moneyAxis);
    xAxisTime(f.g, x, f.ih, f.iw < 420 ? 4 : 6);
    if (opt.band) {
      const [a, b] = opt.band.range.map(parseM);
      f.g.append('rect').attr('class', 'band').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', 0).attr('height', f.ih).attr('rx', 6);
      f.g.append('text').attr('class', 'ann ann-hi').attr('x', (x(a) + x(b)) / 2).attr('y', -2).attr('text-anchor', 'middle').text(opt.band.label);
    }
    const clip = revealClip(f, 'clip' + ++uid, opt.animate);
    const area = d3.area().x((d) => x(d.data._d)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveLinear);
    f.g.append('g').attr('clip-path', clip).selectAll('path').data(st).join('path')
      .attr('d', area).attr('style', (s) => `fill:${(opt.colors || C)[s.key]};fill-opacity:${opt.opacity?.[s.key] ?? .92}`)
      ;
    // hover
    const rule = f.g.append('line').attr('class', 'rule').attr('y1', 0).attr('y2', f.ih).style('opacity', 0);
    f.svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', f.iw).attr('height', f.ih).attr('fill', 'transparent')
      .on('mousemove', (ev) => {
        const [px] = d3.pointer(ev, f.g.node());
        const d0 = x.invert(px);
        const i = d3.leastIndex(data, (d) => Math.abs(d._d - d0));
        const d = data[i]; const xx = x(d._d);
        rule.attr('x1', xx).attr('x2', xx).style('opacity', 1);
        const lines = keys.slice().reverse().filter((k) => d[k]).map((k) => `<div class="t-r"><span>${sw((opt.colors || C)[k])}${esc((opt.labels || LABEL)[k] || k)}</span><b>${money(d[k])}</b></div>`).join('');
        const tot = opt.totalKey ? `<div class="t-r" style="margin-top:4px"><span>Total</span><b>${money(d[opt.totalKey])}</b></div>` : '';
        tipShow(el, f.tip, xx + m.l, y(ymax / 2) + m.t, `<div class="t-h">${mFmt(d._d)}</div>${lines}${tot}`);
      })
      .on('mouseleave', () => { rule.style('opacity', 0); f.tip.classed('on', false); });
    return { x, y, f };
  };

  // ---------- lines ----------
  AP.lines = function (el, rows, series, opt = {}) {
    const m = { t: 14, r: opt.r ?? 70, b: 28, l: opt.l ?? 52 };
    const f = frame(el, opt.h || 260, m);
    const data = rows.map((r) => ({ ...r, _d: parseM(r.month) }));
    const x = d3.scaleUtc(opt.xDomain ? opt.xDomain.map(parseM) : d3.extent(data, (d) => d._d), [0, f.iw]);
    const vals = series.flatMap((s) => data.map((d) => d[s.key]).filter((v) => v != null));
    const lo = opt.yMin ?? Math.min(0, d3.min(vals)); const hi = opt.yMax ?? d3.max(vals) * 1.08;
    const y = d3.scaleLinear([lo, hi], [f.ih, 0]).nice();
    yAxis(f.g, y, f.iw, opt.yFmt || moneyAxis, opt.ticks || 4);
    xAxisTime(f.g, x, f.ih, f.iw < 360 ? 3 : 5);
    series.forEach((s, si) => {
      const pts = data.filter((d) => d[s.key] != null);
      if (s.area) {
        const gid = 'g' + ++uid;
        const gr = f.svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
        [[0, .32], [.4, .14], [1, 0]].forEach(([o, op]) => gr.append('stop').attr('offset', o).attr('style', `stop-color:${s.color};stop-opacity:${op}`));
        const clip = revealClip(f, 'clip' + ++uid, opt.animate, 1500);
        f.g.append('path').datum(pts).attr('clip-path', clip).attr('fill', `url(#${gid})`)
          .attr('d', d3.area().x((d) => x(d._d)).y0(y(Math.max(lo, 0))).y1((d) => y(d[s.key])));
      }
      const p = f.g.append('path').datum(pts).attr('fill', 'none').attr('style', `stroke:${s.color}`).attr('stroke-width', s.width || 2.4)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.dash || null)
        .attr('d', d3.line().x((d) => x(d._d)).y((d) => y(d[s.key])));
      if (opt.animate && !RM && !s.dash) {
        const L = p.node().getTotalLength();
        p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().delay(si * 250).duration(1500).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
      }
      const last = pts[pts.length - 1];
      if (last && opt.endLabels !== false) {
        const t = f.g.append('text').attr('class', 'vlab').attr('x', x(last._d) + 8).attr('y', y(last[s.key]) + (s.dy || 0)).attr('dy', '.35em')
          .attr('style', `fill:${s.labelColor || s.color}`).text((s.fmt || money)(last[s.key]));
        if (s.name) f.g.append('text').attr('class', 'lbl').attr('x', x(last._d) + 8).attr('y', y(last[s.key]) + (s.dy || 0) + 15).attr('dy', '.35em').text(s.name);
        t.style('opacity', opt.animate && !RM ? 0 : 1).transition().delay(1400).duration(400).style('opacity', 1);
      }
      if (last) f.g.append('circle').attr('cx', x(last._d)).attr('cy', y(last[s.key])).attr('r', 3.5).attr('style', `fill:${s.color}`);
    });
    (opt.annotate || []).forEach((a) => {
      const d = parseM(a.month);
      f.g.append('line').attr('class', 'ref').attr('x1', x(d)).attr('x2', x(d)).attr('y1', 0).attr('y2', f.ih);
      f.g.append('text').attr('class', 'ann').attr('x', x(d) + 6).attr('y', 10).text(a.text);
    });
    const rule = f.g.append('line').attr('class', 'rule').attr('y1', 0).attr('y2', f.ih).style('opacity', 0);
    f.svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', f.iw).attr('height', f.ih).attr('fill', 'transparent')
      .on('mousemove', (ev) => {
        const [px] = d3.pointer(ev, f.g.node()); const d0 = x.invert(px);
        const i = d3.leastIndex(data, (d) => Math.abs(d._d - d0)); const d = data[i]; const xx = x(d._d);
        rule.attr('x1', xx).attr('x2', xx).style('opacity', 1);
        const ls = series.filter((s) => d[s.key] != null).map((s) => `<div class="t-r"><span>${series.length > 1 ? sw(s.color) : ''}${esc(s.label)}</span><b>${(s.fmt || money)(d[s.key])}</b></div>`).join('');
        tipShow(el, f.tip, xx + m.l, m.t + f.ih / 3, `<div class="t-h">${mFmt(d._d)}</div>${ls}`);
      })
      .on('mouseleave', () => { rule.style('opacity', 0); f.tip.classed('on', false); });
    return { x, y, f };
  };

  // ---------- columns ----------
  AP.columns = function (el, rows, opt) {
    const m = { t: 26, r: 8, b: opt.b ?? 30, l: opt.axis === false ? 8 : 52 };
    const f = frame(el, opt.h || 240, m);
    const x = d3.scaleBand(rows.map(opt.x), [0, f.iw]).padding(opt.pad ?? .28);
    const vals = rows.map(opt.y);
    const y = d3.scaleLinear([Math.min(0, d3.min(vals)), d3.max(vals) * 1.1], [f.ih, 0]).nice();
    if (opt.axis !== false) yAxis(f.g, y, f.iw, opt.yFmt || moneyAxis);
    const bw = Math.min(x.bandwidth(), opt.maxBar || 64);
    const off = (x.bandwidth() - bw) / 2;
    const color = (d, i) => (opt.color ? opt.color(d, i) : C.acc);
    const bars = f.g.selectAll('rect.bar').data(rows).join('rect').attr('class', 'bar')
      .attr('x', (d) => x(opt.x(d)) + off).attr('width', bw).attr('rx', Math.min(6, bw / 2))
      .attr('style', (d, i) => `fill:${color(d, i)}`)
      .attr('y', (d) => (opt.animate && !RM ? y(0) : y(Math.max(0, opt.y(d))))).attr('height', (d) => (opt.animate && !RM ? 0 : Math.abs(y(opt.y(d)) - y(0))));
    if (opt.animate && !RM) bars.transition().delay((d, i) => 200 + i * (opt.stagger ?? 60)).duration(900).ease(d3.easeCubicOut)
      .attr('y', (d) => y(Math.max(0, opt.y(d)))).attr('height', (d) => Math.abs(y(opt.y(d)) - y(0)));
    if (opt.labels) {
      f.g.selectAll('text.vlab').data(rows).join('text').attr('class', (d, i) => 'vlab' + (opt.hiLabel && opt.hiLabel(d, i) ? ' vlab-hi' : ''))
        .attr('x', (d) => x(opt.x(d)) + x.bandwidth() / 2).attr('y', (d) => y(Math.max(0, opt.y(d))) - 8).attr('text-anchor', 'middle')
        .text(opt.labels).style('opacity', opt.animate && !RM ? 0 : 1).transition().delay((d, i) => 700 + i * (opt.stagger ?? 60)).duration(400).style('opacity', 1);
    }
    const xa = f.g.append('g').attr('class', 'ax').attr('transform', `translate(0,${f.ih})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(10).tickFormat(opt.xFmt || ((d) => d)).tickValues(opt.tickValues ? opt.tickValues(x.domain()) : null));
    xa.attr('font-size', null).attr('font-family', null); xa.select('.domain').attr('stroke', 'var(--line2)');
    if (opt.sub) f.g.selectAll('text.sub').data(rows).join('text').attr('class', 'lbl').attr('x', (d) => x(opt.x(d)) + x.bandwidth() / 2).attr('y', f.ih + 28).attr('text-anchor', 'middle').text(opt.sub);
    bars.on('mousemove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tipShow(el, f.tip, px, py, opt.tip(d)); }).on('mouseleave', () => f.tip.classed('on', false));
    return { x, y, f };
  };

  // ---------- stacked columns (months) ----------
  AP.stackCols = function (el, rows, keys, opt) {
    const m = { t: 14, r: 8, b: 28, l: 56 };
    const f = frame(el, opt.h || 280, m);
    const x = d3.scaleBand(rows.map((r) => r.month), [0, f.iw]).padding(.22);
    const st = d3.stack().keys(keys).value((d, k) => d[k] || 0)(rows);
    const y = d3.scaleLinear([0, d3.max(st[st.length - 1], (d) => d[1]) * 1.08], [f.ih, 0]).nice();
    yAxis(f.g, y, f.iw, moneyAxis);
    const g = f.g.selectAll('g.s').data(st).join('g').attr('style', (s) => `fill:${opt.colors[s.key]}`);
    const r = g.selectAll('rect').data((s) => s.map((d) => ({ ...d, key: s.key }))).join('rect')
      .attr('x', (d) => x(d.data.month)).attr('width', x.bandwidth()).attr('rx', 2)
      .attr('y', (d) => (opt.animate && !RM ? f.ih : y(d[1]))).attr('height', (d) => (opt.animate && !RM ? 0 : y(d[0]) - y(d[1])));
    if (opt.animate && !RM) r.transition().delay((d, i) => 150 + i * 40).duration(700).ease(d3.easeCubicOut).attr('y', (d) => y(d[1])).attr('height', (d) => y(d[0]) - y(d[1]));
    const ticks = x.domain().filter((d, i) => i % (f.iw < 420 ? 6 : 3) === 0);
    const xa = f.g.append('g').attr('class', 'ax').attr('transform', `translate(0,${f.ih})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(10).tickFormat((d) => mFmt(parseM(d))));
    xa.attr('font-size', null).attr('font-family', null); xa.select('.domain').remove();
    r.on('mousemove', (ev, d) => {
      const [px, py] = d3.pointer(ev, el);
      const row = d.data; const ls = keys.slice().reverse().map((k) => `<div class="t-r"><span>${sw(opt.colors[k])}${esc(opt.labels[k])}</span><b>${money(row[k])}</b></div>`).join('');
      tipShow(el, f.tip, px, py, `<div class="t-h">${mFmt(parseM(row.month))}</div>${ls}`);
    }).on('mouseleave', () => f.tip.classed('on', false));
    return { x, y, f };
  };

  // ---------- horizontal bars ----------
  AP.hbars = function (el, rows, opt) {
    const m = { t: 6, r: 56, b: 6, l: opt.l || 130 };
    const rowH = opt.rowH || 40;
    const f = frame(el, rows.length * rowH + m.t + m.b, m);
    const y = d3.scaleBand(rows.map(opt.label), [0, f.ih]).padding(.32);
    const x = d3.scaleLinear([0, opt.max ?? d3.max(rows, opt.value)], [0, f.iw]);
    f.g.selectAll('rect.bg').data(rows).join('rect').attr('x', 0).attr('y', (d) => y(opt.label(d))).attr('width', f.iw).attr('height', y.bandwidth()).attr('rx', y.bandwidth() / 2).attr('style', 'fill:var(--panel2)');
    const b = f.g.selectAll('rect.v').data(rows).join('rect').attr('class', 'v').attr('x', 0).attr('y', (d) => y(opt.label(d))).attr('height', y.bandwidth()).attr('rx', y.bandwidth() / 2)
      .attr('style', (d, i) => `fill:${opt.color(d, i)}`).attr('width', (d) => (opt.animate && !RM ? 0 : x(opt.value(d))));
    if (opt.animate && !RM) b.transition().delay((d, i) => 200 + i * 110).duration(1000).ease(d3.easeCubicOut).attr('width', (d) => x(opt.value(d)));
    f.g.selectAll('text.n').data(rows).join('text').attr('class', 'lbl').attr('x', -12).attr('y', (d) => y(opt.label(d)) + y.bandwidth() / 2).attr('dy', '.35em').attr('text-anchor', 'end').style('fill', 'var(--fg2)').style('font-size', '13px').style('font-weight', 600).text(opt.label);
    f.g.selectAll('text.vlab').data(rows).join('text').attr('class', 'vlab').attr('x', (d) => x(opt.value(d)) + 10).attr('y', (d) => y(opt.label(d)) + y.bandwidth() / 2).attr('dy', '.35em').text(opt.text)
      .style('opacity', opt.animate && !RM ? 0 : 1).transition().delay((d, i) => 900 + i * 110).duration(400).style('opacity', 1);
    if (opt.tip) b.on('mousemove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tipShow(el, f.tip, px, py, opt.tip(d)); }).on('mouseleave', () => f.tip.classed('on', false));
    return f;
  };

  // ---------- concentration ribbons ----------
  AP.ribbons = function (el, rows, opt) {
    const m = { t: 30, r: 4, b: 30, l: 4 };
    const f = frame(el, opt.h || 230, m);
    const barH = 38, gap = f.ih - barH * 2;
    let ax = 0, rx = 0;
    const segs = rows.map((r, i) => {
      const a0 = ax, r0 = rx; ax += r.share_of_accounts; rx += r.share_of_revenue;
      return { r, i, a0, a1: ax, r0, r1: rx };
    });
    const x = d3.scaleLinear([0, 100], [0, f.iw]);
    const col = (s) => opt.color(s.r, s.i);
    const anim = opt.animate && !RM;
    const rib = f.g.selectAll('path.rib').data(segs).join('path').attr('class', 'rib')
      .attr('d', (s) => `M${x(s.a0)},${barH} L${x(s.a1)},${barH} C${x(s.a1)},${barH + gap / 2} ${x(s.r1)},${barH + gap / 2} ${x(s.r1)},${barH + gap} L${x(s.r0)},${barH + gap} C${x(s.r0)},${barH + gap / 2} ${x(s.a0)},${barH + gap / 2} ${x(s.a0)},${barH} Z`)
      .attr('style', (s) => `fill:${col(s)};fill-opacity:${opt.hi(s.r) ? .38 : .14}`).style('opacity', anim ? 0 : 1);
    if (anim) rib.transition().delay(900).duration(900).style('opacity', 1);
    const bar = (y0, k0, k1, delay) => f.g.selectAll(null).data(segs).join('rect').attr('y', y0).attr('height', barH).attr('rx', 4)
      .attr('style', (s) => `fill:${col(s)}`).attr('x', (s) => x(s[k0])).attr('width', (s) => (anim ? 0 : Math.max(1.5, x(s[k1]) - x(s[k0]))))
      .call((sel) => anim && sel.transition().delay((s, i) => delay + i * 120).duration(800).ease(d3.easeCubicOut).attr('width', (s) => Math.max(1.5, x(s[k1]) - x(s[k0]))));
    bar(0, 'a0', 'a1', 150); bar(barH + gap, 'r0', 'r1', 500);
    f.g.append('text').attr('class', 'lbl').attr('x', 0).attr('y', -10).style('font-weight', 700).style('letter-spacing', '.06em').text('SHARE OF ACCOUNTS');
    f.g.append('text').attr('class', 'lbl').attr('x', 0).attr('y', f.ih + 20).style('font-weight', 700).style('letter-spacing', '.06em').text('SHARE OF REVENUE');
    segs.filter((s) => opt.hi(s.r)).forEach((s) => {
      const cx = (x(s.r0) + x(s.r1)) / 2;
      f.g.append('text').attr('class', 'vlab').attr('x', cx).attr('y', barH + gap + barH / 2).attr('dy', '.35em').attr('text-anchor', 'middle').style('fill', 'var(--acc-ink)').style('font-size', '15px').style('font-weight', 800)
        .text(x(s.r1) - x(s.r0) > 46 ? s.r.share_of_revenue + '%' : '');
    });
    return f;
  };

  // ---------- slope chart ----------
  AP.slope = function (el, rows, opt) {
    const m = { t: 30, r: 150, b: 16, l: 150 };
    const f = frame(el, opt.h || 300, m);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.share_2023, r.share_last_6m)) * 1.08], [f.ih, 0]);
    const xL = 0, xR = f.iw;
    [['2023 average', xL, 'end'], ['Last 6 months', xR, 'start']].forEach(([t, x, a]) => f.g.append('text').attr('class', 'lbl').attr('x', x).attr('y', -14).attr('text-anchor', 'middle').style('font-weight', 700).text(t));
    f.g.append('line').attr('x1', xL).attr('x2', xL).attr('y1', 0).attr('y2', f.ih).attr('style', 'stroke:var(--line2)');
    f.g.append('line').attr('x1', xR).attr('x2', xR).attr('y1', 0).attr('y2', f.ih).attr('style', 'stroke:var(--line2)');
    const anim = opt.animate && !RM;
    rows.forEach((r, i) => {
      const c = opt.color(r), y0 = y(r.share_2023), y1 = y(r.share_last_6m), hi = opt.hi(r);
      const ln = f.g.append('line').attr('x1', xL).attr('y1', y0).attr('x2', anim ? xL : xR).attr('y2', anim ? y0 : y1).attr('style', `stroke:${c}`).attr('stroke-width', hi ? 3.2 : 2).attr('stroke-linecap', 'round');
      if (anim) ln.transition().delay(300 + i * 200).duration(1100).ease(d3.easeCubicInOut).attr('x2', xR).attr('y2', y1);
      f.g.append('circle').attr('cx', xL).attr('cy', y0).attr('r', 5).attr('style', `fill:${c}`);
      const c2 = f.g.append('circle').attr('cx', xR).attr('cy', y1).attr('r', 5).attr('style', `fill:${c}`).style('opacity', anim ? 0 : 1);
      if (anim) c2.transition().delay(1300 + i * 200).style('opacity', 1);
      const dy0 = opt.nudge?.[r.group]?.[0] || 0, dy1 = opt.nudge?.[r.group]?.[1] || 0;
      f.g.append('text').attr('class', 'vlab').attr('x', xL - 12).attr('y', y0 + dy0).attr('dy', '.35em').attr('text-anchor', 'end').text(`${r.group}  ${Math.round(r.share_2023)}%`).style('font-weight', hi ? 750 : 550);
      const t = f.g.append('text').attr('class', 'vlab').attr('x', xR + 12).attr('y', y1 + dy1).attr('dy', '.35em').text(`${Math.round(r.share_last_6m)}%  ${r.group}`).attr('style', `fill:${hi ? 'var(--acc-text)' : 'var(--fg)'}`).style('font-weight', hi ? 750 : 550).style('opacity', anim ? 0 : 1);
      if (anim) t.transition().delay(1300 + i * 200).style('opacity', 1);
    });
    return f;
  };

  // ---------- scatter (swing vs concentration) ----------
  AP.scatter = function (el, rows, opt) {
    const m = { t: 18, r: 24, b: 42, l: 52 };
    const f = frame(el, opt.h || 300, m);
    const x = d3.scaleLinear([0, 100], [0, f.iw]);
    const y = d3.scaleLog([3, 260], [f.ih, 0]);
    const r = d3.scaleSqrt([0, d3.max(rows, (d) => d.size)], [5, 26]);
    f.g.append('g').attr('class', 'gridl').call(d3.axisLeft(y).tickValues([4, 10, 25, 50, 100, 200]).tickSize(-f.iw).tickFormat(''));
    const ya = f.g.append('g').attr('class', 'ax ax-y').call(d3.axisLeft(y).tickValues([4, 10, 25, 50, 100, 200]).tickSize(0).tickPadding(8).tickFormat((v) => '±' + v + '%'));
    ya.attr('font-size', null).attr('font-family', null).select('.domain').remove();
    const xa = f.g.append('g').attr('class', 'ax ax-y').attr('transform', `translate(0,${f.ih})`).call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(10).tickFormat((v) => v + '%'));
    xa.attr('font-size', null).attr('font-family', null);
    f.g.append('text').attr('class', 'lbl').attr('x', f.iw).attr('y', f.ih + 34).attr('text-anchor', 'end').text('Top 10 accounts’ share of the stream →');
    f.g.append('text').attr('class', 'lbl').attr('x', 4).attr('y', -6).text('↑ Typical monthly swing (log scale)');
    const anim = opt.animate && !RM;
    const pts = f.g.selectAll('g.pt').data(rows).join('g').attr('class', 'pt').attr('transform', (d) => `translate(${x(d.top10_share)},${y(d.swing)})`);
    pts.append('circle').attr('r', anim ? 0 : (d) => r(d.size)).attr('style', (d) => `fill:${C[d.stream]};fill-opacity:.85;stroke:var(--bg);stroke-width:1.5`)
      .call((s) => anim && s.transition().delay((d, i) => 200 + i * 110).duration(700).ease(d3.easeBackOut).attr('r', (d) => r(d.size)));
    const L = (d) => x(d.top10_share) > f.iw - 110 || (opt.left || []).includes(d.stream);
    pts.append('text').attr('class', 'vlab').attr('x', (d) => (L(d) ? -r(d.size) - 6 : r(d.size) + 6)).attr('text-anchor', (d) => (L(d) ? 'end' : 'start'))
      .attr('dy', (d) => (opt.dy?.[d.stream] || 0) + 4).style('font-size', '12px').text((d) => d.label).style('opacity', anim ? 0 : 1).transition().delay(1300).style('opacity', 1);
    pts.on('mousemove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tipShow(el, f.tip, px, py, `<div class="t-h">${esc(d.label)}</div><div class="t-r"><span>Monthly swing</span><b>±${d.swing}%</b></div><div class="t-r"><span>Top 10 share</span><b>${d.top10_share}%</b></div><div class="t-r"><span>Share of revenue</span><b>${d.size.toFixed(1)}%</b></div>`); })
      .on('mouseleave', () => f.tip.classed('on', false));
    return f;
  };

  // ---------- waterfall ----------
  AP.waterfall = function (el, rows, opt) {
    const m = { t: 26, r: 8, b: 44, l: 8 };
    const f = frame(el, opt.h || 220, m);
    let run = 0;
    const items = rows.map((r) => { const s = run; run += r.monthly_usd; return { label: r.lever.replace('Lever ', 'L'), v: r.monthly_usd, s, e: run, row: r }; });
    items.push({ label: 'Total', v: run, s: 0, e: run, total: true });
    const x = d3.scaleBand(items.map((d) => d.label), [0, f.iw]).padding(.25);
    const y = d3.scaleLinear([0, run * 1.12], [f.ih, 0]);
    const anim = opt.animate && !RM;
    const b = f.g.selectAll('rect').data(items).join('rect').attr('x', (d) => x(d.label)).attr('width', x.bandwidth()).attr('rx', 5)
      .attr('style', (d) => `fill:${d.total ? 'var(--acc)' : 'var(--s-muted2)'}`)
      .attr('y', (d) => (anim ? y(d.s) : y(d.e))).attr('height', (d) => (anim ? 0 : y(d.s) - y(d.e)));
    if (anim) b.transition().delay((d, i) => 200 + i * 260).duration(700).ease(d3.easeCubicOut).attr('y', (d) => y(d.e)).attr('height', (d) => y(d.s) - y(d.e));
    items.slice(0, -2).forEach((d, i) => f.g.append('line').attr('x1', x(d.label) + x.bandwidth()).attr('x2', x(items[i + 1].label)).attr('y1', y(d.e)).attr('y2', y(d.e)).attr('style', 'stroke:var(--line2)').attr('stroke-dasharray', '3 3'));
    f.g.selectAll('text.vlab').data(items).join('text').attr('class', (d) => 'vlab' + (d.total ? ' vlab-hi' : '')).attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', (d) => y(d.e) - 8).attr('text-anchor', 'middle')
      .text((d) => (d.total ? '' : '+') + money(d.v)).style('opacity', anim ? 0 : 1).transition().delay((d, i) => 600 + i * 260).style('opacity', 1);
    f.g.selectAll('text.xl').data(items).join('text').attr('class', 'lbl').attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', f.ih + 16).attr('text-anchor', 'middle').style('font-weight', 650).text((d) => (d.total ? 'Total' : d.label.split(' · ')[0]));
    f.g.selectAll('text.xl2').data(items).join('text').attr('class', 'lbl').attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', f.ih + 31).attr('text-anchor', 'middle').style('font-size', '10.5px').text((d) => (d.total ? '/month' : d.label.split(' · ')[1] || ''));
    b.on('mousemove', (ev, d) => { if (d.total) return; const [px, py] = d3.pointer(ev, el); tipShow(el, f.tip, px, py, `<div class="t-h">${esc(d.row.lever)}</div><div style="max-width:240px;white-space:normal;color:var(--fg2)">${esc(d.row.detail)}</div><div class="t-r" style="margin-top:4px"><span>Per month</span><b>${money(d.v)}</b></div>`); })
      .on('mouseleave', () => f.tip.classed('on', false));
    return f;
  };
})();
