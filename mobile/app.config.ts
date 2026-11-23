import type { ExpoConfig } from "expo/config";

// ---------------------------------------------------------------------------
// Store identity. The bundle identifier and package name are permanent once
// the app is published: confirm them before the first store upload.
// ---------------------------------------------------------------------------
const APP_ID = "com.bantondigital.lexichain";
const APP_NAME = "Lexichain";
// The marketing version shown in the stores. Build numbers are managed by EAS
// (see eas.json: appVersionSource "remote", autoIncrement on production).
const APP_VERSION = "1.0.0";
// Printed by `npx eas-cli@latest init` (run once, signed in to your Expo
// account). Paste it here; EAS builds and updates read it from extra.eas.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? "";

// The deployed web game the app loads. Override per build profile in eas.json
// or locally, e.g. EXPO_PUBLIC_WEB_URL=https://my-preview.vercel.app npx expo start
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://lexichain.banton-digital.com";
const webUrl = new URL(WEB_URL);

// iOS only runs service workers (offline play) in a WKWebView for
// "app-bound domains" listed in Info.plist. IP addresses and localhost cannot
// be listed, so a local development URL runs without them.
const isLocalHost =
  webUrl.hostname === "localhost" || /^[\d.]+$/.test(webUrl.hostname) || webUrl.hostname.includes(":");
const appBoundDomains = isLocalHost ? [] : [webUrl.hostname];

const BRAND_PURPLE = "#7927EC";
const DARK_SURFACE = "#020817";

const config: ExpoConfig = {
  name: APP_NAME,
  slug: "lexichain",
  platforms: ["ios", "android"],
  scheme: "lexichain",
  version: APP_VERSION,
  // The game has portrait and landscape-phone layouts; iPad multitasking also
  // requires every orientation.
  orientation: "default",
  icon: "./assets/icon.png",
  // Follow the system setting so the splash screen and status bar match the
  // web app's light and dark themes.
  userInterfaceStyle: "automatic",
  backgroundColor: BRAND_PURPLE,
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: true,
    config: {
      // The app only uses HTTPS and the OS's standard encryption.
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      ...(appBoundDomains.length > 0 ? { WKAppBoundDomains: appBoundDomains } : {}),
      // Lets a development build load a dev server on the local network.
      // Apple allows this exception without review justification.
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: BRAND_PURPLE,
    },
    // Keep the classic back callback so the back button walks the game's
    // screen history (see src/useAndroidBack.ts).
    predictiveBackGestureEnabled: false,
    // A WebView game needs no runtime permissions.
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
        backgroundColor: BRAND_PURPLE,
        dark: {
          image: "./assets/splash-icon.png",
          backgroundColor: DARK_SURFACE,
        },
      },
    ],
    "expo-sharing",
    "expo-web-browser",
  ],
  extra: {
    webUrl: WEB_URL,
    appBoundDomains,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
};

export default config;
