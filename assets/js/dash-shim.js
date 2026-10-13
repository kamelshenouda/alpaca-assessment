/* Minimal stand-in for the dashboard runtime: serves the bundled data to the page. */
(function () {
  var DATA = window.STORY_DATA || {}, calcs = {}, cbs = [], cache = {};
  var params = { theme: 'light' };
  try { var t = localStorage.getItem('kn-theme'); if (t === 'dark' || t === 'light') params.theme = t; } catch (e) {}
  var q = new URLSearchParams(location.search).get('theme'); if (q === 'dark' || q === 'light') params.theme = q;
  function run() { cache = {}; cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  window.dash = {
    data: function (id) {
      if (DATA[id]) return { status: 'ok', data: DATA[id], columns: DATA[id][0] ? Object.keys(DATA[id][0]) : [], meta: [] };
      if (calcs[id]) {
        if (!cache[id]) { var c = calcs[id]; cache[id] = c.fn.apply(null, c.inputs.map(function (i) { return window.dash.data(i).data; })); }
        return { status: 'ok', data: cache[id], meta: [] };
      }
      return { status: 'missing', data: [], meta: [] };
    },
    calc: function (id, o) { calcs[id] = o; },
    loader: function () {},
    onData: function (fn) { cbs.push(fn); fn(); },
    params: function () { return params; },
    setParams: function (o) { for (var k in o) params[k] = o[k]; try { localStorage.setItem('kn-theme', params.theme); } catch (e) {} run(); },
    resetParams: function () {},
    setLink: function (name) { try { history.replaceState(null, '', '#' + name); } catch (e) {} },
    refresh: function () {},
    colors: []
  };
  var w = window.innerWidth, timer;
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(function () { if (window.innerWidth !== w) { w = window.innerWidth; run(); } }, 150); });
})();
