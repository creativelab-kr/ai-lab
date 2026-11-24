// AI 경영 실험실 — 외부 통신·저장 없음(화면 모드 선택만 이 브라우저에 기억).
(function () {
  var root = document.documentElement, KEY = 'ailab.theme';
  function get() { try { return localStorage.getItem(KEY) || 'light'; } catch (e) { return 'light'; } }
  function set(v) { root.setAttribute('data-theme', v); try { localStorage.setItem(KEY, v); } catch (e) {} }
  root.setAttribute('data-theme', get());
  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.querySelector('.theme');
    if (sel) { sel.value = get(); sel.addEventListener('change', function () { set(sel.value); }); }
    if (window.AILabTools) window.AILabTools();
  });
})();
