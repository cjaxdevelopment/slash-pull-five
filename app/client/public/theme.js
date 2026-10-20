// Apply the preference before the first paint. External script works with the API's CSP.
(() => {
  let saved;
  try {
    saved = localStorage.getItem('spf.theme');
  } catch {
    // Storage can be unavailable in a private or restricted browser.
  }
  const theme =
    saved === 'light' || saved === 'dark'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content =
    theme === 'dark' ? '#10151e' : '#f8fafc';
})();
