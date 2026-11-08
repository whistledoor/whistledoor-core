// Applies a saved light or dark choice before the first paint, so the page does
// not flash in the other scheme. Loaded in <head> without defer; `script-src
// 'self'` allows it and no inline script. Without a saved choice the page follows
// the system. The choice stays in this browser, like the language, and is never
// sent anywhere. src/theme/theme.ts reads and changes it afterwards.
(function () {
  try {
    var value = localStorage.getItem('theme');
    if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
  } catch {
    // Storage blocked: the page follows the system.
  }
})();
