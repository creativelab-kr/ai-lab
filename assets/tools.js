// AI 경영 실험실 도구 — 모든 계산은 이 브라우저 안에서만 한다. 통신·저장 없음.
window.AILabTools = function () {
  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat($(id).value); return isFinite(v) ? v : NaN; };
  var fmt = function (n, d) { return isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: 0 }) : '—'; };
  var pct = function (r, d) { return fmt(r * 100, d == null ? 1 : d) + '%'; };
  var text = function (id, t) { var e = $(id); if (e) e.textContent = t; };

  function copy(str, msgId) {
    function done() { var m = $(msgId); if (!m) return; m.hidden = false; setTimeout(function () { m.hidden = true; }, 2200); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = str; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(str).then(done, fallback); else fallback();
  }

  // ── ① 작은 표본 판정 계산기 ─────────────────────────────
  // 두 비율 비교(양쪽 5%, 검정력 80%)에 한쪽당 필요한 표본 수
  var ZA = 1.959964, ZB = 0.841621;
  function need(p1, p2) {
    var pb = (p1 + p2) / 2, d = p2 - p1;
    var a = ZA * Math.sqrt(2 * pb * (1 - pb)) + ZB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    return (a * a) / (d * d);
  }
  // 한쪽 n 으로 알아볼 수 있는 가장 작은 p2 (이분법). 없으면 null
  function detectable(n, p1) {
    var lo = p1, hi = 0.999999;
    if (need(p1, hi) > n) return null;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (need(p1, mid) > n) lo = mid; else hi = mid; }
    return hi;
  }
  var sampleLine = '';
  function sample() {
    var n = num('s_n'), p1 = num('s_p') / 100, lift = num('s_lift');
    if (!(n >= 2) || !(p1 > 0) || !(p1 < 1)) {
      text('s_big', '—'); text('s_p2', '—'); text('s_need', '—'); text('s_time', '—');
      text('s_note', '표본 수는 2 이상, 전환율은 0과 100 사이로 넣어 주세요.'); sampleLine = ''; return;
    }
    var p2 = detectable(n, p1), events = n * p1, parts = [];
    if (p2 == null) {
      text('s_big', '판정하기 어려움'); text('s_p2', '—');
      parts.push('한쪽 ' + fmt(n) + '건으로는 전환율이 100%가 되어도 구별하기 어렵습니다. 표본을 더 모으거나, 더 앞 단계의 지표(건수가 많은 것)로 바꿔 보세요.');
    } else {
      var rel = (p2 - p1) / p1;
      text('s_big', '+' + fmt(rel * 100, rel < 0.1 ? 1 : 0) + '% 이상');
      text('s_p2', pct(p1, 2) + ' → ' + pct(p2, 2));
      parts.push('한쪽 ' + fmt(n) + '건, 전환율 ' + pct(p1, 2) + '라면, 전환율이 ' + pct(p2, 2) + '(지금의 ' + fmt(p2 / p1, 2) + '배) 이상으로 올라야 다섯 번에 네 번꼴로 알아볼 수 있습니다. 그보다 작은 변화는 실제로 있어도 우연과 구별되지 않습니다.');
    }
    if (lift > 0) {
      var t = p1 * (1 + lift / 100);
      if (t >= 1) { text('s_need', '계산 불가'); text('s_time', '—'); }
      else {
        var nn = Math.ceil(need(p1, t));
        text('s_need', fmt(nn) + '건');
        text('s_time', nn <= n ? '지금 표본으로 충분' : '지금의 약 ' + fmt(nn / n, 1) + '배');
        parts.push(fmt(lift) + '% 상승(' + pct(p1, 2) + ' → ' + pct(t, 2) + ')을 보려면 한쪽에 약 ' + fmt(nn) + '건이 필요합니다.');
      }
    } else { text('s_need', '—'); text('s_time', '—'); }
    if (events < 10) parts.push('주의: 지금 조건에서 전환은 약 ' + fmt(events, 1) + '건뿐입니다. 10건이 안 되면 이 계산식 자체가 부정확합니다. 값은 대략의 크기로만 보세요.');
    text('s_note', parts.join(' '));
    sampleLine = '[표본 계산] 한쪽 ' + fmt(n) + '건 · 지금 전환율 ' + pct(p1, 2) + ' · 알아볼 수 있는 최소 변화 ' + (p2 == null ? '판정 어려움' : $('s_big').textContent + ' (' + pct(p2, 2) + ' 이상)') +
      (lift > 0 ? ' · ' + fmt(lift) + '% 상승에 필요한 표본 ' + $('s_need').textContent : '') + ' · 가정: 두 비율 비교, 양쪽 5%, 검정력 80%';
  }
  ['s_n', 's_p', 's_lift'].forEach(function (id) { if ($(id)) $(id).addEventListener('input', sample); });
  if ($('s_copy')) $('s_copy').addEventListener('click', function () { if (sampleLine) copy(sampleLine, 's_msg'); });
  if ($('s_n')) sample();

  // ── ② 단계별 깔때기 계산기 ─────────────────────────────
  var NAMES = ['노출', '조회', '첫 사용', '구매'];
  var STEPS = ['노출에서 조회로', '조회에서 첫 사용으로', '첫 사용에서 구매로'];
  var funnelLine = '';
  function funnel() {
    var v = [num('f_a'), num('f_b'), num('f_c'), num('f_d')], up = num('f_up'), stage = parseInt($('f_stage').value, 10);
    var bars = $('f_bars'); bars.textContent = '';
    var ok = v.every(function (x) { return x >= 0; }) && v[0] > 0;
    var ordered = ok && v[1] <= v[0] && v[2] <= v[1] && v[3] <= v[2];
    if (!ok) { text('f_leak', '—'); text('f_per', '—'); text('f_big', '—'); text('f_note', '네 칸에 0 이상의 숫자를 넣어 주세요. 노출은 1 이상이어야 합니다.'); funnelLine = ''; return; }
    v.forEach(function (x, i) {
      var row = document.createElement('div'); row.className = 'barrow';
      var a = document.createElement('span'); a.textContent = NAMES[i];
      var tr = document.createElement('div'); tr.className = 'track';
      var fl = document.createElement('div'); fl.className = 'fill';
      var share = i === 0 ? 1 : (v[i - 1] > 0 ? Math.min(1, x / v[i - 1]) : 0);
      fl.style.width = Math.max(share * 100, x > 0 ? 1.5 : 0) + '%'; tr.appendChild(fl);
      var c = document.createElement('span'); c.style.textAlign = 'right'; c.style.fontVariantNumeric = 'tabular-nums';
      c.textContent = i === 0 ? fmt(x) : pct(v[i - 1] > 0 ? x / v[i - 1] : 0, 1);
      row.setAttribute('title', NAMES[i] + ' ' + fmt(x) + (i ? ' · 앞 단계의 ' + c.textContent : ''));
      row.appendChild(a); row.appendChild(tr); row.appendChild(c); bars.appendChild(row);
    });
    var r = [v[1] / v[0], v[1] > 0 ? v[2] / v[1] : 0, v[2] > 0 ? v[3] / v[2] : 0];
    var li = 0; r.forEach(function (x, i) { if (x < r[li]) li = i; });
    text('f_leak', STEPS[li] + ' (' + pct(r[li], 1) + '만 남음)');
    text('f_per', fmt(v[3] / v[0] * 1000, 2) + '건');
    var notes = [];
    if (!ordered) notes.push('뒤 단계 숫자가 앞 단계보다 큽니다. 같은 기간·같은 대상의 숫자인지 확인해 주세요.');
    if (!(up >= 0)) { text('f_big', '—'); text('f_note', notes.concat(['가정 칸에 0 이상의 숫자를 넣어 주세요.']).join(' ')); return; }
    var k = 1 + up / 100, after;
    if (stage === 3) after = v[3] * k;
    else { var nr = Math.min(1, r[stage] * k); after = r[stage] > 0 ? v[3] * (nr / r[stage]) : v[3]; if (r[stage] * k > 1) notes.push('이 단계는 100%를 넘을 수 없어 거기까지만 계산했습니다.'); }
    var gain = after - v[3];
    text('f_big', '구매 ' + fmt(v[3], 1) + '건 → ' + fmt(after, 1) + '건');
    notes.push('늘어나는 구매는 약 ' + fmt(gain, 1) + '건입니다. 다른 단계의 비율이 그대로라는 가정입니다.');
    notes.push('곱셈 구조라서 어느 단계를 ' + fmt(up) + '% 올려도 결과는 똑같이 ' + fmt(up) + '% 늘어납니다. 차이는 "어느 단계가 실제로 올리기 쉬운가"와 "그 변화가 표본으로 보이는가"에 있습니다.');
    if (v[3] < 30) notes.push('구매가 ' + fmt(v[3]) + '건이라 구매 단계의 비율은 우연에 크게 흔들립니다. 판정은 건수가 많은 앞 단계 지표로 하는 편이 낫습니다.');
    text('f_note', notes.join(' '));
    funnelLine = '[깔때기] 노출 ' + fmt(v[0]) + ' → 조회 ' + fmt(v[1]) + ' (' + pct(r[0]) + ') → 첫 사용 ' + fmt(v[2]) + ' (' + pct(r[1]) + ') → 구매 ' + fmt(v[3]) + ' (' + pct(r[2]) + ') · 노출 1,000회당 구매 ' + fmt(v[3] / v[0] * 1000, 2) + '건 · 가정: ' +
      (stage === 3 ? '노출' : STEPS[stage]) + ' +' + fmt(up) + '% → 구매 ' + fmt(after, 1) + '건';
  }
  ['f_a', 'f_b', 'f_c', 'f_d', 'f_up', 'f_stage'].forEach(function (id) { if ($(id)) { $(id).addEventListener('input', funnel); $(id).addEventListener('change', funnel); } });
  if ($('f_copy')) $('f_copy').addEventListener('click', function () { if (funnelLine) copy(funnelLine, 'f_msg'); });
  if ($('f_a')) funnel();

  // ── ③ "끝났다"의 증거 점검표 ───────────────────────────
  if ($('e_copy')) $('e_copy').addEventListener('click', function () {
    var lines = ['[끝났다의 증거 점검]'];
    Array.prototype.forEach.call(document.querySelectorAll('#e_list li'), function (li) {
      var on = li.querySelector('input').checked, b = li.querySelector('b').textContent;
      lines.push((on ? '[x] ' : '[ ] ') + b + (on ? ' — 증거: ' : ' — 못 한 이유·다음 확인일: '));
    });
    copy(lines.join('\n'), 'e_msg');
  });
};
