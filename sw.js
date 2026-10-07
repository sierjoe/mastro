/* MASTRO service worker — caches the app so it opens without internet.
   When you update files on GitHub, change VERSION so devices pick up the new copy. */
const VERSION = 'mastro-v6.0.0';
const FILES = ['./','./index.html','./css/style.css','./js/seed.js','./js/core.js','./js/views-main.js','./js/attendance.js','./js/forms.js','./js/sf1.js','./js/items.js','./js/xlsxview.js','./js/templates.js','./js/classes.js','./js/ecredit.js','./js/tests.js',
  './vendor/xlsx.full.min.js','./vendor/html2canvas.min.js','./vendor/jspdf.umd.min.js','./vendor/jszip.min.js','./vendor/qrcode.js','./vendor/jsQR.js','./vendor/pdf.min.js','./vendor/pdf.worker.min.js',
  './templates/SF9_Report_Card_Template.xlsx','./templates/ECR_Template.xlsx','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/brand.png','./icons/favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});
