/*
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Reads the plain word 'light' or 'dark' stored under 'addon-theme' (written by src/stores/theme.ts).
 * No stored choice means light. Kept as an external file because the production CSP forbids inline scripts.
 */
(function () {
  var root = document.documentElement;
  var theme = 'light';
  try {
    var stored = window.localStorage.getItem('addon-theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
  } catch (error) {
    // Storage is blocked (private mode, in-app browsers): stay on light.
  }
  root.setAttribute('data-theme', theme);

  // Keep the browser toolbar the colour of the page, now and whenever the theme is switched.
  function paintToolbar() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#0C0D0F' : '#FFFFFF');
  }
  paintToolbar();
  if (typeof MutationObserver === 'function') {
    new MutationObserver(paintToolbar).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
