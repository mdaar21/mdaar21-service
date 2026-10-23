// Public assets only; the function endpoint remains network-only.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional; normal app use must remain available.
    });
  }, {once:true});
}
