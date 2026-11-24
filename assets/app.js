// AI 경영 실험실 — 외부 통신·저장 없음(화면 모드 선택만 이 브라우저에 기억).
(function () {
  var root = document.documentElement, KEY = 'ailab.theme2', ROOT = root.getAttribute('data-root') || '';
  function get() { try { return localStorage.getItem(KEY) || 'dark'; } catch (e) { return 'dark'; } }
  function set(v) { root.setAttribute('data-theme', v); try { localStorage.setItem(KEY, v); } catch (e) {} }
  root.setAttribute('data-theme', get()); root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.querySelector('.theme');
    if (sel) { sel.value = get(); sel.addEventListener('change', function () { set(sel.value); }); }

    // 스크롤하면 나타나기
    var rv = document.querySelectorAll('.rv');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      Array.prototype.forEach.call(rv, function (el) { io.observe(el); });
    } else Array.prototype.forEach.call(rv, function (el) { el.classList.add('in'); });

    // 카드 기울기(마우스가 있는 화면에서만)
    if (!reduce && window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      Array.prototype.forEach.call(document.querySelectorAll('.card'), function (c) {
        c.addEventListener('pointermove', function (e) {
          var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
          c.style.setProperty('--ry', ((x - .5) * 7) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 7) + 'deg');
        });
        c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
      });
    }

    // 라이브러리 고르기
    var fl = document.querySelector('.filters');
    if (fl) {
      var items = document.querySelectorAll('[data-type]'), empty = document.getElementById('lib_empty'), box = document.getElementById('lib_q'), cur = 'all';
      var apply = function () {
        var q = box ? box.value.trim().toLowerCase() : '', n = 0;
        Array.prototype.forEach.call(items, function (it) {
          var ok = (cur === 'all' || it.getAttribute('data-type') === cur) && (!q || it.textContent.toLowerCase().indexOf(q) >= 0);
          it.hidden = !ok; if (ok) n++;
        });
        if (empty) empty.hidden = n > 0;
      };
      fl.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return; cur = b.getAttribute('data-f');
        Array.prototype.forEach.call(fl.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); apply();
      });
      if (box) box.addEventListener('input', apply);
    }

    // 검색
    var dlg = document.getElementById('search'), inp = document.getElementById('search_q'), res = document.getElementById('search_r'), hint = document.getElementById('search_h'), loaded = false;
    function load(cb) {
      if (window.AILabIndex) return cb();
      if (loaded) return; loaded = true;
      var s = document.createElement('script'); s.src = ROOT + 'assets/search-index.js'; s.onload = cb; document.head.appendChild(s);
    }
    function norm(s) { return s.toLowerCase(); }
    function hl(parent, textv, terms) {   // 검색어를 <mark>로 — 글자는 textContent 로만 넣는다
      var low = norm(textv), i = 0;
      while (i < textv.length) {
        var best = -1, bl = 0;
        terms.forEach(function (t) { var p = low.indexOf(t, i); if (p >= 0 && (best < 0 || p < best)) { best = p; bl = t.length; } });
        if (best < 0) { parent.appendChild(document.createTextNode(textv.slice(i))); break; }
        if (best > i) parent.appendChild(document.createTextNode(textv.slice(i, best)));
        var m = document.createElement('mark'); m.textContent = textv.slice(best, best + bl); parent.appendChild(m); i = best + bl;
      }
    }
    function run() {
      var q = inp.value.trim(), terms = norm(q).split(/\s+/).filter(Boolean); res.textContent = '';
      if (!terms.length) { hint.hidden = false; hint.textContent = hint.getAttribute('data-idle'); return; }
      var out = [];
      (window.AILabIndex || []).forEach(function (d) {
        var t = norm(d.t), x = norm(d.x), sc = 0;
        for (var k = 0; k < terms.length; k++) { var a = t.indexOf(terms[k]) >= 0, b = x.indexOf(terms[k]) >= 0; if (!a && !b) return; sc += (a ? 6 : 0) + (b ? 1 : 0); }
        out.push({ d: d, sc: sc });
      });
      out.sort(function (a, b) { return b.sc - a.sc; });
      if (!out.length) { hint.hidden = false; hint.textContent = hint.getAttribute('data-none'); return; }
      hint.hidden = false; hint.textContent = out.length + hint.getAttribute('data-count');
      out.slice(0, 20).forEach(function (o) {
        var d = o.d, li = document.createElement('li'), a = document.createElement('a'); a.href = ROOT + d.u;
        var k = document.createElement('span'); k.className = 'tag type'; k.textContent = d.k;
        var b = document.createElement('b'); hl(b, d.t, terms);
        var sm = document.createElement('small'), low = norm(d.x), p = -1;
        terms.forEach(function (t) { var i = low.indexOf(t); if (i >= 0 && (p < 0 || i < p)) p = i; });
        var st = Math.max(0, (p < 0 ? 0 : p) - 28), sn = (st > 0 ? '… ' : '') + d.x.slice(st, st + 110) + (st + 110 < d.x.length ? ' …' : '');
        hl(sm, sn, terms);
        a.appendChild(k); a.appendChild(b); a.appendChild(sm); li.appendChild(a); res.appendChild(li);
      });
    }
    function open() {
      if (!dlg) return;
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
      load(run); inp.focus(); inp.select();
    }
    if (dlg) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-search]'), function (b) { b.addEventListener('click', open); });
      inp.addEventListener('input', function () { load(run); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      res.addEventListener('click', function (e) { if (e.target.closest('a')) dlg.close(); });
      var cl = document.getElementById('search_x'); if (cl) cl.addEventListener('click', function () { dlg.close(); });
      document.addEventListener('keydown', function (e) {
        var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
        if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) { e.preventDefault(); open(); }
      });
      if (/[?&]q=/.test(location.search)) { try { inp.value = decodeURIComponent((location.search.match(/[?&]q=([^&]*)/) || [])[1] || '').replace(/\+/g, ' '); } catch (e) {} open(); }
    }

    if (window.AILabTools) window.AILabTools();
  });
})();
