import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewOpenWindowEvent,
} from "react-native-webview/lib/WebViewTypes";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_VERSION, USE_APP_BOUND_DOMAINS, WEB_URL, isGameUrl } from "./config";
import {
  openExternal,
  parseWebMessage,
  playHaptic,
  replyScript,
  shareImage,
  shareText,
} from "./bridge";
import { OfflineScreen } from "./OfflineScreen";

// If the page never reports "ready" (an old deploy, a script error), stop
// covering it with the splash screen after this long.
const SPLASH_TIMEOUT_MS = 10_000;

// Theme colors until the page reports its own (index.html's theme-color).
const DEFAULT_THEME = { dark: false, background: "#7927EC" };

// Defined before the page's own scripts run; the web app reads it to switch on
// its native integrations (src/lib/nativeApp.ts in the web project).
const BEFORE_LOAD_SCRIPT = `
  window.__LEXICHAIN_NATIVE__ = ${JSON.stringify({ platform: Platform.OS, appVersion: APP_VERSION, bridge: 1 })};
  true;
`;

const CSS_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

export function GameScreen() {
  // react-native-webview's typings declare `WebView<P = undefined>` with props
  // `WebViewProps & P`; the default collapses the props to `never`, so the
  // component is used as WebView<object> throughout.
  const webView = useRef<WebView<object>>(null);
  const insets = useSafeAreaInsets();
  // Changing the key remounts the WebView: used to retry after a failed load
  // and to recover when the OS kills the web content process.
  const [mountKey, setMountKey] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const currentPath = useRef("/");

  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  // Android back button: step back through the game's screens, and leave the
  // app (the system default) from the title screen.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (loadFailed || currentPath.current === "/") return false;
      webView.current?.injectJavaScript("window.history.back(); true;");
      return true;
    });
    return () => subscription.remove();
  }, [loadFailed]);

  const reply = useCallback((id: number, result: unknown) => {
    webView.current?.injectJavaScript(replyScript(id, result));
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // Only the game's own pages may drive native features.
      if (!isGameUrl(event.nativeEvent.url)) return;
      const message = parseWebMessage(event.nativeEvent.data);
      if (!message) return;

      switch (message.type) {
        case "ready":
          hideSplash();
          break;
        case "route":
          currentPath.current = message.path;
          break;
        case "theme":
          if (CSS_COLOR.test(message.background)) {
            setTheme({ dark: message.dark, background: message.background });
          }
          break;
        case "haptic":
          void playHaptic(message.event);
          break;
        case "openExternal":
          void openExternal(message.url);
          break;
        case "share":
          void shareText(message.title, message.text).then((result) => reply(message.id, result));
          break;
        case "shareImage":
          void shareImage(message.base64, message.filename, message.title).then((result) =>
            reply(message.id, result),
          );
          break;
      }
    },
    [reply],
  );

  // Links that leave the game open in the system browser instead of
  // replacing the game inside the app.
  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    const { url, isTopFrame } = request;
    if (/^(about|blob|data):/i.test(url)) return true;
    if (isGameUrl(url)) return true;
    if (isTopFrame === false) return true;
    void openExternal(url);
    return false;
  }, []);

  const onOpenWindow = useCallback((event: WebViewOpenWindowEvent) => {
    void openExternal(event.nativeEvent.targetUrl);
  }, []);

  const reload = useCallback(() => {
    setLoadFailed(false);
    setMountKey((key) => key + 1);
  }, []);

  // iOS: the WebView runs edge to edge and the page pads itself with
  // env(safe-area-inset-*) (viewport-fit=cover). Android WebViews do not report
  // those insets reliably, so the native view pads instead.
  const androidPadding =
    Platform.OS === "android"
      ? { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }
      : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, androidPadding]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      {loadFailed ? (
        <OfflineScreen onRetry={reload} />
      ) : (
        <WebView<object>
          key={mountKey}
          ref={webView}
          source={{ uri: WEB_URL }}
          style={[styles.webView, { backgroundColor: theme.background }]}
          injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD_SCRIPT}
          applicationNameForUserAgent={`LexichainApp/${APP_VERSION} (${Platform.OS})`}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={onOpenWindow}
          setSupportMultipleWindows={false}
          onError={() => {
            setLoadFailed(true);
            hideSplash();
          }}
          // The OS reclaimed the page's memory while in the background.
          onContentProcessDidTerminate={() => webView.current?.reload()}
          onRenderProcessGone={reload}
          // Storage and offline play.
          domStorageEnabled
          cacheEnabled
          limitsNavigationsToAppBoundDomains={USE_APP_BOUND_DOMAINS}
          // Sound effects play without a tap first, and inline.
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // Feel like an app, not a web page: no rubber-banding, no link
          // previews, no swipe-back (it would fire mid-drag on the board edge),
          // no pinch-zoom controls, and the layout ignores the system text
          // scale (the game has its own font-size setting).
          bounces={false}
          overScrollMode="never"
          allowsLinkPreview={false}
          allowsBackForwardNavigationGestures={false}
          setBuiltInZoomControls={false}
          textZoom={100}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          webviewDebuggingEnabled={__DEV__}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webView: { flex: 1 },
});
