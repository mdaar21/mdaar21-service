/* Cache public application assets only. AI requests and personal data are never cached. */
const CACHE = 'mdaar-public-v11';
const SHELL = ['/', '/index.html', '/privacy.html', '/assets/styles.css', '/assets/app.js', '/assets/core.mjs', '/assets/remote-service.mjs', '/assets/nutrition.mjs', '/assets/training.mjs', '/assets/pwa.mjs', '/assets/assistant.mjs', '/assets/experience.mjs', '/assets/brand/program-four.svg', '/assets/brand/program-five.svg', '/assets/NotoSansArabic-Bold.ttf', '/assets/food/protein.svg', '/assets/food/bowl.svg', '/assets/food/salad.svg', '/assets/food/toast.svg', '/assets/food/fruit.svg', '/assets/logo.png', '/assets/NotoSansArabic-Regular.ttf', '/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mdaar-public-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const publicAsset = SHELL.includes(url.pathname) || url.pathname.startsWith('/data/') || url.pathname.startsWith('/assets/');
  if (!publicAsset) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic' && !response.headers.has('set-cookie')) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    return cached || new Response('المحتوى غير متاح دون اتصال. افتحه مرة واحدة أثناء الاتصال أولاً.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});
