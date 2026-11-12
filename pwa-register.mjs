// FitGoIn PWA bootstrap. Never intercept auth, API or private account data.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(error => console.warn('FitGoIn offline shell unavailable:', error));
  }, { once: true });
}
