(function () {
  const KEY = 'vrent_theme', root = document.documentElement;
  const saved = localStorage.getItem(KEY);
  const dark = saved ? saved === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'dark' : 'light';
  function paint() {
    const isDark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', String(isDark)); b.setAttribute
      ('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = b.getAttribute('aria-label'); b.textContent = isDark ? '\u2600\uFE0F' : '\u{1F319}';
    });
  }
  window.toggleTheme = function () { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; 
    localStorage.setItem(KEY, root.dataset.theme); paint(); };
  document.addEventListener('DOMContentLoaded', 
    () => { document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener
      ('click', window.toggleTheme)); paint(); });
})();
