// 서비스 워커: 앱 파일을 저장해 두었다가 오프라인에서도 열리게 해 줍니다.
// 앱을 수정한 뒤에는 아래 버전 숫자를 올려야 폰에 새 버전이 반영됩니다.
const CACHE = "fitlog-v1";
const FILES = ["./", "./index.html", "./style.css", "./app.js", "./chart.umd.min.js",
               "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// 네트워크 우선, 실패하면(오프라인) 저장해 둔 파일 사용
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
