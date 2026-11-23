import Constants, { ExecutionEnvironment } from "expo-constants";

type Extra = { webUrl?: string; appBoundDomains?: string[] };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** The deployed web game. Set in app.config.ts from EXPO_PUBLIC_WEB_URL. */
export const WEB_URL = extra.webUrl ?? "https://lexichain.banton-digital.com";

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** Expo Go cannot carry this app's Info.plist, so app-bound domains are off there. */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const USE_APP_BOUND_DOMAINS = !isExpoGo && (extra.appBoundDomains?.length ?? 0) > 0;

/**
 * "scheme://host[:port]" of a URL, lower-cased, or null for anything that is
 * not http(s). React Native's URL class does not implement every getter, so
 * this parses by hand.
 */
export function originOf(url: string): string | null {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(url);
  return match ? `${match[1]}://${match[2]}`.toLowerCase() : null;
}

export const WEB_ORIGIN = originOf(WEB_URL);

/** True for pages of the game itself; everything else opens outside the app. */
export function isGameUrl(url: string): boolean {
  return WEB_ORIGIN !== null && originOf(url) === WEB_ORIGIN;
}
