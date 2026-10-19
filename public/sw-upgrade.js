// Imported by the generated service worker (see vite.config.ts).
//
// Earlier builds served the app page from the service-worker cache before
// checking the network, so players kept seeing the old page after a deploy.
// When this worker replaces one of those, it reloads every open tab once so
// players land on the current build straight away. Fresh installs and updates
// between network-first builds skip the reload.

const LEXICHAIN_META_CACHE = "lexichain-sw-meta";
const LEXICHAIN_RELOAD_MARKER = "/__lexichain-reload-clients";

async function lexichainHadCacheFirstShell() {
  const names = await caches.keys();
  for (const name of names) {
    if (!name.startsWith("workbox-precache")) continue;
    const cache = await caches.open(name);
    const requests = await cache.keys();
    if (requests.some((request) => new URL(request.url).pathname === "/index.html")) {
      return true;
    }
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (await lexichainHadCacheFirstShell()) {
        const meta = await caches.open(LEXICHAIN_META_CACHE);
        await meta.put(LEXICHAIN_RELOAD_MARKER, new Response("1"));
      }
    })().catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  const reloadNeeded = (async () => {
    const meta = await caches.open(LEXICHAIN_META_CACHE);
    if (!(await meta.match(LEXICHAIN_RELOAD_MARKER))) return false;
    await meta.delete(LEXICHAIN_RELOAD_MARKER);
    return true;
  })().catch(() => false);
  event.waitUntil(reloadNeeded);

  // Navigating is deliberately kept out of waitUntil: the reload's request is
  // handled by this worker, which cannot serve it until activation finishes,
  // so waiting on it here would deadlock.
  reloadNeeded
    .then(async (needed) => {
      if (!needed) return;
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => {})));
    })
    .catch(() => {});
});
