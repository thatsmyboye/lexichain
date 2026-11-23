// Integration with the Lexichain mobile app: the Expo project in mobile/,
// which loads this site in a native WebView.
//
// The app defines window.__LEXICHAIN_NATIVE__ before any page script runs.
// Messages go to the app as JSON through window.ReactNativeWebView.postMessage.
// Requests that need an answer carry an `id`; the app answers by dispatching a
// "lexichain-native-reply" event on window. Keep the message shapes in sync
// with mobile/src/bridge.ts.
//
// In a normal browser none of this is active and every caller falls back to
// the web APIs it used before.

import type { HapticEvent } from "./feedback";

export type NativeAppInfo = {
  platform: "ios" | "android";
  appVersion: string;
  bridge: number;
};

export type NativeShareResult = "shared" | "cancelled" | "error";

type NativeMessage =
  | { type: "ready" }
  | { type: "route"; path: string }
  | { type: "theme"; dark: boolean; background: string }
  | { type: "haptic"; event: HapticEvent }
  | { type: "openExternal"; url: string }
  | { type: "share"; title?: string; text: string }
  | { type: "shareImage"; base64: string; filename: string; title?: string; text?: string };

declare global {
  interface Window {
    __LEXICHAIN_NATIVE__?: NativeAppInfo;
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

const REPLY_EVENT = "lexichain-native-reply";
// A share sheet can stay open while the player picks a target.
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/** Details of the mobile app this page runs in, or null in a browser. */
export function getNativeApp(): NativeAppInfo | null {
  if (typeof window === "undefined" || !window.ReactNativeWebView) return null;
  return window.__LEXICHAIN_NATIVE__ ?? null;
}

export function isNativeApp(): boolean {
  return getNativeApp() !== null;
}

export function postToNative(message: NativeMessage): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  } catch {
    // The bridge is gone (the app is reloading the page): drop the message.
  }
}

let nextRequestId = 1;

/** Sends a request to the app and waits for its reply (null on timeout). */
export function requestNative<T>(message: NativeMessage): Promise<T | null> {
  return new Promise((resolve) => {
    const id = nextRequestId++;
    const finish = (result: T | null) => {
      window.removeEventListener(REPLY_EVENT, onReply);
      window.clearTimeout(timer);
      resolve(result);
    };
    const onReply = (event: Event) => {
      const detail = (event as CustomEvent<{ id: number; result: T }>).detail;
      if (detail?.id === id) finish(detail.result);
    };
    const timer = window.setTimeout(() => finish(null), REQUEST_TIMEOUT_MS);
    window.addEventListener(REPLY_EVENT, onReply);
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ ...message, id }));
    } catch {
      finish(null);
    }
  });
}

/** Reads a Blob as base64 without the data: URL prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol === "mailto:" || url.protocol === "tel:") return true;
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Tells the app which screen is showing, so Android's back button can step back. */
function reportRoutes(): void {
  let lastPath = "";
  const report = () => {
    const path = window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    postToNative({ type: "route", path });
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      report();
    };
  }
  window.addEventListener("popstate", report);
  report();
}

/** Keeps the status bar and the area around the page in the page's colors. */
function reportTheme(): void {
  let last = "";
  let frame = 0;
  const report = () => {
    frame = 0;
    const root = document.documentElement;
    const dark = root.classList.contains("dark");
    let background = getComputedStyle(document.body).backgroundColor;
    if (!background || background === "transparent" || background === "rgba(0, 0, 0, 0)") {
      background = getComputedStyle(root).backgroundColor;
    }
    if (!background || background === "rgba(0, 0, 0, 0)") return;
    const key = `${dark}|${background}`;
    if (key === last) return;
    last = key;
    postToNative({ type: "theme", dark, background });
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(report);
  };
  // Theme and skin changes rewrite the class and inline CSS variables of <html>.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", schedule);
  schedule();
}

/** Links to other sites open in the system browser, not inside the game. */
function openLinksOutside(): void {
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download") || !isExternalUrl(anchor.href)) return;
      event.preventDefault();
      postToNative({ type: "openExternal", url: anchor.href });
    },
    true,
  );
  const originalOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url === undefined ? "" : String(url);
    if (href && isExternalUrl(href)) {
      postToNative({ type: "openExternal", url: new URL(href, window.location.href).href });
      return null;
    }
    return originalOpen(url, target, features);
  };
}

/** Switches on the app integrations. Does nothing in a normal browser. */
export function startNativeIntegration(): void {
  const app = getNativeApp();
  if (!app) return;

  document.documentElement.classList.add("native-app", `native-${app.platform}`);
  reportRoutes();
  reportTheme();
  openLinksOutside();

  // Hide the app's splash screen once the first screen has painted.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => postToNative({ type: "ready" }));
  });
}
