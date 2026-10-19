// Keeps every player on the latest deployed build.
//
// - Registers the service worker. The worker fetches the page from the
//   network first, so a fresh launch always loads the newest build; the cached
//   copy is only an offline fallback.
// - A tab that stays open across a deploy (common for an installed PWA left in
//   the background) checks /version.json when it returns to the foreground and
//   every hour. When the deployed build differs from the running one, it
//   reloads as soon as no game is on screen, so a round in progress is never
//   cut off.
// - If a lazily loaded chunk fails (its file was replaced by a newer deploy),
//   the page reloads instead of showing a blank screen, again waiting until
//   no game is on screen.

const VERSION_URL = "/version.json";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const SAFE_POLL_MS = 15 * 1000;
const RELOAD_GUARD_KEY = "lexichain-update-reload-at";
// Never reload more than once in this window, so a genuinely broken file or a
// deploy that is still propagating cannot cause a reload loop.
const RELOAD_GUARD_MS = 2 * 60 * 1000;

let updatePending = false;
let registration: ServiceWorkerRegistration | undefined;

/** True while a game board or the tutorial is on screen. */
function isGameInProgress(): boolean {
  return document.querySelector("[data-game-session]") !== null;
}

function reloadedRecently(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
    return Date.now() - last < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

function reloadNow(): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: reload anyway.
  }
  window.location.reload();
}

function reloadIfSafe(): void {
  if (updatePending && !isGameInProgress() && !reloadedRecently()) {
    reloadNow();
  }
}

async function checkForNewBuild(): Promise<void> {
  if (updatePending) {
    reloadIfSafe();
    return;
  }
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const { buildId } = (await response.json()) as { buildId?: string };
    if (buildId && buildId !== __APP_BUILD_ID__) {
      updatePending = true;
      // Let the service worker fetch the new build's files in the background.
      registration?.update().catch(() => {});
      reloadIfSafe();
    }
  } catch {
    // Offline or a transient error: try again on the next check.
  }
}

function reloadOnChunkLoadFailure(): void {
  window.addEventListener("vite:preloadError", (event) => {
    // A reload just happened and the file still fails, so a newer deploy is not
    // the cause; let the error surface instead of reloading again.
    if (reloadedRecently()) return;
    // A newer deploy replaced this build's files. Mid-game, wait until the
    // player leaves the board (often the failed load was only a background
    // prefetch); otherwise reload now.
    updatePending = true;
    if (isGameInProgress()) return;
    event.preventDefault();
    reloadNow();
  });
}

export function startAppUpdates(): void {
  if (!import.meta.env.PROD) return;

  reloadOnChunkLoadFailure();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          registration = reg;
        })
        .catch((error) => console.warn("Service worker registration failed:", error));
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  });
  window.addEventListener("online", () => void checkForNewBuild());
  window.setInterval(() => void checkForNewBuild(), CHECK_INTERVAL_MS);
  // Once an update is known, apply it the moment the player leaves the board.
  window.setInterval(reloadIfSafe, SAFE_POLL_MS);
}
